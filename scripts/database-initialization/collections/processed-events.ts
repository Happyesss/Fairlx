import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureDatetimeAttribute,
    ensureIndex,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_PROCESSED_EVENTS_ID || 'processed_events';
const COLLECTION_NAME = 'Processed Events';

/**
 * Setup Processed Events Collection
 * 
 * Used for idempotency tracking and distributed locking.
 * Aligned with ProcessedEvent interface in src/lib/processed-events-registry.ts
 * 
 * Fields:
 * - eventId: Unique identifier for the event (e.g., "wallet_topup:cashfree_12345")
 * - eventType: Type of event ("usage" | "invoice" | "webhook" | "wallet" | "github_rewards")
 * - processedAt: ISO timestamp when event was processed
 * - metadata: Optional JSON string for debugging context
 */
export async function setupProcessedEvents(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    // Attributes
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'eventId', 512, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'eventType', 64, true);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'processedAt', true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'metadata', 16384, false);

    await sleep(2000);

    // Indexes
    // Composite unique index for idempotency: same eventId can exist for different eventTypes
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'eventId_eventType_unique', IndexType.Unique, ['eventId', 'eventType']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'eventId_idx', IndexType.Key, ['eventId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'eventType_idx', IndexType.Key, ['eventType']);
}
