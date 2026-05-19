import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureIndex,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_BUG_REPORTS_ID || 'bug_reports';
const COLLECTION_NAME = 'Bug Reports';

export async function setupBugReports(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    // Reporter identity
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'userId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'email', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'username', 256, true);

    // Report content
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'title', 200, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'description', 5000, true);

    // Attached images (stored in R2 / Appwrite storage)
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'imageFileIds', 512, false, undefined, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'imageUrls', 1024, false, undefined, true);

    // Wait for attributes to register before creating indexes
    await sleep(2000);

    // Indexes
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'userId_idx', IndexType.Key, ['userId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'email_idx', IndexType.Key, ['email']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'createdAt_idx', IndexType.Key, ['$createdAt']);
}
