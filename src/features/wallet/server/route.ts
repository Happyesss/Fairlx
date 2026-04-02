import "server-only";

import { Hono } from "hono";
import { Query } from "node-appwrite";
import { zValidator } from "@hono/zod-validator";

import {
    DATABASE_ID,
    BILLING_ACCOUNTS_ID,
    WALLET_DAILY_TOPUP_LIMIT,
    WALLET_TRANSACTIONS_ID,
} from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";
import { createAdminClient } from "@/lib/appwrite";
import { createOrder, getPublicKey, verifyPaymentSignature, getOrderPayments, createCustomer, getCashfreeMode, getCashfree } from "@/lib/cashfree";

import {
    createTopupOrderSchema,
    verifyTopupSchema,
    getWalletBalanceSchema,
    getTransactionsSchema,
    deductUsageSchema,
} from "../schemas";

// Wallet types and services are imported as needed

import {
    getOrCreateWallet,
    topUpWallet,
    getWalletBalance,
    getWalletTransactions,
    deductFromWallet,
} from "../services/wallet-service";

import { BillingAccount, BillingAccountType } from "@/features/billing/types";

/**
 * Wallet API Routes (Wallet-Only Payment Model)
 * 
 * Routes:
 * - GET    /wallet/balance          - Get wallet balance
 * - POST   /wallet/create-order     - Create Cashfree order for wallet top-up
 * - POST   /wallet/verify-topup     - Verify Cashfree payment and credit wallet
 * - GET    /wallet/transactions     - List wallet transactions
 * - POST   /wallet/deduct           - Deduct usage from wallet (internal API)
 * 
 * All endpoints require authentication.
 */

