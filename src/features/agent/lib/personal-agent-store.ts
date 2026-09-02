import { ID, Query, type Databases } from "node-appwrite";

import { DATABASE_ID, PERSONAL_AGENTS_ID } from "@/config";

import type {
  PersonalAgentProfile,
  PersonalAgentStatus,
  PersonalAgentVersion,
  PersonalPersonaRole,
  PersonalTrainingAnswer,
} from "../types";
import { isPersonalPersonaRole } from "./personal-training";
import { parseJson, stringifyBounded, truncateString } from "./truncate";

type PersonalAgentDocument = {
  $id: string;
  $updatedAt?: string;
  userId: string;
  personaRole?: string;
  jobTitle?: string;
  workspaceRole?: string;
  status?: string;
  answersJson?: string;
  compiledPrompt?: string;
  promptVersion?: number;
  historyJson?: string;
  trainedAt?: string;
};

function asStatus(value: unknown): PersonalAgentStatus {
  if (value === "draft" || value === "trained" || value === "retraining") return value;
  return "draft";
}

function parseHistory(raw: string | undefined): PersonalAgentVersion[] {
  const items = parseJson<PersonalAgentVersion[]>(raw, []);
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item.compiledPrompt === "string")
    .slice(0, 8)
    .map((item) => ({
      version: Number(item.version) || 0,
      personaRole: isPersonalPersonaRole(item.personaRole) ? item.personaRole : "frontend",
      compiledPrompt: truncateString(item.compiledPrompt, 6000),
      trainedAt: item.trainedAt || "",
    }));
}

export function parsePersonalAgent(doc: PersonalAgentDocument): PersonalAgentProfile {
  const personaRole = isPersonalPersonaRole(doc.personaRole) ? doc.personaRole : "frontend";
  return {
    id: doc.$id,
    userId: doc.userId,
    personaRole,
    jobTitle: doc.jobTitle || undefined,
    workspaceRole: doc.workspaceRole || undefined,
    status: asStatus(doc.status),
    answers: parseJson<PersonalTrainingAnswer[]>(doc.answersJson, []),
    compiledPrompt: doc.compiledPrompt || "",
    promptVersion: Number(doc.promptVersion) || 0,
    history: parseHistory(doc.historyJson),
    trainedAt: doc.trainedAt || undefined,
    updatedAt: doc.$updatedAt || new Date().toISOString(),
  };
}

async function getDocument(databases: Databases, userId: string): Promise<PersonalAgentDocument | null> {
  try {
    const result = await databases.listDocuments(DATABASE_ID, PERSONAL_AGENTS_ID, [
      Query.equal("userId", userId),
      Query.limit(1),
    ]);
    return (result.documents[0] as unknown as PersonalAgentDocument | undefined) ?? null;
  } catch (error) {
    console.error("[personal-agent] failed to load document", error);
    return null;
  }
}

export async function getPersonalAgent(
  databases: Databases,
  userId: string,
): Promise<PersonalAgentProfile | null> {
  const doc = await getDocument(databases, userId);
  return doc ? parsePersonalAgent(doc) : null;
}

export async function getPersonalAgentPrompt(
  databases: Databases,
  userId: string,
): Promise<string | undefined> {
  const profile = await getPersonalAgent(databases, userId);
  if (!profile?.compiledPrompt.trim() || profile.status === "draft") return undefined;
  return profile.compiledPrompt;
}

export type UpsertPersonalAgentInput = {
  personaRole: PersonalPersonaRole;
  jobTitle?: string;
  workspaceRole?: string;
  status: PersonalAgentStatus;
  answers: PersonalTrainingAnswer[];
  compiledPrompt: string;
};

export async function upsertPersonalAgent(
  databases: Databases,
  userId: string,
  input: UpsertPersonalAgentInput,
): Promise<PersonalAgentProfile> {
  const existing = await getDocument(databases, userId);
  const previous = existing ? parsePersonalAgent(existing) : null;
  const now = new Date().toISOString();
  const nextVersion =
    input.status === "trained" && input.compiledPrompt.trim()
      ? (previous?.promptVersion || 0) + 1
      : previous?.promptVersion || 0;

  const history = [...(previous?.history ?? [])];
  if (
    input.status === "trained" &&
    previous?.compiledPrompt &&
    previous.compiledPrompt !== input.compiledPrompt &&
    previous.status === "trained"
  ) {
    history.unshift({
      version: previous.promptVersion,
      personaRole: previous.personaRole,
      compiledPrompt: previous.compiledPrompt,
      trainedAt: previous.trainedAt || now,
    });
  }

  const payload: Record<string, unknown> = {
    userId,
    personaRole: input.personaRole,
    jobTitle: input.jobTitle || "",
    workspaceRole: input.workspaceRole || "",
    status: input.status,
    answersJson: stringifyBounded(input.answers, 16384),
    compiledPrompt: truncateString(input.compiledPrompt, 65500),
    promptVersion: nextVersion,
    historyJson: stringifyBounded(history.slice(0, 8), 16384),
  };
  const trainedAt = input.status === "trained" ? now : previous?.trainedAt;
  if (trainedAt) payload.trainedAt = trainedAt;

  const saved = existing
    ? ((await databases.updateDocument(
        DATABASE_ID,
        PERSONAL_AGENTS_ID,
        existing.$id,
        payload,
      )) as unknown as PersonalAgentDocument)
    : ((await databases.createDocument(
        DATABASE_ID,
        PERSONAL_AGENTS_ID,
        ID.unique(),
        payload,
      )) as unknown as PersonalAgentDocument);

  return parsePersonalAgent(saved);
}
