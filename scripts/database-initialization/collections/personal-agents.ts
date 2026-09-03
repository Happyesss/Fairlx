import { Databases, IndexType, Permission, Role } from "node-appwrite";
import {
  ensureCollection,
  ensureDatetimeAttribute,
  ensureIndex,
  ensureIntegerAttribute,
  ensureStringAttribute,
  sleep,
} from "../lib/db-helpers";
import { logger } from "../lib/logger";

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_PERSONAL_AGENTS_ID || "personal_agents";
const COLLECTION_NAME = "Personal Agents";

export async function setupPersonalAgents(databases: Databases, databaseId: string): Promise<void> {
  logger.collection(COLLECTION_NAME);

  await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
    Permission.read(Role.any()),
  ]);

  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "userId", 256, true);
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "personaRole", 32, true);
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "jobTitle", 256, false);
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "workspaceRole", 32, false);
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "status", 24, true);
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "answersJson", 16384, true);
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "compiledPrompt", 65535, false);
  await ensureIntegerAttribute(databases, databaseId, COLLECTION_ID, "promptVersion", false, 0);
  await ensureStringAttribute(databases, databaseId, COLLECTION_ID, "historyJson", 16384, false);
  await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, "trainedAt", false);

  await sleep(2000);

  await ensureIndex(databases, databaseId, COLLECTION_ID, "userId_idx", IndexType.Unique, ["userId"]);
}
