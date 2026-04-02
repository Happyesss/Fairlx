import "server-only";

import { Databases } from "node-appwrite";

import { createAdminClient } from "@/lib/appwrite";
import { BillingAuditEventType } from "@/features/billing/types";
import {
    getOrCreateWallet,
    topUpWallet,
    getWalletBalance,
} from "@/features/wallet/services/wallet-service";

import { redeemCouponSchema } from "../schemas";
import type { RedeemCouponResponse } from "../types";
import { EVENT_GITHUB_REWARD_REDEEMED } from "../types";
import {
    CouponNotFoundError,
    CouponExpiredError,
    CouponAlreadyRedeemedError,
    CouponInvalidAmountError,
    CouponSuspendedError,
    CouponRateLimitError,
    CouponInvalidError,
} from "./errors";
import {
    findCouponByCode,
    redeemCouponInLandingDB,
    countRecentFailedAttempts,
    insertAuditLog,
    isUserSuspended,
    createRewardNotification,
} from "./repository";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum failed attempts per user per hour */
const MAX_FAILED_ATTEMPTS_PER_HOUR = 5;

// ============================================================================
// CORE BUSINESS LOGIC
// ============================================================================

/**
 * Redeem a GitHub Star Reward Coupon
 *
 * This is the core orchestrator that:
 * 1. Validates input (Zod)
 * 2. Rate-limits failed attempts
 * 3. Fetches coupon from Landing Supabase DB
 * 4. Validates coupon eligibility
 * 5. Acquires distributed lock (idempotency)
 * 6. Atomically redeems in Landing DB
 * 7. Credits wallet in Main App (Appwrite)
 * 8. Creates audit log + notification
 * 9. Returns structured response
 *
 * INVARIANTS:
 * - All wallet credits go through topUpWallet() — NO direct balance mutation
 * - If landing DB redemption succeeds but wallet credit fails, the lock prevents
 *   re-processing, and the audit log captures the failure for manual resolution
 * - Notification and audit log failures do NOT roll back the credit
 *
 * @param userId - Authenticated user's ID (from session)
 * @param input  - { code: string } — the coupon code
 * @returns RedeemCouponResponse on success
 * @throws CouponError subclass on failure
 */
