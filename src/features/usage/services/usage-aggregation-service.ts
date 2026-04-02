import "server-only";

import { Databases, Query, ID } from "node-appwrite";
import {
    DATABASE_ID,
    USAGE_EVENTS_ID,
    USAGE_AGGREGATIONS_ID,
} from "@/config";
import {
    UsageEvent,
    ResourceType,
} from "@/features/usage/types";

/**
 * Daily Usage Roll-Up Service
 * 
 * WHY: The /summary endpoint was fetching up to 5,000 raw events per request (~17s).
 * By pre-computing daily summaries, the dashboard only needs to fetch ~30 small records
 * per month instead of thousands of events (~500ms vs ~17s).
 * 
 * STRATEGY:
 * 1. Cron runs daily at 2 AM UTC
 * 2. Queries ALL events for the previous day (grouped by workspaceId)
 * 3. Computes totals: traffic, storage, compute, by source, by module
 * 4. Stores as daily summary documents in USAGE_AGGREGATIONS_ID
 *    (using period = "YYYY-MM-DD" instead of "YYYY-MM" for monthly)
 * 5. Deletes the processed raw events to keep the events collection small
 * 
 * SAFETY:
 * - Idempotent: checks if summary already exists for the date before creating
 * - Does NOT delete events if summary creation fails
 * - Processes one workspace at a time to limit memory usage
 */

export interface DailySummaryResult {
    date: string;
    workspacesProcessed: number;
    eventsProcessed: number;
    eventsDeleted: number;
    summariesCreated: number;
    errors: string[];
}

/**
 * Aggregate all usage events for a specific date into daily summaries.
 * Then delete the processed events.
 */
