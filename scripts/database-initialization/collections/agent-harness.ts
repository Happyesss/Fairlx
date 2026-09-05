import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureIndex,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_AGENT_HARNESS_ID || 'agent_harness';
const COLLECTION_NAME = 'Agent Harness';

export async function setupAgentHarness(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'userId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'skillsJson', 16384, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'automationsJson', 16384, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'knowledgeJson', 16384, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'workPatternsJson', 16384, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'settingsJson', 4096, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'gitStagingJson', 16384, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'chatMetaJson', 4096, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'pluginsJson', 16384, false);

    await sleep(2000);

    await ensureIndex(databases, databaseId, COLLECTION_ID, 'userId_idx', IndexType.Unique, ['userId']);
}
