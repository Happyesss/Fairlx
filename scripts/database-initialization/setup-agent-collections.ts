/**
 * Targeted, non-interactive setup for Fairlx Agent collections.
 *
 * Creates (or updates) agent MCP, AI, runs, harness, and personal agent collections without
 * running the full interactive `npm run db:setup`.
 *
 * Usage: npm run db:setup:agent
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getDatabases } from './lib/appwrite-client';
import { setupAgentMcpConfigs } from './collections/agent-mcp-configs';
import { setupAgentAiConfigs } from './collections/agent-ai-configs';
import { setupAgentRuns } from './collections/agent-runs';
import { setupAgentHarness } from './collections/agent-harness';
import { setupPersonalAgents } from './collections/personal-agents';
import { setupAgentJobs } from './collections/agent-jobs';
import { printSummary } from './lib/logger';

async function main() {
    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'fairlx';
    const databases = getDatabases();

    console.log(`Provisioning agent collections in database "${databaseId}"...`);

    await setupAgentMcpConfigs(databases, databaseId);
    await setupAgentAiConfigs(databases, databaseId);
    await setupAgentRuns(databases, databaseId);
    await setupAgentHarness(databases, databaseId);
    await setupPersonalAgents(databases, databaseId);
    await setupAgentJobs(databases, databaseId);

    printSummary();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
