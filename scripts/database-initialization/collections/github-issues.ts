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

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_GITHUB_ISSUES_ID || 'github_issues';
const COLLECTION_NAME = 'GitHub Issues';

export async function setupGithubIssues(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    // Attributes
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'projectId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'taskId', 256, true); // Link to Fairlx task ID ($id)
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'issueId', 256, true); // GitHub node ID / ID
    await ensureIntegerAttribute(databases, databaseId, COLLECTION_ID, 'issueNumber', true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'issueUrl', 1024, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'repoFullName', 256, true);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'lastSyncedAt', false);

    await sleep(2000);

    // Indexes
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'projectId_idx', IndexType.Key, ['projectId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'taskId_idx', IndexType.Key, ['taskId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'issueId_idx', IndexType.Key, ['issueId']);
}
