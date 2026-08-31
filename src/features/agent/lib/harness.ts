import { Databases, ID, Query } from "node-appwrite";

import { AGENT_HARNESS_ID, AGENT_RUNS_ID, DATABASE_ID } from "@/config";
import { DEFAULT_ENABLED_TOOLS, STARTER_SKILLS, STARTER_WORK_PATTERNS } from "../constants";
import type {
  AgentAutomation,
  AgentHarness,
  AgentHarnessSettings,
  AgentKnowledgeItem,
  AgentSkill,
  AgentWorkPattern,
} from "../types";
import { parseJson, stringifyBounded } from "./truncate";

type HarnessDocument = {
  $id: string;
  $updatedAt?: string;
  userId: string;
  skillsJson: string;
  automationsJson: string;
  knowledgeJson: string;
  workPatternsJson: string;
  settingsJson: string;
};

function nowIso() {
  return new Date().toISOString();
}

function withIds<T extends { name: string }>(
  items: Array<Omit<T, "id" | "createdAt">>,
): Array<T & { id: string; createdAt: string }> {
  const createdAt = nowIso();
  return items.map((item) => ({
    ...item,
    id: crypto.randomUUID(),
    createdAt,
  })) as Array<T & { id: string; createdAt: string }>;
}

export function defaultHarnessSettings(): AgentHarnessSettings {
  return {
    mode: "agent",
    enabledTools: [...DEFAULT_ENABLED_TOOLS],
  };
}

export function defaultHarnessData(): Pick<
  AgentHarness,
  "skills" | "automations" | "knowledge" | "workPatterns" | "settings"
> {
  return {
    skills: withIds<AgentSkill>(STARTER_SKILLS),
    automations: [],
    knowledge: [],
    workPatterns: withIds<AgentWorkPattern>(STARTER_WORK_PATTERNS),
    settings: defaultHarnessSettings(),
  };
}

export function parseHarness(doc: HarnessDocument): AgentHarness {
  const defaults = defaultHarnessData();
  const settings = {
    ...defaults.settings,
    ...parseJson<Partial<AgentHarnessSettings>>(doc.settingsJson, {}),
  };
  if (!Array.isArray(settings.enabledTools)) {
    settings.enabledTools = [...DEFAULT_ENABLED_TOOLS];
  }
  if (settings.mode !== "manual") {
    settings.mode = "agent";
  }

  return {
    id: doc.$id,
    userId: doc.userId,
    skills: parseJson<AgentSkill[]>(doc.skillsJson, defaults.skills),
    automations: parseJson<AgentAutomation[]>(doc.automationsJson, defaults.automations),
    knowledge: parseJson<AgentKnowledgeItem[]>(doc.knowledgeJson, defaults.knowledge),
    workPatterns: parseJson<AgentWorkPattern[]>(doc.workPatternsJson, defaults.workPatterns),
    settings,
    updatedAt: doc.$updatedAt || nowIso(),
  };
}

async function getHarnessDocument(databases: Databases, userId: string) {
  const result = await databases.listDocuments(DATABASE_ID, AGENT_HARNESS_ID, [
    Query.equal("userId", userId),
    Query.limit(1),
  ]);
  return (result.documents[0] as unknown as HarnessDocument | undefined) ?? null;
}

export async function getOrCreateHarness(databases: Databases, userId: string): Promise<AgentHarness> {
  const existing = await getHarnessDocument(databases, userId);
  if (existing) return parseHarness(existing);

  const seed = defaultHarnessData();
  const created = await databases.createDocument(DATABASE_ID, AGENT_HARNESS_ID, ID.unique(), {
    userId,
    skillsJson: stringifyBounded(seed.skills),
    automationsJson: stringifyBounded(seed.automations),
    knowledgeJson: stringifyBounded(seed.knowledge),
    workPatternsJson: stringifyBounded(seed.workPatterns),
    settingsJson: stringifyBounded(seed.settings, 4096),
  });

  return parseHarness(created as unknown as HarnessDocument);
}

export async function upsertHarness(
  databases: Databases,
  userId: string,
  patch: Partial<Pick<AgentHarness, "skills" | "automations" | "knowledge" | "workPatterns">> & {
    settings?: Partial<AgentHarnessSettings>;
  },
): Promise<AgentHarness> {
  const current = await getOrCreateHarness(databases, userId);
  const next: AgentHarness = {
    ...current,
    skills: patch.skills ?? current.skills,
    automations: patch.automations ?? current.automations,
    knowledge: patch.knowledge ?? current.knowledge,
    workPatterns: patch.workPatterns ?? current.workPatterns,
    settings: {
      ...current.settings,
      ...(patch.settings ?? {}),
      enabledTools: patch.settings?.enabledTools ?? current.settings.enabledTools,
    },
  };

  const payload = {
    userId,
    skillsJson: stringifyBounded(next.skills),
    automationsJson: stringifyBounded(next.automations),
    knowledgeJson: stringifyBounded(next.knowledge),
    workPatternsJson: stringifyBounded(next.workPatterns),
    settingsJson: stringifyBounded(next.settings, 4096),
  };

  const existing = await getHarnessDocument(databases, userId);
  const saved = existing
    ? await databases.updateDocument(DATABASE_ID, AGENT_HARNESS_ID, existing.$id, payload)
    : await databases.createDocument(DATABASE_ID, AGENT_HARNESS_ID, ID.unique(), payload);

  return parseHarness(saved as unknown as HarnessDocument);
}

export async function resetHarness(databases: Databases, userId: string): Promise<AgentHarness> {
  const seed = defaultHarnessData();
  return upsertHarness(databases, userId, seed);
}

export async function deleteUserRuns(databases: Databases, userId: string): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < 20; i += 1) {
    const page = await databases.listDocuments(DATABASE_ID, AGENT_RUNS_ID, [
      Query.equal("userId", userId),
      Query.limit(100),
    ]);
    if (page.documents.length === 0) break;
    await Promise.all(
      page.documents.map((doc) => databases.deleteDocument(DATABASE_ID, AGENT_RUNS_ID, doc.$id)),
    );
    deleted += page.documents.length;
    if (page.documents.length < 100) break;
  }
  return deleted;
}
