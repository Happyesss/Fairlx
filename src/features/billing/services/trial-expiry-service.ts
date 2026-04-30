import "server-only";

import { Query, Databases } from "node-appwrite";

import {
    DATABASE_ID,
    ORGANIZATIONS_ID,
    BILLING_ACCOUNTS_ID,
    BILLING_AUDIT_LOGS_ID,
    WALLETS_ID,
    ORGANIZATION_MEMBERS_ID,
} from "@/config";
import { createAdminClient } from "@/lib/appwrite";
import { invalidateCache, CK } from "@/lib/redis";

import {
    BillingStatus,
    BillingAccountType,
    BillingAccount,
    BillingAuditEventType,
} from "../types";

import { Wallet, WalletStatus } from "@/features/wallet/types";

/**
 * Trial Expiry Service
 *
 * Handles the daily cron check for expired organization trials
 * and the unlock-after-payment path triggered by webhook.
 *
 * INVARIANTS:
 * - An org is locked ONLY when ALL three conditions are met:
 *   1. trialCreditExpiresAt is in the past
 *   2. No active cashfreeCustomerId (no billing method connected)
 *   3. Wallet balance <= 0
 * - Locking sets billingStatus → SUSPENDED and billingFrozenAt on the org
 * - Unlocking reverses both and invalidates lifecycle cache for all members
 */

// ============================================================================
// DAILY CRON: Check & Expire Trials
// ============================================================================

/**
 * checkAndExpireOrgTrials
 *
 * Called daily by cron. Finds orgs with expired trial credits
 * that haven't set up billing and have no wallet balance.
 * Locks them by setting billingStatus → SUSPENDED.
 */
