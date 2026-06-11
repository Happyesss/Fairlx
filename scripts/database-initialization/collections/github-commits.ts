import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureIndex,
    ensureDatetimeAttribute,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_GITHUB_COMMITS_ID || 'github_commits';
const COLLECTION_NAME = 'GitHub Commits';

export async function setupGithubCommits(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    // Attributes
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'projectId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'taskId', 256, false); // Link to Fairlx task key (e.g. FLX-1)
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'commitSha', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'commitMessage', 2048, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'commitUrl', 1024, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'authorName', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'authorEmail', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'branchName', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'repoFullName', 256, true);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'processedAt', false);

    await sleep(2000);

    // Indexes
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'projectId_idx', IndexType.Key, ['projectId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'taskId_idx', IndexType.Key, ['taskId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'commitSha_idx', IndexType.Key, ['commitSha']);
}
