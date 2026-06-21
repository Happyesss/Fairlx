import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureBooleanAttribute,
    ensureIntegerAttribute,
    ensureDatetimeAttribute,
    ensureIndex,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_GITHUB_REPOS_ID || 'github_repositories';
const COLLECTION_NAME = 'GitHub Repositories';

export async function setupGithubRepositories(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    // Attributes
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'projectId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'workspaceId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'githubUrl', 1024, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'repositoryName', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'owner', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'branch', 256, false, 'main');
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'accessToken', 1024, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'status', 128, false, 'connected');
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'error', 1024, false);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'lastSyncedAt', false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'createdBy', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'lastModifiedBy', 256, false);
    await ensureIntegerAttribute(databases, databaseId, COLLECTION_ID, 'webhookId', false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'webhookSecret', 256, false);
    await ensureBooleanAttribute(databases, databaseId, COLLECTION_ID, 'autoFetchCommits', false, true);
    await ensureBooleanAttribute(databases, databaseId, COLLECTION_ID, 'linkCommitsToTasks', false, true);
    await ensureBooleanAttribute(databases, databaseId, COLLECTION_ID, 'syncComments', false, true);
    await ensureBooleanAttribute(databases, databaseId, COLLECTION_ID, 'allowPrMerge', false, true);
    await ensureBooleanAttribute(databases, databaseId, COLLECTION_ID, 'createTasksFromIssues', false, false);

    await sleep(2000);


    // Indexes
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'projectId_idx', IndexType.Key, ['projectId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'workspaceId_idx', IndexType.Key, ['workspaceId']);
}
