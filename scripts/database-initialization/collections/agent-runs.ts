import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureIndex,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_AGENT_RUNS_ID || 'agent_runs';
const COLLECTION_NAME = 'Agent Runs';

export async function setupAgentRuns(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'userId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'title', 512, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'prompt', 4096, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'status', 32, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'mode', 16, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'workspaceId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'projectId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'modelId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'messagesJson', 16384, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'eventsJson', 16384, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'error', 2048, false);

    await sleep(2000);

    await ensureIndex(databases, databaseId, COLLECTION_ID, 'userId_idx', IndexType.Key, ['userId']);
}
