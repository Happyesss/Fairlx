import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureIndex,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_AGENT_JOBS_ID || 'agent_jobs';
const COLLECTION_NAME = 'Agent Jobs';

export async function setupAgentJobs(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'userId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'runId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'kind', 64, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'status', 32, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'progressJson', 2048, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'payloadJson', 16384, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'resultJson', 16384, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'error', 2048, false);

    await sleep(2000);

    await ensureIndex(databases, databaseId, COLLECTION_ID, 'userId_idx', IndexType.Key, ['userId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'status_idx', IndexType.Key, ['status']);
}
