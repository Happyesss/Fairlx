import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureIndex,
    ensureDatetimeAttribute,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_GITHUB_RELEASES_ID || 'github_releases';
const COLLECTION_NAME = 'GitHub Releases';

export async function setupGithubReleases(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    // Attributes
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'projectId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'releaseId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'tagName', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'name', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'htmlUrl', 1024, true);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'publishedAt', true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'body', 65535, false);

    await sleep(2000);

    // Indexes
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'projectId_idx', IndexType.Key, ['projectId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'releaseId_idx', IndexType.Key, ['releaseId']);
}