export async function checkAndExpireOrgTrials(): Promise<{
    checked: number;
    locked: string[];
    skipped: string[];
    errors: string[];
}> {
    const { databases } = await createAdminClient();
    const now = new Date().toISOString();

    const results = {
        checked: 0,
        locked: [] as string[],
        skipped: [] as string[],
        errors: [] as string[],
    };

    // Find organizations where:
    // - trial credit was granted
    // - trial has NOT already been marked expired (avoid re-processing)
    // - trialCreditExpiresAt is in the past
    const expiredOrgs = await databases.listDocuments(
        DATABASE_ID,
        ORGANIZATIONS_ID,
        [
            Query.equal("trialCreditGranted", true),
            Query.equal("isTrialExpired", false),
            Query.lessThanEqual("trialCreditExpiresAt", now),
            Query.limit(200),
        ]
    );

    results.checked = expiredOrgs.total;

    for (const org of expiredOrgs.documents) {
        try {
            const shouldLock = await shouldLockOrganization(databases, org.$id);

            if (!shouldLock) {
                results.skipped.push(org.$id);
                // Mark trial as expired but don't lock (they have billing/balance)
                await databases.updateDocument(
                    DATABASE_ID,
                    ORGANIZATIONS_ID,
                    org.$id,
                    { isTrialExpired: true }
                );
                continue;
            }

            // LOCK the organization
            await lockOrganization(databases, org.$id);
            results.locked.push(org.$id);
        } catch (error) {
            results.errors.push(
                `${org.$id}: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    return results;
}

// ============================================================================
// LOCK / UNLOCK HELPERS
// ============================================================================

/**
 * Check whether an organization should be locked.
 *
 * Returns false (skip locking) if the org has:
 * - An active cashfreeCustomerId (billing method connected), OR
 * - A wallet balance > 0
 */
async function shouldLockOrganization(
    databases: Databases,
    organizationId: string
): Promise<boolean> {
    // 1. Check for connected billing method
    const billingAccounts = await databases.listDocuments<BillingAccount>(
        DATABASE_ID,
        BILLING_ACCOUNTS_ID,
        [
            Query.equal("organizationId", organizationId),
            Query.equal("type", BillingAccountType.ORG),
            Query.limit(1),
        ]
    );

    if (billingAccounts.total > 0) {
        const account = billingAccounts.documents[0];
        // If they have a Cashfree customer ID, they've connected billing
        if (account.cashfreeCustomerId) {
            return false;
        }
    }

    // 2. Check wallet balance
    const wallets = await databases.listDocuments<Wallet>(
        DATABASE_ID,
        WALLETS_ID,
        [
            Query.equal("organizationId", organizationId),
            Query.limit(1),
        ]
    );

    if (wallets.total > 0 && wallets.documents[0].balance > 0) {
        return false;
    }

    // No billing method AND no wallet balance → lock
    return true;
}

/**
 * Lock an organization after trial expiry.
 *
 * Sets billingStatus → SUSPENDED, freezes the wallet,
 * marks isTrialExpired, and invalidates lifecycle caches for all members.
 */
async function lockOrganization(
    databases: Databases,
    organizationId: string
): Promise<void> {
    const now = new Date().toISOString();

    // 1. Update org document
    await databases.updateDocument(
        DATABASE_ID,
        ORGANIZATIONS_ID,
        organizationId,
        {
            isTrialExpired: true,
            billingFrozenAt: now,
        }
    );

    // 2. Suspend billing account
    const billingAccounts = await databases.listDocuments<BillingAccount>(
        DATABASE_ID,
        BILLING_ACCOUNTS_ID,
        [
            Query.equal("organizationId", organizationId),
            Query.equal("type", BillingAccountType.ORG),
            Query.limit(1),
        ]
    );

    if (billingAccounts.total > 0) {
        await databases.updateDocument(
            DATABASE_ID,
            BILLING_ACCOUNTS_ID,
            billingAccounts.documents[0].$id,
            { billingStatus: BillingStatus.SUSPENDED }
        );
    }

    // 3. Freeze wallet
    const wallets = await databases.listDocuments<Wallet>(
        DATABASE_ID,
        WALLETS_ID,
        [
            Query.equal("organizationId", organizationId),
            Query.limit(1),
        ]
    );

    if (wallets.total > 0) {
        await databases.updateDocument(
            DATABASE_ID,
            WALLETS_ID,
            wallets.documents[0].$id,
            { status: WalletStatus.FROZEN }
        );
    }

    // 4. Audit log
    const billingAccountId = billingAccounts.total > 0
        ? billingAccounts.documents[0].$id
        : null;

    await databases.createDocument(
        DATABASE_ID,
        BILLING_AUDIT_LOGS_ID,
        (await import("node-appwrite")).ID.unique(),
        {
            billingAccountId,
            eventType: BillingAuditEventType.ACCOUNT_SUSPENDED,
            metadata: JSON.stringify({
                reason: "Trial credit expired",
                organizationId,
                lockedAt: now,
            }),
        }
    );

    // 5. Invalidate lifecycle cache for ALL org members
    await invalidateOrgMemberCaches(databases, organizationId);
}

/**
 * unlockOrgAfterPayment
 *
 * Called after a successful wallet top-up (via webhook) to restore
 * an org that was locked due to trial expiry.
 *
 * IDEMPOTENT: safe to call even if the org is not currently locked.
 */
export async function unlockOrgAfterPayment(
    organizationId: string
): Promise<{ unlocked: boolean }> {
    const { databases } = await createAdminClient();

    // Check if org is actually locked (has billingFrozenAt set)
    const org = await databases.getDocument(
        DATABASE_ID,
        ORGANIZATIONS_ID,
        organizationId
    );

    if (!org.billingFrozenAt) {
        // Not locked — nothing to do
        return { unlocked: false };
    }

    // 1. Clear org lock fields
    await databases.updateDocument(
        DATABASE_ID,
        ORGANIZATIONS_ID,
        organizationId,
        {
            billingFrozenAt: null,
            // Keep isTrialExpired = true — the trial IS expired,
            // but the org is no longer locked because they paid.
        }
    );

    // 2. Restore billing account
    const billingAccounts = await databases.listDocuments<BillingAccount>(
        DATABASE_ID,
        BILLING_ACCOUNTS_ID,
        [
            Query.equal("organizationId", organizationId),
            Query.equal("type", BillingAccountType.ORG),
            Query.limit(1),
        ]
    );

    if (billingAccounts.total > 0) {
        const account = billingAccounts.documents[0];
        if (account.billingStatus === BillingStatus.SUSPENDED) {
            await databases.updateDocument(
                DATABASE_ID,
                BILLING_ACCOUNTS_ID,
                account.$id,
                {
                    billingStatus: BillingStatus.ACTIVE,
                    gracePeriodEnd: null,
                    lastPaymentAt: new Date().toISOString(),
                }
            );

            // Audit log for restoration
            await databases.createDocument(
                DATABASE_ID,
                BILLING_AUDIT_LOGS_ID,
                (await import("node-appwrite")).ID.unique(),
                {
                    billingAccountId: account.$id,
                    eventType: BillingAuditEventType.ACCOUNT_RESTORED,
                    metadata: JSON.stringify({
                        reason: "Wallet topped up after trial expiry",
                        organizationId,
                    }),
                }
            );
        }
    }

    // 3. Unfreeze wallet
    const wallets = await databases.listDocuments<Wallet>(
        DATABASE_ID,
        WALLETS_ID,
        [
            Query.equal("organizationId", organizationId),
            Query.limit(1),
        ]
    );

    if (wallets.total > 0 && wallets.documents[0].status === WalletStatus.FROZEN) {
        await databases.updateDocument(
            DATABASE_ID,
            WALLETS_ID,
            wallets.documents[0].$id,
            { status: WalletStatus.ACTIVE }
        );
    }

    // 4. Invalidate lifecycle cache for ALL org members
    await invalidateOrgMemberCaches(databases, organizationId);

    return { unlocked: true };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Invalidate lifecycle caches for all members of an organization.
 * This ensures immediate access state updates (lock or unlock)
 * without waiting for the 2-minute cache TTL.
 */
async function invalidateOrgMemberCaches(
    databases: Databases,
    organizationId: string
): Promise<void> {
    try {
        const members = await databases.listDocuments(
            DATABASE_ID,
            ORGANIZATION_MEMBERS_ID,
            [
                Query.equal("organizationId", organizationId),
                Query.limit(500),
            ]
        );

        if (members.total > 0) {
            const cacheKeys = members.documents.map(
                (m) => CK.authLifecycle(m.userId as string)
            );
            await invalidateCache(...cacheKeys);
        }
    } catch (error) {
        console.error("[trial-expiry] Failed to invalidate member caches:", error);
        // Non-blocking — caches will expire naturally within 2 minutes
    }
}
