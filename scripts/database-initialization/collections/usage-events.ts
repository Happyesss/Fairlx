import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureEnumAttribute,
    ensureFloatAttribute,
    ensureDatetimeAttribute,
    ensureIndex,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_USAGE_EVENTS_ID || 'usage_events';
const COLLECTION_NAME = 'Usage Events';

export async function setupUsageEvents(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    // Core identification
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'workspaceId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'projectId', 256, false);

    // Resource classification (replaces old eventType/quantity/unit)
    await ensureEnumAttribute(databases, databaseId, COLLECTION_ID, 'resourceType',
        ['traffic', 'storage', 'compute'], true);
    await ensureFloatAttribute(databases, databaseId, COLLECTION_ID, 'units', true);
    await ensureFloatAttribute(databases, databaseId, COLLECTION_ID, 'baseUnits', false);
    await ensureFloatAttribute(databases, databaseId, COLLECTION_ID, 'weightedUnits', false);

    // Source classification
    await ensureEnumAttribute(databases, databaseId, COLLECTION_ID, 'source',
        ['api', 'file', 'job', 'ai'], true);
    await ensureEnumAttribute(databases, databaseId, COLLECTION_ID, 'module', 
        ['traffic', 'storage', 'docs', 'github', 'ai', 'compute'], false);

    // Billing attribution
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'billingEntityId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'billingEntityType', 64, false);

    // Idempotency
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'idempotencyKey', 512, false);

    // Time and metadata
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'timestamp', true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'metadata', 65535, false);

    await sleep(2000);

    // Indexes
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'workspaceId_idx', IndexType.Key, ['workspaceId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'resourceType_idx', IndexType.Key, ['resourceType']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'timestamp_idx', IndexType.Key, ['timestamp']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'billingEntityId_idx', IndexType.Key, ['billingEntityId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'idempotencyKey_idx', IndexType.Unique, ['idempotencyKey']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'workspaceId_timestamp_idx', IndexType.Key, ['workspaceId', 'timestamp']);
}
