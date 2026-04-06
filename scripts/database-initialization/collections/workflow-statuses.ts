import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureEnumAttribute,
    ensureBooleanAttribute,
    ensureIntegerAttribute,
    ensureIndex,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = 'workflow_statuses';
const COLLECTION_NAME = 'Workflow Statuses';

export async function setupWorkflowStatuses(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
        Permission.create(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
    ]);

    // Attributes
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'workflowId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'workspaceId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'name', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'key', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'color', 64, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'icon', 256, false);
    await ensureEnumAttribute(databases, databaseId, COLLECTION_ID, 'statusType', ['OPEN', 'IN_PROGRESS', 'CLOSED'], true);
    await ensureEnumAttribute(databases, databaseId, COLLECTION_ID, 'category', ['TODO', 'ASSIGNED', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CUSTOM'], false);
    await ensureIntegerAttribute(databases, databaseId, COLLECTION_ID, 'position', true);
    await ensureIntegerAttribute(databases, databaseId, COLLECTION_ID, 'positionX', false);
    await ensureIntegerAttribute(databases, databaseId, COLLECTION_ID, 'positionY', false);
    await ensureBooleanAttribute(databases, databaseId, COLLECTION_ID, 'isInitial', false, false);
    await ensureBooleanAttribute(databases, databaseId, COLLECTION_ID, 'isFinal', false, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'description', 1024, false);

    await sleep(2000);

    // Indexes
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'workflowId_idx', IndexType.Key, ['workflowId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'workspaceId_idx', IndexType.Key, ['workspaceId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'workflowId_position_idx', IndexType.Key, ['workflowId', 'position']);
}
