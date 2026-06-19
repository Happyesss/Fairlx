import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureEnumAttribute,
    ensureIntegerAttribute,
    ensureFloatAttribute,
    ensureBooleanAttribute,
    ensureDatetimeAttribute,
    ensureIndex,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_WORK_ITEMS_ID || 'workItems';
const COLLECTION_NAME = 'Work Items';

export async function setupWorkItems(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    // Attributes
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'title', 512, true); // Matches Task.title
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'name', 512, false);  // Alias/Back-compat
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'key', 64, false);    // PROJ-123
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'workspaceId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'projectId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'spaceId', 256, false);
    await ensureIntegerAttribute(databases, databaseId, COLLECTION_ID, 'itemNumber', false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'status', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'statusId', 256, false); // For custom workflows

    // Assignment & Teams
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'assigneeIds', 256, false, undefined, true); // Array of user IDs
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'teamIds', 256, false, undefined, true);     // Array of team IDs

    // Dates & Times
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'dueDate', false);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'startDate', false);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'endDate', false);

    // Content & Meta
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'description', 65535, false);
    await ensureEnumAttribute(databases, databaseId, COLLECTION_ID, 'priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], false, 'MEDIUM');
    await ensureEnumAttribute(databases, databaseId, COLLECTION_ID, 'type', ['TASK', 'STORY', 'BUG', 'EPIC', 'SUBTASK', 'ISSUE'], false, 'TASK');
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'labels', 128, false, undefined, true); // Array of strings

    // Relationships
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'epicId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'sprintId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'parentId', 256, false);

    // Metrics & Agile
    await ensureIntegerAttribute(databases, databaseId, COLLECTION_ID, 'storyPoints', false, undefined, 0);
    await ensureFloatAttribute(databases, databaseId, COLLECTION_ID, 'estimatedHours', false);
    await ensureFloatAttribute(databases, databaseId, COLLECTION_ID, 'remainingHours', false);
    await ensureIntegerAttribute(databases, databaseId, COLLECTION_ID, 'position', false);

    // Audit & Ownership
    await ensureBooleanAttribute(databases, databaseId, COLLECTION_ID, 'flagged', false, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'reporterId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'lastModifiedBy', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'programId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'customFields', 65535, false); // JSON

    await sleep(2000);

    // Indexes
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'workspaceId_idx', IndexType.Key, ['workspaceId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'projectId_idx', IndexType.Key, ['projectId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'sprintId_idx', IndexType.Key, ['sprintId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'key_idx', IndexType.Key, ['key']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'epicId_idx', IndexType.Key, ['epicId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'spaceId_idx', IndexType.Key, ['spaceId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'status_idx', IndexType.Key, ['status']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'dueDate_idx', IndexType.Key, ['dueDate']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'projectId_status_idx', IndexType.Key, ['projectId', 'status']);
}
