import "server-only";

import { Hono } from "hono";
import { ID, Query } from "node-appwrite";

import {
    DATABASE_ID,
    BILLING_ACCOUNTS_ID,
    BILLING_AUDIT_LOGS_ID,
    INVOICES_ID,
    WALLETS_ID,
} from "@/config";
import { createAdminClient } from "@/lib/appwrite";
import { verifyWebhookSignature } from "@/lib/cashfree";
import { isEventProcessed, markEventProcessed } from "@/lib/processed-events-registry";

import {
    BillingStatus,
    BillingAccount,
    BillingInvoice,
    BillingAuditEventType,
    InvoiceStatus,
    CashfreeWebhookEvent,
} from "../types";

import { Wallet } from "@/features/wallet/types";
import { topUpWallet, refundToWallet } from "@/features/wallet/services/wallet-service";

/**
 * Cashfree Webhook Handler (Wallet-Only)
 * 
 * CRITICAL: This handles Cashfree webhook events for wallet top-ups.
 * 
 * Events Handled:
 * - PAYMENT_SUCCESS_WEBHOOK: Payment successful → credit wallet
 * - PAYMENT_FAILED_WEBHOOK: Payment failed → audit log only
 * - PAYMENT_USER_DROPPED_WEBHOOK: User dropped → audit log only
 * - REFUND_SUCCESS_WEBHOOK: Refund successful → credit wallet
 * - REFUND_FAILED_WEBHOOK: Refund failed → audit log only
 * 
 * SECURITY:
 * - All webhooks are signature-verified using HMAC-SHA256(timestamp + body)
 * - Event IDs are stored in DATABASE for persistent idempotency
 * - All events are audit-logged
 * 
 * CRITICAL DIFFERENCES FROM RAZORPAY:
 * - Signature = HMAC-SHA256(timestamp + rawBody), base64 encoded
 * - Amounts are in RUPEES (major units), multiply by 100 for paise
 * - order_tags replaces payment.notes
 * - cf_payment_id replaces pay_xxx IDs
 * 
 * CRITICAL INVARIANT: Webhooks MUST NEVER:
 * - Touch usage_events
 * - Modify usage_aggregations
 * - Infer or calculate usage
 */

const app = new Hono()
    /**
     * GET /webhooks/cashfree
     * Health check endpoint for Cashfree dashboard test ping
     */
    .get("/cashfree", (c) => {
        return c.json({ status: "ok" });
    })
    /**
     * POST /webhooks/cashfree
     * Main webhook endpoint for Cashfree events
     */
    .post("/cashfree", async (c) => {
        // Get raw body for signature verification
        const rawBody = await c.req.text();
        const signature = c.req.header("x-webhook-signature");
        const timestamp = c.req.header("x-webhook-timestamp");

        if (!signature || !timestamp) {
            // Cashfree dashboard test ping sends POST without signature headers.
            // Return 200 so the test passes; real events always include signatures.
            return c.json({ status: "ok" });
        }

        // Verify signature
        if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
            return c.json({ error: "Invalid signature" }, 401);
        }

        // Parse event
        let event: CashfreeWebhookEvent;
        try {
            event = JSON.parse(rawBody);
        } catch {
            return c.json({ error: "Invalid JSON" }, 400);
        }

        // Generate event ID from payload for idempotency
        const cfPaymentId = event.data?.payment?.cf_payment_id || "unknown";
        const refundId = event.data?.refund?.refund_id || "";
        const eventId = `${event.type}-${event.event_time}-${cfPaymentId}${refundId ? `-${refundId}` : ""}`;

        const { databases } = await createAdminClient();

        // Check idempotency (database-backed for production safety)
        if (await isEventProcessed(databases, eventId, "webhook")) {
            return c.json({ status: "already_processed" });
        }

        try {
            // Route to appropriate handler
            switch (event.type) {
                case "PAYMENT_SUCCESS_WEBHOOK":
                    await handlePaymentSuccess(databases, event, eventId);
                    break;

                case "PAYMENT_FAILED_WEBHOOK":
                case "PAYMENT_USER_DROPPED_WEBHOOK":
                    await handlePaymentFailed(databases, event, eventId);
                    break;

                case "REFUND_SUCCESS_WEBHOOK":
                    await handleRefundSuccess(databases, event, eventId);
                    break;

                case "REFUND_FAILED_WEBHOOK":
                    await handleRefundFailed(databases, event, eventId);
                    break;

                default:
                    // Unhandled event type — ignore
                    break;
            }

            // Mark as processed (persisted to database)
            await markEventProcessed(databases, eventId, "webhook");

            return c.json({ status: "processed" });
        } catch (err) {
            console.error("[cashfree-webhook] Unhandled error processing event:", {
                eventId,
                error: err instanceof Error ? err.message : String(err),
                stack: err instanceof Error ? err.stack : undefined,
            });
            // Return 500 so Cashfree retries on infrastructure failures
            return c.json({ status: "error", retryable: true }, 500);
        }
    });

