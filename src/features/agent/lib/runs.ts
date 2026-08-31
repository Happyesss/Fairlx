import { Databases, ID, Query } from "node-appwrite";

import { AGENT_RUNS_ID, DATABASE_ID } from "@/config";
import type { AgentChatMessage, AgentRun, AgentRunMode, AgentRunStatus, AgentToolEvent } from "../types";
import { parseJson, stringifyBounded, truncateString } from "./truncate";

type RunDocument = {
  $id: string;
  $createdAt: string;
  $updatedAt?: string;
  userId: string;
  title: string;
  prompt: string;
  status: AgentRunStatus;
  mode: AgentRunMode;
  workspaceId?: string;
  projectId?: string;
  modelId?: string;
  messagesJson: string;
  eventsJson: string;
  error?: string;
};

export function parseRun(doc: RunDocument): AgentRun {
  return {
    id: doc.$id,
    userId: doc.userId,
    title: doc.title,
    prompt: doc.prompt,
    status: doc.status,
    mode: doc.mode === "manual" ? "manual" : "agent",
    workspaceId: doc.workspaceId || undefined,
    projectId: doc.projectId || undefined,
    modelId: doc.modelId || undefined,
    messages: parseJson<AgentChatMessage[]>(doc.messagesJson, []),
    events: parseJson<AgentToolEvent[]>(doc.eventsJson, []),
    error: doc.error || undefined,
    createdAt: doc.$createdAt,
    updatedAt: doc.$updatedAt || doc.$createdAt,
  };
}

export async function listRuns(databases: Databases, userId: string, limit = 50): Promise<AgentRun[]> {
  const result = await databases.listDocuments(DATABASE_ID, AGENT_RUNS_ID, [
    Query.equal("userId", userId),
    Query.orderDesc("$createdAt"),
    Query.limit(Math.min(limit, 100)),
  ]);
  return result.documents.map((doc) => parseRun(doc as unknown as RunDocument));
}

export async function getRun(databases: Databases, userId: string, runId: string): Promise<AgentRun | null> {
  try {
    const doc = await databases.getDocument(DATABASE_ID, AGENT_RUNS_ID, runId);
    const run = parseRun(doc as unknown as RunDocument);
    if (run.userId !== userId) return null;
    return run;
  } catch {
    return null;
  }
}

export async function createRun(
  databases: Databases,
  input: {
    userId: string;
    prompt: string;
    mode: AgentRunMode;
    workspaceId?: string;
    projectId?: string;
    modelId?: string;
    messages?: AgentChatMessage[];
  },
): Promise<AgentRun> {
  const prompt = truncateString(input.prompt.trim(), 4000);
  const title = truncateString(prompt.replace(/\s+/g, " "), 80);
  const createdAt = new Date().toISOString();
  const messages = input.messages ?? [
    {
      id: crypto.randomUUID(),
      role: "user" as const,
      content: prompt,
      createdAt,
    },
  ];

  const doc = await databases.createDocument(DATABASE_ID, AGENT_RUNS_ID, ID.unique(), {
    userId: input.userId,
    title,
    prompt,
    status: "running",
    mode: input.mode,
    workspaceId: input.workspaceId || "",
    projectId: input.projectId || "",
    modelId: input.modelId || "",
    messagesJson: stringifyBounded(messages),
    eventsJson: stringifyBounded([]),
    error: "",
  });

  return parseRun(doc as unknown as RunDocument);
}

export async function updateRun(
  databases: Databases,
  runId: string,
  patch: Partial<{
    title: string;
    status: AgentRunStatus;
    workspaceId: string;
    projectId: string;
    modelId: string;
    messages: AgentChatMessage[];
    events: AgentToolEvent[];
    error: string;
  }>,
): Promise<AgentRun> {
  const payload: Record<string, string> = {};
  if (patch.title !== undefined) payload.title = truncateString(patch.title, 512);
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.workspaceId !== undefined) payload.workspaceId = patch.workspaceId || "";
  if (patch.projectId !== undefined) payload.projectId = patch.projectId || "";
  if (patch.modelId !== undefined) payload.modelId = patch.modelId || "";
  if (patch.messages !== undefined) payload.messagesJson = stringifyBounded(patch.messages);
  if (patch.events !== undefined) payload.eventsJson = stringifyBounded(patch.events);
  if (patch.error !== undefined) payload.error = truncateString(patch.error, 2048);

  const doc = await databases.updateDocument(DATABASE_ID, AGENT_RUNS_ID, runId, payload);
  return parseRun(doc as unknown as RunDocument);
}
