import "server-only";

import { Hono } from "hono";
import { ID, Query, Databases } from "node-appwrite";
import { zValidator } from "@hono/zod-validator";

import {
    DATABASE_ID,
    BILLING_ACCOUNTS_ID,
    BILLING_AUDIT_LOGS_ID,
    INVOICES_ID,
    WALLETS_ID,
    BILLING_CURRENCY,
} from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";
import { createAdminClient } from "@/lib/appwrite";
import { createCustomer } from "@/lib/cashfree";

import {
    BillingStatus,
    BillingAccountType,
    BillingAccount,
    BillingInvoice,
    BillingAuditEventType,
} from "../types";

import {
    setupBillingSchema,
    getBillingAccountSchema,
    getInvoicesSchema,
} from "../schemas";

import { Wallet } from "@/features/wallet/types";
import { getOrCreateWallet } from "@/features/wallet/services/wallet-service";

/**
 * Billing API Routes (Wallet-Only)
 * 
 * Handles billing account management and invoice operations.
 * All payments flow through the wallet. No mandates, no subscriptions.
 * 
 * ROUTES:
 * - GET  /billing/account  - Get billing account + wallet balance
 * - POST /billing/setup    - Create billing account + wallet + Cashfree customer
 * - GET  /billing/invoices - List invoices
 * - GET  /billing/status   - Quick billing status check
 */

// Helper: Log billing audit event
async function logBillingAudit(
    databases: Databases,
    billingAccountId: string,
    eventType: BillingAuditEventType,
    options: {
        actorUserId?: string;
        metadata?: Record<string, unknown>;
        invoiceId?: string;
        cashfreeEventId?: string;
        ipAddress?: string;
    } = {}
) {
    try {
        await databases.createDocument(
            DATABASE_ID,
            BILLING_AUDIT_LOGS_ID,
            ID.unique(),
            {
                billingAccountId,
                eventType,
                metadata: options.metadata ? JSON.stringify(options.metadata) : null,
                actorUserId: options.actorUserId || null,
                invoiceId: options.invoiceId || null,
                cashfreeEventId: options.cashfreeEventId || null,
                ipAddress: options.ipAddress || null,
            }
        );
    } catch {
        // Don't throw - audit failures shouldn't block operations
    }
}

// Helper: Calculate next billing cycle dates
function calculateBillingCycle(startDate?: Date): { start: string; end: string } {
    const now = startDate || new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return {
        start: start.toISOString(),
        end: end.toISOString(),
    };
}

