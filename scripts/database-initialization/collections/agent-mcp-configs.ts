import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureIndex,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_AGENT_MCP_CONFIGS_ID || 'agent_mcp_configs';
const COLLECTION_NAME = 'Agent MCP Configs';

export async function setupAgentMcpConfigs(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'userId', 256, true);
    // Appwrite has no JSON attribute type; string size max is 16384.
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'configJson', 16384, true);

    await sleep(2000);

    await ensureIndex(databases, databaseId, COLLECTION_ID, 'userId_idx', IndexType.Unique, ['userId']);
}