const app = new Hono()
    /**
     * GET /wallet/balance
     * Get wallet balance for current user or organization
     */
    .get(
        "/balance",
        sessionMiddleware,
        zValidator("query", getWalletBalanceSchema),
        async (c) => {
            const user = c.get("user");
            const { userId, organizationId } = c.req.valid("query");

            const { databases } = await createAdminClient();

            const queryUserId = userId || (organizationId ? undefined : user.$id);
            const queryOrgId = organizationId;

            // Get or create wallet
            const wallet = await getOrCreateWallet(databases, {
                userId: queryUserId,
                organizationId: queryOrgId,
            });

            const balance = await getWalletBalance(databases, wallet.$id);

            return c.json({
                data: {
                    walletId: wallet.$id,
                    ...balance,
                    lastTopUpAt: wallet.lastTopUpAt,
                },
            });
        }
    )

    /**
     * POST /wallet/create-order
     * Create a Cashfree order for wallet top-up
     * 
     * This is step 1 of the top-up flow:
     * 1. Frontend calls this to get a Cashfree order
     * 2. Frontend opens Cashfree Checkout with the paymentSessionId
     * 3. After payment, frontend calls /verify-topup with payment details
     */
    .post(
        "/create-order",
        sessionMiddleware,
        zValidator("json", createTopupOrderSchema),
        async (c) => {
            const user = c.get("user");
            const { amount, organizationId } = c.req.valid("json");

            const { databases } = await createAdminClient();

            // Get or create wallet
            const wallet = await getOrCreateWallet(databases, {
                userId: organizationId ? undefined : user.$id,
                organizationId,
            });

            // Fraud check: Daily top-up limit
            if (amount > WALLET_DAILY_TOPUP_LIMIT) {
                return c.json({
                    error: "Amount exceeds daily top-up limit",
                    maxAllowed: WALLET_DAILY_TOPUP_LIMIT,
                }, 400);
            }

            // Get billing account for customer ID
            let billingAccountId: string | undefined;
            try {
                const billingQuery = organizationId
                    ? [Query.equal("organizationId", organizationId), Query.equal("type", BillingAccountType.ORG)]
                    : [Query.equal("userId", user.$id), Query.equal("type", BillingAccountType.PERSONAL)];

                const accounts = await databases.listDocuments<BillingAccount>(
                    DATABASE_ID,
                    BILLING_ACCOUNTS_ID,
                    [...billingQuery, Query.limit(1)]
                );

                if (accounts.total > 0) {
                    billingAccountId = accounts.documents[0].$id;
                }
            } catch {
                // No billing account found, still allow top-up
            }

            // ── USD → INR Conversion ──
            // Frontend sends amount in USD cents. Cashfree charges in INR (major units).
            // We convert using the live exchange rate and store metadata for reverse conversion.
            const { getUsdToInrRate } = await import("@/lib/currency");
            const exchangeRate = await getUsdToInrRate();
            const amountInrPaise = Math.round(amount * exchangeRate); // USD cents × rate = INR paise

            // Generate order ID upfront (Cashfree requires it)
            const orderId = `topup_${wallet.$id}_${Date.now()}`;

            // Create stable customer ID from email hash
            const customer = await createCustomer({
                name: user.name || "Fairlx User",
                email: user.email,
            });

            // Create Cashfree order in INR (amount in paise, createOrder converts to rupees)
            const orderResponse = await createOrder({
                amount: amountInrPaise,
                currency: "INR",
                orderId,
                customerId: customer.id,
                customerEmail: user.email,
                notes: {
                    fairlx_wallet_id: wallet.$id,
                    fairlx_billing_account_id: billingAccountId || "",
                    fairlx_user_id: user.$id,
                    fairlx_purpose: "wallet_topup",
                    fairlx_usd_amount: String(amount), // Original USD cents
                    fairlx_exchange_rate: String(exchangeRate), // Rate used
                },
            });

            const orderData = orderResponse.data;

            return c.json({
                data: {
                    orderId: orderData?.order_id || orderId,
                    amount: amountInrPaise,
                    currency: "INR",
                    paymentSessionId: orderData?.payment_session_id || "",
                    key: getPublicKey(),
                    environment: getCashfreeMode(),
                    walletId: wallet.$id,
                    // Send conversion info to frontend for display
                    originalUsdCents: amount,
                    exchangeRate,
                },
            });
        }
    )

    /**
     * POST /wallet/verify-topup
     * Verify Cashfree payment and credit wallet
     * 
     * This is step 3 of the top-up flow:
     * 1. Frontend called /create-order to get an order
     * 2. Frontend completed Cashfree Checkout
     * 3. Frontend calls this with payment details for verification
     */
    .post(
        "/verify-topup",
        sessionMiddleware,
        zValidator("json", verifyTopupSchema),
        async (c) => {
            try {
                const { cashfreeOrderId, cfPaymentId, orderAmount, signature } = c.req.valid("json");

                // Step 1: Verify payment signature (optional — only if frontend provided it)
                if (signature && cfPaymentId && orderAmount) {
                    const isValid = verifyPaymentSignature(
                        cashfreeOrderId,
                        String(orderAmount),
                        cfPaymentId,
                        signature
                    );

                    if (!isValid) {
                        console.warn("[verify-topup] Client signature invalid, falling back to API verification:", cashfreeOrderId);
                        // Don't fail — we'll verify via API below
                    }
                }

                // Step 2: Fetch order details from Cashfree server-side (source of truth)
                const cashfreeClient = getCashfree();
                let orderTags: Record<string, string> | undefined;
                let orderStatus: string | undefined;

                try {
                    const orderDetails = await cashfreeClient.PGFetchOrder(cashfreeOrderId);
                    orderTags = orderDetails.data?.order_tags as Record<string, string> | undefined;
                    orderStatus = orderDetails.data?.order_status;
                } catch (fetchErr) {
                    console.warn("[verify-topup] Could not fetch order details:", {
                        cashfreeOrderId,
                        error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
                    });
                }

                // If order is not PAID, check if there's still a chance it will be
                if (orderStatus && orderStatus !== "PAID") {
                    return c.json({
                        error: `Order not in PAID state: ${orderStatus}. The webhook will credit your wallet when payment completes.`,
                    }, 400);
                }

                // Step 3: Get payment details from Cashfree
                const paymentsResponse = await getOrderPayments(cashfreeOrderId);
                const payments = paymentsResponse.data;

                if (!payments || payments.length === 0) {
                    return c.json({ error: "No payments found for this order" }, 400);
                }

                // Find the successful payment — match by cfPaymentId if provided, else find any SUCCESS
                const payment = cfPaymentId
                    ? (payments.find(
                        (p) => p.cf_payment_id?.toString() === cfPaymentId && p.payment_status === "SUCCESS"
                    ) || payments.find((p) => p.payment_status === "SUCCESS"))
                    : payments.find((p) => p.payment_status === "SUCCESS");

                if (!payment || payment.payment_status !== "SUCCESS") {
                    return c.json({
                        error: `Payment not in valid state: ${payment?.payment_status || "NOT_FOUND"}`,
                    }, 400);
                }

                // Resolve the actual cfPaymentId from the payment object
                const resolvedCfPaymentId = cfPaymentId || String(payment.cf_payment_id);

                // Step 4: Get wallet ID from order tags
                let walletId = orderTags?.fairlx_wallet_id;

                if (!walletId) {
                    // Fallback: parse from orderId format: topup_{walletId}_{timestamp}
                    const parts = cashfreeOrderId.split("_");
                    if (parts.length >= 2 && parts[0] === "topup") {
                        walletId = parts[1];
                    }
                }

                if (!walletId) {
                    return c.json({ error: "Payment not linked to a wallet" }, 400);
                }

                const { databases } = await createAdminClient();

                // Step 5: Determine USD amount to credit
                let usdCentsToCredit: number;

                if (orderTags?.fairlx_usd_amount) {
                    // Use the exact USD amount from order creation
                    usdCentsToCredit = Number(orderTags.fairlx_usd_amount);
                } else {
                    // Fallback: convert INR (major units) back to USD cents using live rate
                    const { getUsdToInrRate } = await import("@/lib/currency");
                    const rate = await getUsdToInrRate();
                    const paymentAmountPaise = (payment.payment_amount || 0) * 100;
                    usdCentsToCredit = Math.round(paymentAmountPaise / rate);
                }

                // Step 5b: Pre-flight duplicate check by payment ID
                // Catches all legacy key variants (webhook_, cashfree_, topup_)
                const existingForPayment = await databases.listDocuments(
                    DATABASE_ID,
                    WALLET_TRANSACTIONS_ID,
                    [
                        Query.equal("referenceId", resolvedCfPaymentId),
                        Query.limit(1),
                    ]
                );
                if (existingForPayment.total > 0) {
                    const balance = await getWalletBalance(databases, walletId);
                    return c.json({
                        data: {
                            success: true,
                            balance: balance.balance,
                            availableBalance: balance.availableBalance,
                            currency: balance.currency,
                            alreadyProcessed: true,
                        },
                    });
                }

                // Step 6: Credit wallet with USD cents (idempotent via payment ID)
                const result = await topUpWallet(databases, walletId, usdCentsToCredit, {
                    idempotencyKey: `topup_${resolvedCfPaymentId}`,
                    paymentId: resolvedCfPaymentId,
                    description: `Wallet top-up via Cashfree — $${(usdCentsToCredit / 100).toFixed(2)} USD`,
                });

                if (!result.success && result.error !== "already_processed") {
                    return c.json({ error: result.error }, 400);
                }

                // Step 7: Return updated balance
                const balance = await getWalletBalance(databases, walletId);

                return c.json({
                    data: {
                        success: true,
                        transaction: result.transaction,
                        balance: balance.balance,
                        availableBalance: balance.availableBalance,
                        currency: balance.currency,
                        alreadyProcessed: result.error === "already_processed",
                    },
                });
            } catch (error) {
                console.error("[verify-topup] Unhandled error:", error);
                const message = error instanceof Error ? error.message : "Internal server error";
                return c.json({ error: message }, 500);
            }
        }
    )

    /**
     * GET /wallet/transactions
     * List wallet transactions
     */
    .get(
        "/transactions",
        sessionMiddleware,
        zValidator("query", getTransactionsSchema),
        async (c) => {
            const user = c.get("user");
            const { limit, offset, type } = c.req.valid("query");

            const organizationId = c.req.query("organizationId");

            const { databases } = await createAdminClient();

            // Get wallet
            const wallet = await getOrCreateWallet(databases, {
                userId: organizationId ? undefined : user.$id,
                organizationId,
            });

            // Get transactions
            const result = await getWalletTransactions(databases, wallet.$id, {
                limit,
                offset,
                type,
            });

            return c.json({
                data: {
                    transactions: result.transactions,
                    total: result.total,
                    walletId: wallet.$id,
                },
            });
        }
    )

    /**
     * POST /wallet/deduct
     * Deduct usage from wallet (internal API — called by other Fairlx services)
     * 
     * CRITICAL: This blocks the action if wallet has insufficient balance.
     * Returns a structured error with an "add_credits" action URI.
     */
    .post(
        "/deduct",
        sessionMiddleware,
        zValidator("json", deductUsageSchema),
        async (c) => {
            const user = c.get("user");
            const { amount, referenceId, idempotencyKey, description } = c.req.valid("json");

            const organizationId = c.req.query("organizationId");

            const { databases } = await createAdminClient();

            // Get wallet
            const wallet = await getOrCreateWallet(databases, {
                userId: organizationId ? undefined : user.$id,
                organizationId,
            });

            // Attempt deduction
            const result = await deductFromWallet(databases, wallet.$id, amount, {
                referenceId,
                idempotencyKey,
                description,
            });

            if (!result.success) {
                // Get current balance for error response
                const balance = await getWalletBalance(databases, wallet.$id);

                return c.json({
                    error: "INSUFFICIENT_BALANCE",
                    message: "Your wallet balance is too low for this action. Please add credits to continue.",
                    currentBalance: balance.balance,
                    requiredAmount: amount,
                    shortfall: amount - balance.availableBalance,
                    action: {
                        type: "ADD_CREDITS",
                        label: "Add Credits",
                        url: `/billing?addCredits=true&amount=${amount}`,
                    },
                }, 402);
            }

            return c.json({
                data: {
                    success: true,
                    transaction: result.transaction,
                },
            });
        }
    );

export default app;
