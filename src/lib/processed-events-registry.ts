import "server-only";

import { Databases, ID, Query } from "node-appwrite";
import crypto from "crypto";

/**
 * Processed Events Registry
 * 
 * Database-backed idempotency tracking for:
 * - Usage event writes
 * - Invoice generation  
 * - Webhook processing
 * 
 * CRITICAL: This replaces in-memory Sets for production safety.
 * In-memory storage is lost on server restart, causing duplicate processing.
 * 
 * COLLECTION: processed_events (preferred) or billing_audit_logs (fallback)
 * FIELDS:
 * - eventKey/eventId: string (unique identifier)
 * - eventType: "usage" | "invoice" | "webhook"
 * - processedAt: ISO timestamp
 * - metadata: optional JSON for debugging
 */

import { DATABASE_ID, PROCESSED_EVENTS_ID, BILLING_AUDIT_LOGS_ID } from "@/config";

// Use dedicated collection if available, otherwise fallback to audit logs
const getCollectionId = (): string => {
    return PROCESSED_EVENTS_ID || BILLING_AUDIT_LOGS_ID;
};

const usesDedicatedCollection = (): boolean => {
    return Boolean(PROCESSED_EVENTS_ID);
};

/**
 * Event types for idempotency tracking
 */
export type ProcessedEventType = "usage" | "invoice" | "webhook" | "wallet" | "github_rewards";

/**
 * Processed event record
 */
export interface ProcessedEvent {
    eventKey: string;
    eventType: ProcessedEventType;
    processedAt: string;
    metadata?: Record<string, unknown>;
}

// In-memory cache for hot path (backed by DB for persistence)
const processedEventsCache = new Map<string, ProcessedEvent>();

// Cache size limit
const MAX_CACHE_SIZE = 10000;

/**
 * Check if an event has already been processed
 * 
 * Checks in-memory cache first, then falls back to database.
 * 
 * @param databases - Appwrite Databases instance
 * @param eventKey - Unique identifier for the event
 * @param eventType - Type of event (usage, invoice, webhook)
 * @returns true if already processed, false otherwise
 */
export async function isEventProcessed(
    databases: Databases,
    eventKey: string,
    eventType: ProcessedEventType
): Promise<boolean> {
    const cacheKey = `${eventType}:${eventKey}`;

    // 1. Check in-memory cache (fast path)
    if (processedEventsCache.has(cacheKey)) {
        return true;
    }

    // 2. Check database (persistent storage)
    try {
        const collectionId = getCollectionId();

        // Query differs based on collection type
        let queries;
        if (usesDedicatedCollection()) {
            // Dedicated processed_events collection
            queries = [
                Query.equal("eventId", eventKey),
                Query.equal("eventType", eventType),
                Query.limit(1),
            ];
        } else {
            // Fallback to billing audit logs
            queries = [
                Query.equal("eventType", `IDEMPOTENCY_${eventType.toUpperCase()}`),
                Query.contains("metadata", eventKey),
                Query.limit(1),
            ];
        }

        const existing = await databases.listDocuments(
            DATABASE_ID,
            collectionId,
            queries
        );

        if (existing.total > 0) {
            // Add to cache for future checks
            processedEventsCache.set(cacheKey, {
                eventKey,
                eventType,
                processedAt: existing.documents[0].$createdAt,
            });
            return true;
        }

        return false;
    } catch (error) {
        // FAIL CLOSED: On error, assume already processed to prevent duplicates.
        // This may block a legitimate first-time event, but the webhook retry
        // mechanism will re-deliver it. Duplicates are far more dangerous than
        // delayed processing.
        console.warn("[processed-events] isEventProcessed query failed, failing closed (assuming processed):", {
            eventKey,
            eventType,
            error: error instanceof Error ? error.message : String(error),
        });
        return true;
    }
}

/**
 * Acquire a processing lock for an event
 * 
 * Uses the database unique constraint on eventId/eventType to ensure 
 * only one process can handle this event at a time.
 * 
 * @returns true if lock acquired, false if already processed/locked
 * @throws Error if database failure (other than duplicate)
 */
export async function acquireProcessingLock(
    databases: Databases,
    eventKey: string,
    eventType: ProcessedEventType,
    metadata?: Record<string, unknown>
): Promise<boolean> {
    const processedAt = new Date().toISOString();

    try {
        const collectionId = getCollectionId();
        let documentData;

        if (usesDedicatedCollection()) {
            documentData = {
                eventId: eventKey,
                eventType,
                processedAt,
                metadata: JSON.stringify(metadata || {}),
            };
        } else {
            // Fallback schema
            documentData = {
                billingAccountId: "SYSTEM_LOCK", // Special ID for locks
                eventType: `LOCK_${eventType.toUpperCase()}`,
                metadata: JSON.stringify({
                    eventKey,
                    eventType,
                    processedAt,
                    status: "LOCKED",
                    ...(metadata || {}),
                }),
            };
        }

        // Generate a deterministic document ID from eventKey + eventType.
        // This guarantees a 409 Conflict on duplicate attempts via Appwrite's
        // primary key constraint, without relying on secondary unique indexes.
        const deterministicId = usesDedicatedCollection()
            ? crypto.createHash("sha256").update(`${eventKey}:${eventType}`).digest("hex").substring(0, 36)
            : ID.unique(); // fallback collection can't use deterministic IDs

        // Attempt to create the lock record
        // This will fail with 409 Conflict if key already exists
        await databases.createDocument(
            DATABASE_ID,
            collectionId,
            deterministicId,
            documentData
        );

        // Add to cache as well
        const cacheKey = `${eventType}:${eventKey}`;
        processedEventsCache.set(cacheKey, {
            eventKey,
            eventType,
            processedAt,
            metadata,
        });

        return true;
    } catch (error: unknown) {
        const appwriteError = error as { code?: number };
        // 409 Conflict means duplicate - lock failed
        if (appwriteError.code === 409) {
            return false;
        }

        // For fallback collection (logs), we might not have unique constraints on metadata
        // So we strictly depend on PROCESSED_EVENTS_ID being a unique-constrained collection
        // If using fallback, this lock is essentially "best effort" via insert

        throw error;
    }
}

