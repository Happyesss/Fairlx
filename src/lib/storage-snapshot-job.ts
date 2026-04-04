import "server-only";

import { Databases, Query, ID, Models } from "node-appwrite";
import {
    DATABASE_ID,
    STORAGE_SNAPSHOTS_ID,
    ATTACHMENTS_ID,
    WORKSPACES_ID,
} from "@/config";
import { StorageDailySnapshot } from "@/features/usage/types";

/**
 * Storage Snapshot Job
 * 
 * WHY: Storage billing requires time-weighted calculation (GB-month).
 * Point-in-time snapshots don't reflect actual usage over time.
 * 
 * This job captures daily storage state per workspace, enabling
 * accurate monthly average calculation:
 * 
 *   storageAvgGB = Σ(dailyStorageGB) / daysInMonth
 * 
 * SCHEDULE: Should run at UTC day boundary (midnight)
 */

export interface StorageSnapshotResult {
    workspaceId: string;
    storageGB: number;
    date: string;
    success: boolean;
    error?: string;
}

/**
 * Capture storage snapshot for a single workspace
 * 
 * PRODUCTION HARDENING: Checks billing status before capturing.
 * Suspended accounts do not get their storage tracked.
 */
export async function captureWorkspaceStorageSnapshot(
    databases: Databases,
    workspaceId: string
): Promise<StorageSnapshotResult> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
        // PRODUCTION HARDENING: Check billing status
        const { getBillingAccount } = await import("./billing-primitives");
        const { BillingStatus } = await import("@/features/billing/types");

        const account = await getBillingAccount(databases, { workspaceId });
        if (account?.billingStatus === BillingStatus.SUSPENDED) {
            return {
                workspaceId,
                storageGB: 0,
                date: today,
                success: false,
                error: "Account suspended - skipping snapshot",
            };
        }

        // Check if snapshot already exists for today (idempotency)
        const existing = await databases.listDocuments<StorageDailySnapshot>(
            DATABASE_ID,
            STORAGE_SNAPSHOTS_ID,
            [
                Query.equal("workspaceId", workspaceId),
                Query.equal("date", today),
            ]
        );

        if (existing.total > 0) {
            // Already captured today - skip
            return {
                workspaceId,
                storageGB: existing.documents[0].storageGB,
                date: today,
                success: true,
            };
        }

        // Calculate total storage for workspace from ATTACHMENTS_ID collection
        // WHY: Efficiently sums only files belonging to this workspace.
        let totalBytes = 0;
        try {
            const attachments = await databases.listDocuments<Models.Document & { fileSize?: number }>(
                DATABASE_ID,
                ATTACHMENTS_ID,
                [
                    Query.equal("workspaceId", workspaceId),
                    Query.select(["fileSize"]),
                    Query.limit(10000), // Adjust if workspace has > 10k files
                ]
            );
            totalBytes = attachments.documents.reduce((sum: number, doc) => sum + (doc.fileSize || 0), 0);
        } catch (err) {
            console.error("[StorageSnapshot] Failed to query attachments for workspace:", workspaceId, err);
            totalBytes = 0;
        }

        const storageGB = totalBytes / (1024 * 1024 * 1024);

        // Create snapshot
        await databases.createDocument<StorageDailySnapshot>(
            DATABASE_ID,
            STORAGE_SNAPSHOTS_ID,
            ID.unique(),
            {
                workspaceId,
                storageGB,
                date: today,
            }
        );

        return {
            workspaceId,
            storageGB,
            date: today,
            success: true,
        };
    } catch (error) {
        return {
            workspaceId,
            storageGB: 0,
            date: today,
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Capture storage snapshots for all workspaces
 * 
 * WHY: Ensures consistent daily data for all billing entities
 */
export async function captureAllStorageSnapshots(
    databases: Databases
): Promise<StorageSnapshotResult[]> {
    const results: StorageSnapshotResult[] = [];

    // Get all workspaces
    const workspaces = await databases.listDocuments(
        DATABASE_ID,
        WORKSPACES_ID,
        [Query.limit(1000)]
    );

    for (const workspace of workspaces.documents) {
        const result = await captureWorkspaceStorageSnapshot(
            databases,
            workspace.$id
        );
        results.push(result);
    }

    return results;
}

/**
 * Calculate time-weighted storage average for a billing period
 * 
 * WHY: This is the correct way to bill for storage.
 * If a user uploads 100GB on day 15, they should only pay for ~half month.
 * 
 * @param period - YYYY-MM format
 */
export async function calculateTimeWeightedStorageAvg(
    databases: Databases,
    workspaceId: string,
    period: string
): Promise<number> {
    // Get all snapshots for the period
    const startDate = `${period}-01`;
    const nextMonth = new Date(period + "-01");
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const endDate = nextMonth.toISOString().split('T')[0];
    const daysInMonth = new Date(nextMonth.getTime() - 1).getDate();

    const snapshots = await databases.listDocuments<StorageDailySnapshot>(
        DATABASE_ID,
        STORAGE_SNAPSHOTS_ID,
        [
            Query.equal("workspaceId", workspaceId),
            Query.greaterThanEqual("date", startDate),
            Query.lessThan("date", endDate),
            Query.limit(31),
        ]
    );

    if (snapshots.total === 0) {
        return 0;
    }

    // Calculate average
    const sumGB = snapshots.documents.reduce((sum: number, s: StorageDailySnapshot) => sum + s.storageGB, 0);

    // Use actual snapshot count or days in month for accurate average
    // WHY: If we only have 15 snapshots, we use actual count for conservative estimate
    const divisor = Math.min(snapshots.total, daysInMonth) || 1;
    return sumGB / divisor;
}