const app = new Hono()
    /**
     * GET /billing/account
     * Get billing account for current user or organization
     * Includes wallet balance information
     */
    .get(
        "/account",
        sessionMiddleware,
        zValidator("query", getBillingAccountSchema),
        async (c) => {
            const user = c.get("user");
            const { userId, organizationId } = c.req.valid("query");

            const { databases: adminDatabases } = await createAdminClient();

            const queryUserId = userId || (organizationId ? undefined : user.$id);
            const queryOrgId = organizationId;

            let queries = [];
            if (queryOrgId) {
                queries = [
                    Query.equal("organizationId", queryOrgId),
                    Query.equal("type", BillingAccountType.ORG),
                ];
            } else if (queryUserId) {
                queries = [
                    Query.equal("userId", queryUserId),
                    Query.equal("type", BillingAccountType.PERSONAL),
                ];
            } else {
                return c.json({ error: "userId or organizationId required" }, 400);
            }

            const billingAccounts = await adminDatabases.listDocuments<BillingAccount>(
                DATABASE_ID,
                BILLING_ACCOUNTS_ID,
                [...queries, Query.limit(1)]
            );

            if (billingAccounts.total === 0) {
                return c.json({
                    data: null,
                    needsSetup: true,
                });
            }

            const account = billingAccounts.documents[0];

            // Get wallet balance
            let walletBalance = 0;
            let walletLockedBalance = 0;
            try {
                const walletQuery = queryOrgId
                    ? [Query.equal("organizationId", queryOrgId)]
                    : [Query.equal("userId", queryUserId!)];

                const wallets = await adminDatabases.listDocuments<Wallet>(
                    DATABASE_ID,
                    WALLETS_ID,
                    [...walletQuery, Query.limit(1)]
                );

                if (wallets.total > 0) {
                    walletBalance = wallets.documents[0].balance;
                    walletLockedBalance = wallets.documents[0].lockedBalance;
                }
            } catch {
                // Wallet not found, balance = 0
            }

            // Calculate days until suspension if in DUE status
            let daysUntilSuspension: number | undefined;
            if (account.billingStatus === BillingStatus.DUE && account.gracePeriodEnd) {
                const gracePeriodEnd = new Date(account.gracePeriodEnd);
                const now = new Date();
                daysUntilSuspension = Math.max(
                    0,
                    Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                );
            }

            return c.json({
                data: account,
                walletBalance,
                walletLockedBalance,
                availableBalance: walletBalance - walletLockedBalance,
                needsSetup: false,
                daysUntilSuspension,
                currency: BILLING_CURRENCY,
            });
        }
    )

    /**
     * POST /billing/setup
     * Create billing account, Cashfree customer, and wallet
     * 
     * WALLET-ONLY: No mandate setup. Creates wallet with zero balance.
     * User tops up their wallet via the wallet routes.
     */
    .post(
        "/setup",
        sessionMiddleware,
        zValidator("json", setupBillingSchema),
        async (c) => {
            const user = c.get("user");
            const { type, userId, organizationId, billingEmail: providedEmail, contactName, contactPhone } = c.req.valid("json");

            // Use provided email, or fall back to logged-in user's email (org owner / workspace owner)
            const billingEmail = providedEmail || user.email;

            if (!billingEmail) {
                return c.json({ error: "Billing email is required" }, 400);
            }

            // Verify authorization
            if (type === BillingAccountType.PERSONAL && userId !== user.$id) {
                return c.json({ error: "Cannot create billing for another user" }, 403);
            }

            const { databases: adminDatabases } = await createAdminClient();

            // Check if billing account already exists
            const queries = type === BillingAccountType.ORG
                ? [Query.equal("organizationId", organizationId!), Query.equal("type", type)]
                : [Query.equal("userId", userId!), Query.equal("type", type)];

            const existing = await adminDatabases.listDocuments(
                DATABASE_ID,
                BILLING_ACCOUNTS_ID,
                [...queries, Query.limit(1)]
            );

            if (existing.total > 0) {
                return c.json({
                    data: existing.documents[0],
                });
            }

            // Create Cashfree customer
            let cashfreeCustomer;
            try {
                cashfreeCustomer = await createCustomer({
                    name: contactName,
                    email: billingEmail,
                    contact: contactPhone,
                    notes: {
                        fairlx_type: type,
                        fairlx_entity_id: type === BillingAccountType.ORG ? organizationId! : userId!,
                        fairlx_user_id: user.$id,
                    },
                });
            } catch {
                return c.json({ error: "Failed to create payment customer" }, 500);
            }

            // Calculate billing cycle
            const { start, end } = calculateBillingCycle();

            // Create billing account (wallet-only, no mandates)
            const billingAccount = await adminDatabases.createDocument<BillingAccount>(
                DATABASE_ID,
                BILLING_ACCOUNTS_ID,
                ID.unique(),
                {
                    type,
                    userId: type === BillingAccountType.PERSONAL ? userId : null,
                    organizationId: type === BillingAccountType.ORG ? organizationId : null,
                    ownerId: type === BillingAccountType.ORG ? organizationId! : userId!,
                    ownerType: type === BillingAccountType.ORG ? "organization" : "personal",
                    cashfreeCustomerId: cashfreeCustomer.id,
                    billingStatus: BillingStatus.ACTIVE,
                    billingCycleStart: start,
                    billingCycleEnd: end,
                    billingEmail,
                }
            );

            // Create wallet for the account
            try {
                await getOrCreateWallet(adminDatabases, {
                    userId: type === BillingAccountType.PERSONAL ? userId : undefined,
                    organizationId: type === BillingAccountType.ORG ? organizationId : undefined,
                    billingAccountId: billingAccount.$id,
                    currency: BILLING_CURRENCY,
                });
            } catch {
                // Wallet creation failed, but billing account was created.
                // The wallet will be created on first top-up attempt.
            }

            // Log audit event
            await logBillingAudit(
                adminDatabases,
                billingAccount.$id,
                BillingAuditEventType.BILLING_ACCOUNT_CREATED,
                {
                    actorUserId: user.$id,
                    metadata: {
                        cashfreeCustomerId: cashfreeCustomer.id,
                        billingEmail,
                        type,
                    },
                }
            );

            return c.json({ data: billingAccount });
        }
    )

    /**
     * GET /billing/invoices
     * List invoices for billing account
     */
    .get(
        "/invoices",
        sessionMiddleware,
        zValidator("query", getInvoicesSchema),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const { billingAccountId, userId, organizationId, status, limit, offset } = c.req.valid("query");

            const queries: ReturnType<typeof Query.equal>[] = [];

            if (billingAccountId) {
                queries.push(Query.equal("billingAccountId", billingAccountId));
            } else if (organizationId) {
                queries.push(Query.equal("billingEntityId", organizationId));
                queries.push(Query.equal("billingEntityType", "organization"));
            } else if (userId) {
                queries.push(Query.equal("billingEntityId", userId));
                queries.push(Query.equal("billingEntityType", "user"));
            } else {
                // Default to current user
                queries.push(Query.equal("billingEntityId", user.$id));
            }

            if (status) {
                queries.push(Query.equal("status", status));
            }

            queries.push(Query.orderDesc("$createdAt"));
            queries.push(Query.limit(limit));
            queries.push(Query.offset(offset));

            const invoices = await databases.listDocuments<BillingInvoice>(
                DATABASE_ID,
                INVOICES_ID,
                queries
            );

            return c.json({
                data: {
                    documents: invoices.documents,
                    total: invoices.total,
                }
            });
        }
    )

    /**
     * GET /billing/status
     * Quick check of billing status (for frontend polling)
     */
    .get(
        "/status",
        sessionMiddleware,
        zValidator("query", getBillingAccountSchema),
        async (c) => {
            const user = c.get("user");
            const { userId, organizationId } = c.req.valid("query");

            const { databases: adminDatabases } = await createAdminClient();

            const queryUserId = userId || (organizationId ? undefined : user.$id);
            const queryOrgId = organizationId;

            let queries = [];
            if (queryOrgId) {
                queries = [
                    Query.equal("organizationId", queryOrgId),
                    Query.equal("type", BillingAccountType.ORG),
                ];
            } else if (queryUserId) {
                queries = [
                    Query.equal("userId", queryUserId),
                    Query.equal("type", BillingAccountType.PERSONAL),
                ];
            } else {
                return c.json({ status: BillingStatus.ACTIVE, needsSetup: true });
            }

            const billingAccounts = await adminDatabases.listDocuments<BillingAccount>(
                DATABASE_ID,
                BILLING_ACCOUNTS_ID,
                [...queries, Query.limit(1)]
            );

            if (billingAccounts.total === 0) {
                return c.json({ status: BillingStatus.ACTIVE, needsSetup: true });
            }

            const account = billingAccounts.documents[0];
            let daysUntilSuspension: number | undefined;

            if (account.billingStatus === BillingStatus.DUE && account.gracePeriodEnd) {
                const gracePeriodEnd = new Date(account.gracePeriodEnd);
                const now = new Date();
                daysUntilSuspension = Math.max(
                    0,
                    Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                );
            }

            // Get wallet balance for status
            let walletBalance = 0;
            try {
                const walletQuery = queryOrgId
                    ? [Query.equal("organizationId", queryOrgId)]
                    : [Query.equal("userId", queryUserId!)];

                const wallets = await adminDatabases.listDocuments<Wallet>(
                    DATABASE_ID,
                    WALLETS_ID,
                    [...walletQuery, Query.limit(1)]
                );

                if (wallets.total > 0) {
                    walletBalance = wallets.documents[0].balance;
                }
            } catch {
                // Wallet not found
            }

            return c.json({
                status: account.billingStatus,
                needsSetup: false,
                walletBalance,
                daysUntilSuspension,
                gracePeriodEnd: account.gracePeriodEnd,
            });
        }
    );

export default app;
