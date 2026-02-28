import "server-only";

import { createClient } from "@supabase/supabase-js";
import { Databases, Query, ID } from "node-appwrite";

import {
    DATABASE_ID,
    BILLING_ACCOUNTS_ID,
    BILLING_AUDIT_LOGS_ID,
} from "@/config";

import {
    LANDING_SUPABASE_URL,
    LANDING_SUPABASE_SERVICE_ROLE_KEY,
} from "@/config.server";

import { BillingAccount, BillingStatus, BillingAuditEventType } from "@/features/billing/types";

import type { GitHubRewardCoupon, RedeemCouponRpcResult } from "../types";

// ============================================================================
// LANDING SUPABASE CLIENT
// ============================================================================

/**
 * Create a Supabase client connecting to the Landing Page database.
 *
 * Uses the service role key for full read/write access to
 * the `github_star_coupons` table.
 *
 * This client is created per-request (no global singleton)
 * to avoid stale connections in serverless environments.
 */
function getLandingSupabase() {
    if (!LANDING_SUPABASE_URL || !LANDING_SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error(
            "Landing Supabase credentials not configured. " +
            "Set LANDING_SUPABASE_URL and LANDING_SUPABASE_SERVICE_ROLE_KEY."
        );
    }

    return createClient(LANDING_SUPABASE_URL, LANDING_SUPABASE_SERVICE_ROLE_KEY);
}

// ============================================================================
// COUPON QUERIES (SUPABASE — LANDING DB)
// ============================================================================

/**
 * Fetch a coupon from the landing page's Supabase DB by coupon code.
 *
 * @returns The coupon row or null if not found.
 */
export async function findCouponByCode(
    code: string
): Promise<GitHubRewardCoupon | null> {
    const supabase = getLandingSupabase();

    // console.log("[github-rewards] Looking up coupon:", code);
    // console.log("[github-rewards] Supabase URL:", LANDING_SUPABASE_URL);

    const { data, error } = await supabase
        .from("github_star_coupons")
        .select("*")
        .eq("coupon_code", code)
        .single();

    // console.log("[github-rewards] Supabase response:", { data, error });

    if (error || !data) {
        return null;
    }

    return data as GitHubRewardCoupon;
}

/**
 * Atomically redeem a coupon in the landing page's Supabase DB.
 *
 * Calls the `redeem_coupon` PostgreSQL RPC function which:
 * - Checks coupon exists
 * - Checks not already redeemed
 * - Checks not expired
 * - Sets `redeemed_at` = NOW()
 * - Returns success/failure
 *
 * This is atomic at the database level (PostgreSQL transaction).
 */
export async function redeemCouponInLandingDB(
    code: string
): Promise<RedeemCouponRpcResult> {
    const supabase = getLandingSupabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)("redeem_coupon", {
        p_coupon_code: code,
    });

    if (error) {
        console.error("[github-rewards] Supabase redeem_coupon RPC error:", error);
        throw new Error(`Landing DB redemption failed: ${error.message}`);
    }

    // The RPC returns an array with one row
    const result = data?.[0] as RedeemCouponRpcResult | undefined;

    if (!result) {
        throw new Error("Landing DB returned empty result from redeem_coupon RPC");
    }

    return result;
}

// ============================================================================
// RATE LIMITING (APPWRITE — MAIN DB)
// ============================================================================

/**
 * Count recent failed redemption attempts for a user.
 *
 * Uses the billing audit log to check for GITHUB_REWARD_FAILED events
 * in the last hour. Returns the count.
 */
export async function countRecentFailedAttempts(
    databases: Databases,
    userId: string
): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    try {
        const result = await databases.listDocuments(
            DATABASE_ID,
            BILLING_AUDIT_LOGS_ID,
            [
                Query.equal("actorUserId", userId),
                Query.equal("eventType", BillingAuditEventType.GITHUB_REWARD_FAILED),
                Query.greaterThan("$createdAt", oneHourAgo),
                Query.limit(10),
            ]
        );

        return result.total;
    } catch {
        // If billing audit logs collection doesn't exist or query fails,
        // don't block redemption — just return 0
        return 0;
    }
}

// ============================================================================
// AUDIT LOGGING (APPWRITE — MAIN DB)
// ============================================================================

/**
 * Insert a billing audit log entry for a github reward event.
 */
export async function insertAuditLog(
    databases: Databases,
    params: {
        billingAccountId?: string;
        eventType: BillingAuditEventType;
        actorUserId: string;
        metadata?: Record<string, unknown>;
    }
): Promise<void> {
    try {
        await databases.createDocument(
            DATABASE_ID,
            BILLING_AUDIT_LOGS_ID,
            ID.unique(),
            {
                billingAccountId: params.billingAccountId || "N/A",
                eventType: params.eventType,
                actorUserId: params.actorUserId,
                metadata: JSON.stringify(params.metadata || {}),
            }
        );
    } catch (error) {
        // Audit log failure should not break the redemption flow
        console.error("[github-rewards] Failed to insert audit log:", error);
    }
}

// ============================================================================
// BILLING ACCOUNT CHECK (APPWRITE — MAIN DB)
// ============================================================================

/**
 * Check if the user's billing account is suspended.
 *
 * @returns true if suspended, false otherwise
 */
export async function isUserSuspended(
    databases: Databases,
    userId: string
): Promise<boolean> {
    try {
        const result = await databases.listDocuments<BillingAccount>(
            DATABASE_ID,
            BILLING_ACCOUNTS_ID,
            [
                Query.equal("userId", userId),
                Query.limit(1),
            ]
        );

        if (result.total === 0) {
            // No billing account = not suspended
            return false;
        }

        return result.documents[0].billingStatus === BillingStatus.SUSPENDED;
    } catch {
        // If billing account doesn't exist, user is not suspended
        return false;
    }
}

// ============================================================================
// NOTIFICATION (APPWRITE — MAIN DB)
// ============================================================================

import { createRewardRedeemedEvent } from "@/lib/notifications/events";
import { dispatchWorkitemEvent } from "@/lib/notifications/dispatcher";

/**
 * Create a notification for the user about the reward credit.
 */
export async function createRewardNotification(
    _databases: Databases,
    params: {
        userId: string;
        userName: string;
        creditAmount: number;
        workspaceId?: string;
    }
): Promise<void> {
    try {
        const event = createRewardRedeemedEvent(
            params.userId,
            params.userName,
            params.creditAmount,
            params.workspaceId
        );

        await dispatchWorkitemEvent(event);
    } catch (error) {
        // Notification failure should not break the redemption flow
        console.error("[github-rewards] Failed to dispatch notification:", error);
    }
}