export async function redeemCoupon(
    userId: string,
    userName: string,
    input: { code: string; workspaceId?: string; organizationId?: string }
): Promise<RedeemCouponResponse> {
    // ------------------------------------------------------------------
    // 1. VALIDATE INPUT
    // ------------------------------------------------------------------
    const parsed = redeemCouponSchema.safeParse(input);
    if (!parsed.success) {
        throw new CouponInvalidError(
            parsed.error.errors[0]?.message || "Invalid coupon code"
        );
    }

    const { code } = parsed.data;
    const { databases, users } = await createAdminClient();

    // Get user preferences to determine account type and primary organization
    const userDoc = await users.get(userId);
    const userPrefs = (userDoc.prefs || {}) as { accountType?: string; primaryOrganizationId?: string };
    const isOrgAccount = userPrefs.accountType === "ORG";
    const primaryOrganizationId = userPrefs.primaryOrganizationId;

    // Resolve wallet identity: 
    // - If it's an ORG account, we use the primaryOrganizationId or the workspace's organizationId
    // - If it's a PERSONAL account, we always use the userId (personal wallet)
    const walletOptions = isOrgAccount && primaryOrganizationId
        ? { organizationId: primaryOrganizationId }
        : { userId };

    // ------------------------------------------------------------------
    // 2. RATE LIMIT CHECK
    // ------------------------------------------------------------------
    const failedAttempts = await countRecentFailedAttempts(databases, userId);
    if (failedAttempts >= MAX_FAILED_ATTEMPTS_PER_HOUR) {
        throw new CouponRateLimitError();
    }

    // ------------------------------------------------------------------
    // 3. FETCH COUPON FROM LANDING SUPABASE
    // ------------------------------------------------------------------
    const coupon = await findCouponByCode(code);
    if (!coupon) {
        await logFailedAttempt(databases, userId, code, "COUPON_NOT_FOUND");
        throw new CouponNotFoundError();
    }

    // ------------------------------------------------------------------
    // 4. PRE-VALIDATION (BEFORE LOCK)
    // ------------------------------------------------------------------

    // 4a. Check if already redeemed
    if (coupon.redeemed_at) {
        await logFailedAttempt(databases, userId, code, "ALREADY_REDEEMED");
        throw new CouponAlreadyRedeemedError();
    }

    // 4b. Check if expired
    if (coupon.is_expired) {
        await logFailedAttempt(databases, userId, code, "EXPIRED");
        throw new CouponExpiredError();
    }

    // 4c. Validate reward amount
    if (!coupon.credit_amount || coupon.credit_amount <= 0) {
        await logFailedAttempt(databases, userId, code, "INVALID_AMOUNT");
        throw new CouponInvalidAmountError();
    }

    // 4d. Check if user's billing account is suspended
    const suspended = await isUserSuspended(databases, userId);
    if (suspended) {
        await logFailedAttempt(databases, userId, code, "ACCOUNT_SUSPENDED");
        throw new CouponSuspendedError();
    }

    // ------------------------------------------------------------------
    // 5. ACQUIRE DISTRIBUTED LOCK (IDEMPOTENCY)
    // ------------------------------------------------------------------
    const { acquireProcessingLock, releaseProcessingLock } = await import(
        "@/lib/processed-events-registry"
    );
    const lockKey = `github_reward_redeem:${code}`;

    const lockAcquired = await acquireProcessingLock(databases, lockKey, "github_rewards");
    if (!lockAcquired) {
        // Already processed — idempotent response
        // Fetch current wallet balance to return
        const wallet = await getOrCreateWallet(databases, walletOptions);
        const balance = await getWalletBalance(databases, wallet.$id);
        return {
            success: true,
            creditedAmount: coupon.credit_amount,
            newWalletBalance: balance.balance,
            transactionId: "already_processed",
        };
    }

    try {
        // ------------------------------------------------------------------
        // 6. DOUBLE-CHECK COUPON (POST-LOCK)
        // Re-fetch to ensure nobody redeemed between our check and lock
        // ------------------------------------------------------------------
        const freshCoupon = await findCouponByCode(code);
        if (!freshCoupon || freshCoupon.redeemed_at || freshCoupon.is_expired) {
            await releaseProcessingLock(databases, lockKey, "github_rewards");
            throw new CouponAlreadyRedeemedError(
                "Coupon was redeemed by another process"
            );
        }

        // ------------------------------------------------------------------
        // 7. ATOMICALLY REDEEM IN LANDING DB
        // ------------------------------------------------------------------
        const rpcResult = await redeemCouponInLandingDB(code);
        if (!rpcResult.success) {
            await releaseProcessingLock(databases, lockKey, "github_rewards");
            await logFailedAttempt(databases, userId, code, `RPC_FAILED: ${rpcResult.message}`);
            throw new CouponAlreadyRedeemedError(rpcResult.message);
        }

        // ------------------------------------------------------------------
        // 8. CREDIT WALLET (APPWRITE)
        // ------------------------------------------------------------------
        const creditAmountUSD = freshCoupon.credit_amount;

        const wallet = await getOrCreateWallet(databases, walletOptions);
        const topupResult = await topUpWallet(databases, wallet.$id, creditAmountUSD, {
            idempotencyKey: `github_reward:${code}`,
            paymentId: `github_reward_${freshCoupon.id}`,
            description: `GitHub Star Reward: ${code} ($${freshCoupon.credit_amount.toFixed(6)})`,
        });

        if (!topupResult.success && topupResult.error !== "already_processed") {
            // Wallet credit failed — this is a critical issue.
            // The coupon was already marked redeemed in Supabase.
            // Log for manual resolution.
            console.error(
                `[github-rewards] CRITICAL: Coupon ${code} redeemed in landing DB but wallet credit failed:`,
                topupResult.error
            );
            await insertAuditLog(databases, {
                eventType: BillingAuditEventType.GITHUB_REWARD_FAILED,
                actorUserId: userId,
                metadata: {
                    couponCode: code,
                    couponId: freshCoupon.id,
                    error: topupResult.error,
                    phase: "WALLET_CREDIT_FAILED",
                    requiresManualResolution: true,
                },
            });
            throw new Error(
                `Wallet credit failed after coupon redemption. Support has been notified. Error: ${topupResult.error}`
            );
        }

        // ------------------------------------------------------------------
        // 9. AUDIT LOG (APPWRITE)
        // ------------------------------------------------------------------
        await insertAuditLog(databases, {
            eventType: BillingAuditEventType.GITHUB_REWARD_REDEEMED,
            actorUserId: userId,
            metadata: {
                event: EVENT_GITHUB_REWARD_REDEEMED,
                couponCode: code,
                couponId: freshCoupon.id,
                githubUsername: freshCoupon.github_username,
                creditAmountUSD: freshCoupon.credit_amount,
                walletId: wallet.$id,
                transactionId: topupResult.transaction?.$id,
            },
        });

        // ------------------------------------------------------------------
        // 10. NOTIFICATION (APPWRITE)
        // ------------------------------------------------------------------
        await createRewardNotification(databases, {
            userId,
            userName,
            creditAmount: freshCoupon.credit_amount,
            workspaceId: input.workspaceId || input.organizationId || "system",
        });

        // ------------------------------------------------------------------
        // 11. RETURN SUCCESS
        // ------------------------------------------------------------------
        const finalBalance = await getWalletBalance(databases, wallet.$id);

        return {
            success: true,
            creditedAmount: creditAmountUSD,
            newWalletBalance: finalBalance.balance,
            transactionId: topupResult.transaction?.$id || "already_processed",
        };
    } catch (error) {
        // If the error is one of our known CouponErrors that was thrown
        // AFTER lock acquisition (e.g., from the double-check), we've already
        // released the lock in those paths. For unexpected errors, release here.
        if (!(error instanceof CouponAlreadyRedeemedError)) {
            try {
                await releaseProcessingLock(databases, lockKey, "github_rewards");
            } catch {
                // Lock release failure is non-fatal
            }
        }
        throw error;
    }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Log a failed redemption attempt for rate limiting and suspicious activity tracking.
 */
async function logFailedAttempt(
    databases: Databases,
    userId: string,
    code: string,
    reason: string
): Promise<void> {
    await insertAuditLog(databases, {
        eventType: BillingAuditEventType.GITHUB_REWARD_FAILED,
        actorUserId: userId,
        metadata: {
            couponCode: code,
            reason,
            timestamp: new Date().toISOString(),
        },
    });
}
