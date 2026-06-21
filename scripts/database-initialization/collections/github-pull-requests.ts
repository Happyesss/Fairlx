import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureIntegerAttribute,
    ensureIndex,
    ensureDatetimeAttribute,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_GITHUB_PRS_ID || 'github_pull_requests';
const COLLECTION_NAME = 'GitHub Pull Requests';

export async function setupGithubPullRequests(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    // Attributes
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'projectId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'taskId', 256, false); // Link to Fairlx task key
    await ensureIntegerAttribute(databases, databaseId, COLLECTION_ID, 'prNumber', true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'prTitle', 1024, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'prState', 128, true); // open, closed, merged
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'prUrl', 1024, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'branchName', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'repoFullName', 256, true);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'processedAt', false);

    await sleep(2000);

    // Indexes
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'projectId_idx', IndexType.Key, ['projectId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'taskId_idx', IndexType.Key, ['taskId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'prNumber_idx', IndexType.Key, ['prNumber']);
}