// ============================================================================
// PAYMENT HANDLERS
// ============================================================================

/**
 * Handle PAYMENT_SUCCESS_WEBHOOK event
 * 
 * Called when a wallet top-up payment is successfully completed.
 * Credits the user's wallet with the payment amount.
 * 
 * CRITICAL: Cashfree amounts are in RUPEES. Multiply by 100 for paise.
 */
async function handlePaymentSuccess(
    databases: Awaited<ReturnType<typeof createAdminClient>>["databases"],
    event: CashfreeWebhookEvent,
    eventId: string
) {
    const payment = event.data?.payment;
    const order = event.data?.order;
    if (!payment || !order) {
        return;
    }

    // Get metadata from order_tags (replaces Razorpay notes)
    const tags = order.order_tags || {};
    const walletId = tags.fairlx_wallet_id;
    const billingAccountId = tags.fairlx_billing_account_id;

    if (!walletId) {
        // Not a wallet top-up, skip
        return;
    }

    // Cashfree amounts are in rupees → convert to paise for wallet
    const amountPaise = Math.round((payment.payment_amount || 0) * 100);

    // Determine USD amount to credit
    let amountToCredit: number;
    if (tags.fairlx_usd_amount) {
        // Use the exact USD amount from order creation
        amountToCredit = Number(tags.fairlx_usd_amount);
    } else {
        // Fallback: use the INR paise amount
        amountToCredit = amountPaise;
    }

    // Pre-flight duplicate check: If ANY transaction already references this
    // cf_payment_id (regardless of idempotency key prefix), skip.
    // This catches all legacy key variants: webhook_, cashfree_, topup_.
    const { WALLET_TRANSACTIONS_ID } = await import("@/config");
    const existingForPayment = await databases.listDocuments(
        DATABASE_ID,
        WALLET_TRANSACTIONS_ID,
        [
            Query.equal("referenceId", String(payment.cf_payment_id)),
            Query.limit(1),
        ]
    );
    if (existingForPayment.total > 0) {
        console.log("[cashfree-webhook] Payment already credited, skipping:", {
            cfPaymentId: payment.cf_payment_id,
            existingTxnId: existingForPayment.documents[0].$id,
        });
        return; // Already credited — no error, no retry
    }

    // Credit the wallet (idempotent via payment ID)
    const result = await topUpWallet(databases, walletId, amountToCredit, {
        idempotencyKey: `topup_${payment.cf_payment_id}`,
        paymentId: String(payment.cf_payment_id),
        description: `Wallet top-up via Cashfree webhook`,
    });

    // If topUpWallet failed for a non-idempotency reason, throw so the outer
    // catch returns 500 and Cashfree retries the webhook.
    if (!result.success && result.error !== "already_processed") {
        console.error("[cashfree-webhook] topUpWallet failed:", {
            walletId,
            amountToCredit,
            error: result.error,
            eventId,
            cfPaymentId: payment.cf_payment_id,
        });
        throw new Error(`topUpWallet failed: ${result.error}`);
    }

    if (result.success && result.error !== "already_processed") {
        // Update billing account status if needed
        if (billingAccountId) {
            try {
                const account = await databases.getDocument<BillingAccount>(
                    DATABASE_ID,
                    BILLING_ACCOUNTS_ID,
                    billingAccountId
                );

                const updates: Partial<BillingAccount> = {
                    lastPaymentAt: new Date().toISOString(),
                };

                // If account was DUE or SUSPENDED, restore to ACTIVE
                if (account.billingStatus !== BillingStatus.ACTIVE) {
                    updates.billingStatus = BillingStatus.ACTIVE;
                    updates.gracePeriodEnd = undefined;
                }

                await databases.updateDocument(
                    DATABASE_ID,
                    BILLING_ACCOUNTS_ID,
                    billingAccountId,
                    updates
                );

                // If account was restored from suspension, log that
                if (account.billingStatus === BillingStatus.SUSPENDED) {
                    await databases.createDocument(
                        DATABASE_ID,
                        BILLING_AUDIT_LOGS_ID,
                        ID.unique(),
                        {
                            billingAccountId,
                            eventType: BillingAuditEventType.ACCOUNT_RESTORED,
                            cashfreeEventId: eventId,
                            metadata: JSON.stringify({
                                previousStatus: BillingStatus.SUSPENDED,
                                paymentId: payment.cf_payment_id,
                                walletTopupAmount: amountToCredit,
                            }),
                        }
                    );
                }
            } catch {
                // Don't fail the webhook if billing account update fails
            }

            // If account belongs to an organization, check if we need to unlock it
            try {
                const account = await databases.getDocument(
                    DATABASE_ID,
                    BILLING_ACCOUNTS_ID,
                    billingAccountId
                );
                if (account.organizationId) {
                    const { unlockOrgAfterPayment } = await import("../services/trial-expiry-service");
                    await unlockOrgAfterPayment(account.organizationId);
                }
            } catch {
                // Don't fail the webhook if trial unlock fails
            }
        }

        // Find and update associated invoice (if top-up was for a specific invoice)
        const invoiceId = tags.fairlx_invoice_id;
        if (invoiceId) {
            try {
                const invoices = await databases.listDocuments<BillingInvoice>(
                    DATABASE_ID,
                    INVOICES_ID,
                    [Query.equal("invoiceId", invoiceId), Query.limit(1)]
                );

                if (invoices.total > 0) {
                    await databases.updateDocument(
                        DATABASE_ID,
                        INVOICES_ID,
                        invoices.documents[0].$id,
                        {
                            status: InvoiceStatus.PAID,
                            cashfreePaymentId: String(payment.cf_payment_id),
                            walletTransactionId: result.transaction?.$id,
                            paidAt: new Date().toISOString(),
                        }
                    );
                }
            } catch {
                // Don't fail the webhook if invoice update fails
            }
        }
    }

    // Log audit event
    await databases.createDocument(
        DATABASE_ID,
        BILLING_AUDIT_LOGS_ID,
        ID.unique(),
        {
            billingAccountId: billingAccountId || null,
            eventType: BillingAuditEventType.WALLET_TOPUP,
            cashfreeEventId: eventId,
            metadata: JSON.stringify({
                paymentId: payment.cf_payment_id,
                amount: amountPaise,
                currency: payment.payment_currency,
                walletId,
                walletCredited: result.success && result.error !== "already_processed",
            }),
        }
    );
}

