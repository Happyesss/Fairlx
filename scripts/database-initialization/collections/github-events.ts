import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureIntegerAttribute,
    ensureDatetimeAttribute,
    ensureIndex,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_GITHUB_EVENTS_ID || 'github_events';
const COLLECTION_NAME = 'GitHub Events';

export async function setupGithubEvents(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    // Attributes
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'projectId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'eventType', 128, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'taskIds', 256, false, undefined, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'commitSha', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'commitMessage', 2048, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'commitUrl', 1024, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'authorName', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'authorEmail', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'branchName', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'repoFullName', 256, true);
    await ensureIntegerAttribute(databases, databaseId, COLLECTION_ID, 'prNumber', false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'prTitle', 1024, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'prState', 128, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'prUrl', 1024, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'githubDeliveryId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'rawPayload', 10000, false);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'processedAt', false);

    await sleep(2000);

    // Indexes
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'projectId_idx', IndexType.Key, ['projectId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'githubDeliveryId_idx', IndexType.Key, ['githubDeliveryId']);
}