export async function aggregateDailyUsage(
    databases: Databases,
    targetDate?: string // YYYY-MM-DD, defaults to yesterday
): Promise<DailySummaryResult> {
    // Default to yesterday (UTC)
    if (!targetDate) {
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        targetDate = yesterday.toISOString().split("T")[0];
    }

    const dayStart = `${targetDate}T00:00:00.000Z`;
    const dayEnd = `${targetDate}T23:59:59.999Z`;

    const result: DailySummaryResult = {
        date: targetDate,
        workspacesProcessed: 0,
        eventsProcessed: 0,
        eventsDeleted: 0,
        summariesCreated: 0,
        errors: [],
    };

    try {
        // Step 1: Fetch ALL events for the target date
        // We use pagination since there could be more than 5000
        let allEvents: UsageEvent[] = [];
        let offset = 0;
        const batchSize = 500;
        let hasMore = true;

        while (hasMore) {
            const batch = await databases.listDocuments<UsageEvent>(
                DATABASE_ID,
                USAGE_EVENTS_ID,
                [
                    Query.greaterThanEqual("timestamp", dayStart),
                    Query.lessThanEqual("timestamp", dayEnd),
                    Query.limit(batchSize),
                    Query.offset(offset),
                ]
            );

            allEvents = allEvents.concat(batch.documents);
            offset += batchSize;
            hasMore = batch.documents.length === batchSize;
        }

        result.eventsProcessed = allEvents.length;

        if (allEvents.length === 0) {
            return result;
        }

        // Step 2: Group events by workspaceId
        const byWorkspace = new Map<string, UsageEvent[]>();
        for (const event of allEvents) {
            const wsId = event.workspaceId;
            if (!byWorkspace.has(wsId)) {
                byWorkspace.set(wsId, []);
            }
            byWorkspace.get(wsId)!.push(event);
        }

        result.workspacesProcessed = byWorkspace.size;

        // Step 3: For each workspace, create a daily summary
        for (const [workspaceId, events] of byWorkspace.entries()) {
            try {
                // Check if summary already exists (idempotency)
                const existing = await databases.listDocuments(
                    DATABASE_ID,
                    USAGE_AGGREGATIONS_ID,
                    [
                        Query.equal("workspaceId", workspaceId),
                        Query.equal("period", targetDate), // YYYY-MM-DD for daily
                        Query.limit(1),
                    ]
                );

                if (existing.total > 0) {
                    // Already aggregated, skip but still count for deletion
                    continue;
                }

                // Compute aggregates
                let trafficBytes = 0;
                let computeUnits = 0;
                const bySource: Record<string, number> = {};
                const byModule: Record<string, number> = {};

                for (const event of events) {
                    const units = event.resourceType === ResourceType.COMPUTE
                        ? (event.weightedUnits || event.units)
                        : event.units;

                    // Source breakdown
                    bySource[event.source] = (bySource[event.source] || 0) + units;

                    // Module breakdown
                    let moduleName = event.resourceType as string;
                    if (event.metadata) {
                        try {
                            const meta = typeof event.metadata === 'string'
                                ? JSON.parse(event.metadata) : event.metadata;
                            if (meta.module) moduleName = meta.module.toLowerCase();
                        } catch { /* ignore */ }
                    }
                    byModule[moduleName] = (byModule[moduleName] || 0) + units;

                    // Resource type totals
                    switch (event.resourceType) {
                        case ResourceType.TRAFFIC:
                            trafficBytes += event.units;
                            break;
                        case ResourceType.COMPUTE:
                            computeUnits += event.weightedUnits || event.units;
                            break;
                    }
                }

                // CRITICAL FIX (Bug 3): Use time-weighted daily snapshot average for storage.
                // The old approach summed raw storage-event bytes for the day, which is WRONG:
                //   - It double-counts downloads as "storage usage"
                //   - It doesn't reflect actual GB-month utilisation
                // The correct approach: average the daily point-in-time snapshot across the month.
                const { calculateTimeWeightedStorageAvg } = await import("@/lib/storage-snapshot-job");
                // targetDate is YYYY-MM-DD; the period arg for time-weighting is YYYY-MM
                const storagePeriod = targetDate.slice(0, 7); // e.g. "2025-03"
                const storageAvgGB = await calculateTimeWeightedStorageAvg(databases, workspaceId, storagePeriod);

                // Convert traffic to GB
                const trafficTotalGB = trafficBytes / (1024 * 1024 * 1024);

                // Create daily summary document
                await databases.createDocument(
                    DATABASE_ID,
                    USAGE_AGGREGATIONS_ID,
                    ID.unique(),
                    {
                        workspaceId,
                        period: targetDate,           // YYYY-MM-DD format for daily
                        trafficTotalGB,
                        storageAvgGB,
                        computeTotalUnits: computeUnits,
                        isFinalized: true,            // Daily summaries are immutable once created
                    }
                );

                result.summariesCreated++;
            } catch (err) {
                result.errors.push(
                    `Workspace ${workspaceId}: ${err instanceof Error ? err.message : "Unknown error"}`
                );
            }
        }

        // Step 4: Delete processed events in PARALLEL BATCHES
        // WHY: Sequential deletions took 134s for 288 events. Parallel batches of 20 take ~8s.
        if (result.errors.length === 0) {
            const BATCH_SIZE = 20; // 20 concurrent deletes at a time
            for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
                const batch = allEvents.slice(i, i + BATCH_SIZE);
                const deleteResults = await Promise.allSettled(
                    batch.map(event =>
                        databases.deleteDocument(DATABASE_ID, USAGE_EVENTS_ID, event.$id)
                    )
                );
                result.eventsDeleted += deleteResults.filter(r => r.status === "fulfilled").length;
            }
        }
    } catch (err) {
        result.errors.push(
            `Global error: ${err instanceof Error ? err.message : "Unknown error"}`
        );
    }

    return result;
}

/**
 * Get daily summaries for a workspace within a date range.
 * Used by the dashboard endpoint to quickly show usage data.
 * 
 * Returns daily summary documents where period format is YYYY-MM-DD.
 */
export async function getDailySummaries(
    databases: Databases,
    workspaceIds: string[],
    startDate: string,  // YYYY-MM-DD
    endDate: string,    // YYYY-MM-DD
) {
    if (workspaceIds.length === 0) return [];

    const summaries = await databases.listDocuments(
        DATABASE_ID,
        USAGE_AGGREGATIONS_ID,
        [
            Query.equal("workspaceId", workspaceIds),
            Query.greaterThanEqual("period", startDate),
            Query.lessThanEqual("period", endDate),
            Query.orderAsc("period"),
            Query.limit(500), // Max 500 daily summaries (~1.5 years)
        ]
    );

    return summaries.documents;
}
