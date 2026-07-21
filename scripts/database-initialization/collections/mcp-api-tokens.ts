import { Databases, IndexType, Permission, Role } from "node-appwrite";
import {
  ensureCollection,
  ensureStringAttribute,
  ensureDatetimeAttribute,
  ensureIndex,
  sleep,
} from "../lib/db-helpers";
import { logger } from "../lib/logger";

/**
 * MCP API Tokens — Bearer tokens for Fairlx MCP (/api/integrations/mcp/rpc).
 * Only SHA-256 hashes are stored; plaintext is shown once on create.
 */
const COLLECTION_ID =
  process.env.NEXT_PUBLIC_APPWRITE_MCP_API_TOKENS_ID || "mcp_api_tokens";
const COLLECTION_NAME = "MCP API Tokens";

export async function setupMcpApiTokens(
  databases: Databases,
  databaseId: string
): Promise<void> {
  logger.collection(COLLECTION_NAME);

  await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
    Permission.read(Role.any()),
  ]);

  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "projectId", 256, true);
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "workspaceId", 256, true);
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "name", 256, true);
  // sha256 hex = 64 chars; allow headroom
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "tokenHash", 128, true);
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "tokenPrefix", 32, true);
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "createdBy", 256, true);
  await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, "lastUsedAt", false);

  await sleep(2000);

  await ensureIndex(
    databases,
    databaseId,
    COLLECTION_ID,
    "projectId_idx",
    IndexType.Key,
    ["projectId"]
  );
  // Unique lookup for auth
  await ensureIndex(
    databases,
    databaseId,
    COLLECTION_ID,
    "tokenHash_idx",
    IndexType.Unique,
    ["tokenHash"]
  );
}
