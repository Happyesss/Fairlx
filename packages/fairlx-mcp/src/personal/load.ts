import type { AuthContext } from "../auth/context";
import type { McpRuntime } from "../runtime/types";
import { toolResult } from "../runtime/output";

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type HarnessDoc = {
  $id: string;
  userId: string;
  skillsJson?: string;
  automationsJson?: string;
  knowledgeJson?: string;
  workPatternsJson?: string;
  settingsJson?: string;
  gitStagingJson?: string;
  chatMetaJson?: string;
};

async function loadHarness(runtime: McpRuntime, userId: string): Promise<HarnessDoc | null> {
  const collection = runtime.collections.agentHarness;
  if (!collection) return null;
  const result = await runtime.store.list<HarnessDoc>(collection, [
    { type: "equal", field: "userId", value: userId },
    { type: "limit", value: 1 },
  ]);
  return result.documents[0] ?? null;
}

export async function handlePersonalTool(
  name: string,
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
) {
  const harness = await loadHarness(runtime, auth.actorUserId);
  const query = typeof args.query === "string" ? args.query.toLowerCase() : "";
  const match = (value?: string) => !query || (value ?? "").toLowerCase().includes(query);

  if (!harness) {
    return toolResult({
      configured: false,
      note: "Agent harness collections are not bound to this MCP runtime.",
    });
  }

  const skills = parseJson<Array<{ id: string; name: string; description?: string; instructions?: string; enabled?: boolean }>>(
    harness.skillsJson,
    [],
  );
  const knowledge = parseJson<Array<{ id: string; title: string; content?: string; source?: string }>>(
    harness.knowledgeJson,
    [],
  );
  const automations = parseJson<Array<{ id: string; name: string; trigger?: string; action?: string; enabled?: boolean }>>(
    harness.automationsJson,
    [],
  );
  const rules = parseJson<Array<{ id: string; name: string; instructions?: string; enabled?: boolean }>>(
    harness.workPatternsJson,
    [],
  );
  const settings = parseJson<Record<string, unknown>>(harness.settingsJson, {});
  const staging = parseJson<{ items?: unknown[] }>(harness.gitStagingJson, { items: [] });

  if (name === "fairlx_personal_harness_get") {
    return toolResult({
      userId: auth.actorUserId,
      mode: settings.mode,
      defaultWorkspaceId: settings.defaultWorkspaceId,
      defaultProjectId: settings.defaultProjectId,
      skills: skills.filter((item) => item.enabled !== false).map((item) => item.name),
      rules: rules.filter((item) => item.enabled !== false).map((item) => item.name),
      automations: automations.filter((item) => item.enabled !== false).map((item) => item.name),
      knowledgeCount: knowledge.length,
      staged: Array.isArray(staging.items) ? staging.items.length : 0,
    });
  }

  if (name === "fairlx_personal_skill_list") {
    return toolResult({ skills: skills.filter((item) => match(item.name) || match(item.description) || match(item.instructions)) });
  }
  if (name === "fairlx_personal_knowledge_list") {
    return toolResult({ knowledge: knowledge.filter((item) => match(item.title) || match(item.content) || match(item.source)) });
  }
  if (name === "fairlx_personal_search") {
    const kind = typeof args.kind === "string" ? args.kind : "all";
    return toolResult({
      query: args.query,
      skills: kind === "all" || kind === "skills" ? skills.filter((item) => match(item.name) || match(item.description)) : [],
      knowledge: kind === "all" || kind === "knowledge" ? knowledge.filter((item) => match(item.title) || match(item.content)) : [],
      rules: kind === "all" || kind === "rules" ? rules.filter((item) => match(item.name) || match(item.instructions)) : [],
      automations:
        kind === "all" || kind === "automations"
          ? automations.filter((item) => match(item.name) || match(item.trigger) || match(item.action))
          : [],
      staging: kind === "all" || kind === "staging" ? staging : undefined,
    });
  }
  if (name === "fairlx_personal_chat_list") {
    const collection = runtime.collections.agentRuns;
    if (!collection) return toolResult({ chats: [] });
    const limit = typeof args.limit === "number" ? Math.min(args.limit, 50) : 20;
    const result = await runtime.store.list<Record<string, unknown>>(collection, [
      { type: "equal", field: "userId", value: auth.actorUserId },
      { type: "orderDesc", field: "$createdAt" },
      { type: "limit", value: limit },
    ]);
    return toolResult({
      chats: result.documents.map((doc) => ({
        id: doc.$id,
        title: doc.title,
        status: doc.status,
        updatedAt: doc.$updatedAt,
      })),
    });
  }

  return toolResult({ error: `Unknown personal tool: ${name}` });
}

export async function readPersonalResource(runtime: McpRuntime, auth: AuthContext, kind: string) {
  const mapped =
    kind === "skills"
      ? "fairlx_personal_skill_list"
      : kind === "knowledge"
        ? "fairlx_personal_knowledge_list"
        : kind === "chats"
          ? "fairlx_personal_chat_list"
          : "fairlx_personal_harness_get";
  const extraKind = kind === "rules" || kind === "automations" || kind === "staging" ? kind : undefined;
  const result = await handlePersonalTool(
    extraKind ? "fairlx_personal_search" : mapped,
    extraKind ? { query: "", kind: extraKind } : {},
    runtime,
    auth
  );
  return result.content[0]?.text ?? "{}";
}
