import { Databases, IndexType, Permission, Role } from "node-appwrite";
import {
  ensureCollection,
  ensureStringAttribute,
  ensureBooleanAttribute,
  ensureDatetimeAttribute,
  ensureIndex,
  sleep,
} from "../lib/db-helpers";
import { logger } from "../lib/logger";

/**
 * Project Integrations — Slack, Discord, MCP custom, GitLab, Bitbucket, etc.
 *
 * Schema notes:
 * - provider: slack | discord | mcp_custom | gitlab | bitbucket
 * - accessToken / refreshToken: encrypted at app layer (AES-GCM), stored as strings
 * - configJson: provider-specific JSON (custom MCP servers, VCS repo metadata)
 * - Appwrite string size max for standard attrs is 16384 — keep within that
 */
const COLLECTION_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_INTEGRATIONS_ID || "project_integrations";
const COLLECTION_NAME = "Project Integrations";

export async function setupProjectIntegrations(
  databases: Databases,
  databaseId: string
): Promise<void> {
  logger.collection(COLLECTION_NAME);

  await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
    Permission.read(Role.any()),
  ]);

  // Core keys
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "projectId", 256, true);
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "workspaceId", 256, true);
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "provider", 64, true);
  // required=false so we can set a default of true
  await ensureBooleanAttribute(databases, databaseId, COLLECTION_ID, "enabled", false, true);

  // Secrets / tokens (encrypted by application before write)
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "accessToken", 4096, false);
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "refreshToken", 4096, false);

  // Slack/Discord channel mapping
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "externalTeamId", 256, false);
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "channelId", 256, false);
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "channelName", 256, false);
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "webhookUrl", 2048, false);

  // Provider-specific blob (MCP servers list, gitlab/bitbucket repo metadata)
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "configJson", 16384, false);
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "createdBy", 256, false);

  // Wait for attributes to become available before indexing
  await sleep(2000);

  await ensureIndex(
    databases,
    databaseId,
    COLLECTION_ID,
    "projectId_idx",
    IndexType.Key,
    ["projectId"]
  );
  await ensureIndex(
    databases,
    databaseId,
    COLLECTION_ID,
    "provider_idx",
    IndexType.Key,
    ["provider"]
  );
  await ensureIndex(
    databases,
    databaseId,
    COLLECTION_ID,
    "project_provider_idx",
    IndexType.Key,
    ["projectId", "provider"]
  );
  await ensureIndex(
    databases,
    databaseId,
    COLLECTION_ID,
    "external_team_idx",
    IndexType.Key,
    ["externalTeamId"]
  );
}