/**
 * Handle PAYMENT_FAILED_WEBHOOK and PAYMENT_USER_DROPPED_WEBHOOK events
 * 
 * Called when a payment attempt fails or user drops.
 * Audit log only — no grace period or mandate logic.
 */
async function handlePaymentFailed(
    databases: Awaited<ReturnType<typeof createAdminClient>>["databases"],
    event: CashfreeWebhookEvent,
    eventId: string
) {
    const payment = event.data?.payment;
    const order = event.data?.order;
    if (!payment || !order) {
        return;
    }

    const tags = order.order_tags || {};
    const billingAccountId = tags.fairlx_billing_account_id;

    // Log audit event
    await databases.createDocument(
        DATABASE_ID,
        BILLING_AUDIT_LOGS_ID,
        ID.unique(),
        {
            billingAccountId: billingAccountId || null,
            eventType: BillingAuditEventType.PAYMENT_FAILED,
            cashfreeEventId: eventId,
            metadata: JSON.stringify({
                paymentId: payment.cf_payment_id,
                amount: Math.round((payment.payment_amount || 0) * 100),
                status: payment.payment_status,
                message: payment.payment_message,
            }),
        }
    );
}

// ============================================================================
// REFUND HANDLERS
// ============================================================================

/**
 * Handle REFUND_SUCCESS_WEBHOOK event
 * 
 * Called when a refund is successfully processed.
 * Credits the wallet with the refunded amount.
 * 
 * CRITICAL: Cashfree refund_amount is in RUPEES. Multiply by 100 for paise.
 */