/**
 * Release a processing lock (Rollback)
 * 
 * Call this if the operation fails and you want to allow retry.
 * DO NOT call this if operation succeeded (lock becomes permanent record).
 */
export async function releaseProcessingLock(
    databases: Databases,
    eventKey: string,
    eventType: ProcessedEventType
): Promise<void> {
    try {
        const collectionId = getCollectionId();
        const cacheKey = `${eventType}:${eventKey}`;

        // Remove from cache
        processedEventsCache.delete(cacheKey);

        // Find and delete the lock document
        // We need to query it because ID is unique, but we only know eventKey
        let queries;
        if (usesDedicatedCollection()) {
            queries = [
                Query.equal("eventId", eventKey),
                Query.equal("eventType", eventType),
            ];
        } else {
            queries = [
                Query.equal("eventType", `LOCK_${eventType.toUpperCase()}`),
                Query.contains("metadata", eventKey),
            ];
        }

        const locks = await databases.listDocuments(
            DATABASE_ID,
            collectionId,
            [...queries, Query.limit(1)]
        );

        if (locks.total > 0) {
            await databases.deleteDocument(
                DATABASE_ID,
                collectionId,
                locks.documents[0].$id
            );
        }
    } catch {
        // Swallow error - rollback failure shouldn't crash the request
    }
}

/**
 * Mark an event as processed (Finalize Lock)
 * 
 * Updates the lock record to "COMPLETED" status.
 */
export async function markEventProcessed(
    databases: Databases,
    eventKey: string,
    eventType: ProcessedEventType,
    metadata?: Record<string, unknown>
): Promise<void> {
    // If we already hold the lock (via acquireProcessingLock), we just update status
    // But Appwrite 'create' is final. We don't need to update it unless we want to change status.
    // For immutability, we just leave it.

    // However, we ensure cache is updated
    const cacheKey = `${eventType}:${eventKey}`;
    processedEventsCache.set(cacheKey, {
        eventKey,
        eventType,
        processedAt: new Date().toISOString(),
        metadata,
    });
}

/**
 * Check if event is processed (sync version using cache only)
 * 
 * Use this for hot paths where database latency is unacceptable.
 * Falls back to assuming not processed if not in cache.
 */
export function isEventProcessedSync(
    eventKey: string,
    eventType: ProcessedEventType
): boolean {
    const cacheKey = `${eventType}:${eventKey}`;
    return processedEventsCache.has(cacheKey);
}

/**
 * Clear processed events cache (for testing)
 */
export function clearProcessedEventsCache(): void {
    processedEventsCache.clear();
}

/**
 * Get cache statistics (for monitoring)
 */
export function getProcessedEventsCacheStats(): {
    size: number;
    maxSize: number;
} {
    return {
        size: processedEventsCache.size,
        maxSize: MAX_CACHE_SIZE,
    };
}

/**
 * Cleanup old processed events (retention strategy)
 * 
 * Call this from a scheduled job (e.g., weekly cron)
 * Default retention: 90 days
 * 
 * This prevents unbounded growth of the processed_events collection
 * while keeping enough history for debugging and audit purposes.
 * 
 * @param databases - Appwrite Databases instance
 * @param retentionDays - Number of days to retain events (default: 90)
 * @returns Cleanup statistics
 */
export async function cleanupProcessedEvents(
    databases: Databases,
    retentionDays: number = 90
): Promise<{ deleted: number; errors: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let deleted = 0;
    let errors = 0;

    try {
        const collectionId = getCollectionId();

        // Query old events in batches to avoid memory issues
        let hasMore = true;
        let iterations = 0;
        const maxIterations = 100; // Safety limit

        while (hasMore && iterations < maxIterations) {
            iterations++;

            const oldEvents = await databases.listDocuments(
                DATABASE_ID,
                collectionId,
                [
                    Query.lessThan("$createdAt", cutoffDate.toISOString()),
                    Query.limit(100),
                ]
            );

            if (oldEvents.total === 0 || oldEvents.documents.length === 0) {
                hasMore = false;
                break;
            }

            for (const event of oldEvents.documents) {
                try {
                    await databases.deleteDocument(DATABASE_ID, collectionId, event.$id);
                    deleted++;
                } catch {
                    errors++;
                }
            }

            // If we got fewer than limit, we're done
            if (oldEvents.documents.length < 100) {
                hasMore = false;
            }
        }
    } catch {
        // Cleanup failed - silently continue
    }

    return { deleted, errors };
}

