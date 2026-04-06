import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureBooleanAttribute,
    ensureIntegerAttribute,
    ensureIndex,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = 'workflows';
const COLLECTION_NAME = 'Workflows';

export async function setupWorkflows(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
        Permission.create(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
    ]);

    // Attributes
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'spaceId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'workspaceId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'projectId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'name', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'key', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'description', 2048, false);
    await ensureBooleanAttribute(databases, databaseId, COLLECTION_ID, 'isDefault', false, false);
    await ensureBooleanAttribute(databases, databaseId, COLLECTION_ID, 'isArchived', false, false);
    await ensureIntegerAttribute(databases, databaseId, COLLECTION_ID, 'statusCount', false, 0);
    await ensureBooleanAttribute(databases, databaseId, COLLECTION_ID, 'isAiGenerated', false, false);

    await sleep(2000);

    // Indexes
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'workspaceId_idx', IndexType.Key, ['workspaceId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'spaceId_idx', IndexType.Key, ['spaceId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'projectId_idx', IndexType.Key, ['projectId']);
}
