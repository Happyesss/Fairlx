/**
 * Targeted, non-interactive setup for Fairlx Agent collections.
 *
 * Creates (or updates) `agent_mcp_configs` and `agent_ai_configs` without
 * running the full interactive `npm run db:setup`.
 *
 * Usage: npm run db:setup:agent
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getDatabases } from './lib/appwrite-client';
import { setupAgentMcpConfigs } from './collections/agent-mcp-configs';
import { setupAgentAiConfigs } from './collections/agent-ai-configs';
import { printSummary } from './lib/logger';

async function main() {
    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'fairlx';
    const databases = getDatabases();

    console.log(`Provisioning agent collections in database "${databaseId}"...`);

    await setupAgentMcpConfigs(databases, databaseId);
    await setupAgentAiConfigs(databases, databaseId);

    printSummary();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