async function handleRefundSuccess(
    databases: Awaited<ReturnType<typeof createAdminClient>>["databases"],
    event: CashfreeWebhookEvent,
    eventId: string
) {
    const refund = event.data?.refund;
    const order = event.data?.order;
    if (!refund || !order) {
        return;
    }

    const tags = order.order_tags || {};
    const walletId = tags.fairlx_wallet_id;
    const billingAccountId = tags.fairlx_billing_account_id;

    // Cashfree refund_amount is in rupees → convert to paise
    const refundAmountPaise = Math.round((refund.refund_amount || 0) * 100);

    // Credit wallet if we know which wallet to credit
    if (walletId) {
        await refundToWallet(databases, walletId, refundAmountPaise, {
            referenceId: String(refund.cf_payment_id),
            idempotencyKey: `refund_${refund.refund_id}`,
            reason: "Cashfree refund",
        });
    } else if (billingAccountId) {
        // Try to find the wallet via billing account
        try {
            const account = await databases.getDocument<BillingAccount>(
                DATABASE_ID,
                BILLING_ACCOUNTS_ID,
                billingAccountId
            );

            const walletQuery = account.organizationId
                ? [Query.equal("organizationId", account.organizationId)]
                : [Query.equal("userId", account.userId!)];

            const wallets = await databases.listDocuments<Wallet>(
                DATABASE_ID,
                WALLETS_ID,
                [...walletQuery, Query.limit(1)]
            );

            if (wallets.total > 0) {
                await refundToWallet(databases, wallets.documents[0].$id, refundAmountPaise, {
                    referenceId: String(refund.cf_payment_id),
                    idempotencyKey: `refund_${refund.refund_id}`,
                    reason: "Cashfree refund",
                });
            }
        } catch {
            // Log but don't fail
        }
    }

    // Log audit event
    await databases.createDocument(
        DATABASE_ID,
        BILLING_AUDIT_LOGS_ID,
        ID.unique(),
        {
            billingAccountId: billingAccountId || null,
            eventType: BillingAuditEventType.REFUND_PROCESSED,
            cashfreeEventId: eventId,
            metadata: JSON.stringify({
                refundId: refund.refund_id,
                cfPaymentId: refund.cf_payment_id,
                amount: refundAmountPaise,
            }),
        }
    );
}

/**
 * Handle REFUND_FAILED_WEBHOOK event
 * 
 * Called when a refund fails. Audit log only.
 */
async function handleRefundFailed(
    databases: Awaited<ReturnType<typeof createAdminClient>>["databases"],
    event: CashfreeWebhookEvent,
    eventId: string
) {
    const refund = event.data?.refund;
    const order = event.data?.order;
    if (!refund || !order) {
        return;
    }

    const tags = order.order_tags || {};
    const billingAccountId = tags.fairlx_billing_account_id;

    // Log audit event
    await databases.createDocument(
        DATABASE_ID,
        BILLING_AUDIT_LOGS_ID,
        ID.unique(),
        {
            billingAccountId: billingAccountId || null,
            eventType: BillingAuditEventType.REFUND_FAILED,
            cashfreeEventId: eventId,
            metadata: JSON.stringify({
                refundId: refund.refund_id,
                cfPaymentId: refund.cf_payment_id,
                amount: Math.round((refund.refund_amount || 0) * 100),
            }),
        }
    );
}

export default app;
