import { emptyUsage, newId, nowIso, titleFromPrompt, truncate } from "./ids";
import type {
  HierarchicalAgentRun,
  HierarchicalRunStatus,
  PersonaRole,
  RunMode,
  SubAgentType,
  TaskGraphSnapshot,
  WorkspaceRole,
} from "./types";

export type CreateRunInput = {
  userId: string;
  prompt: string;
  title?: string;
  parentRunId?: string;
  subAgentType?: SubAgentType;
  mode?: RunMode;
  workspaceId?: string;
  projectId?: string;
  modelId?: string;
  personaRole?: PersonaRole;
  workspaceRole?: WorkspaceRole;
  allowedTools: string[];
  graph?: TaskGraphSnapshot;
};

export type RunPatch = Partial<
  Pick<
    HierarchicalAgentRun,
    | "status"
    | "title"
    | "waitingForRunId"
    | "waitingForRunIds"
    | "messages"
    | "events"
    | "inbox"
    | "qaReport"
    | "error"
    | "usage"
    | "graph"
    | "modelId"
    | "allowedTools"
  >
>;

export interface RunStore {
  create(input: CreateRunInput): Promise<HierarchicalAgentRun>;
  get(id: string): Promise<HierarchicalAgentRun | null>;
  update(id: string, patch: RunPatch): Promise<HierarchicalAgentRun>;
  listByUser(userId: string, limit?: number): Promise<HierarchicalAgentRun[]>;
  listByParent(parentRunId: string): Promise<HierarchicalAgentRun[]>;
  getByIdempotency(key: string): Promise<HierarchicalAgentRun | null>;
  rememberIdempotency(key: string, runId: string): Promise<void>;
}

export function createRunRecord(input: CreateRunInput, clock: () => number = Date.now): HierarchicalAgentRun {
  const createdAt = nowIso(clock);
  const prompt = truncate(input.prompt.trim(), 4000);
  return {
    id: newId(),
    userId: input.userId,
    parentRunId: input.parentRunId,
    subAgentType: input.subAgentType,
    waitingForRunIds: [],
    title: truncate(input.title || titleFromPrompt(prompt), 80),
    prompt,
    status: "running",
    mode: input.mode ?? "agent",
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    modelId: input.modelId,
    personaRole: input.personaRole,
    workspaceRole: input.workspaceRole,
    allowedTools: [...input.allowedTools],
    messages: [
      {
        id: newId(),
        role: "user",
        content: prompt,
        createdAt,
      },
    ],
    events: [],
    inbox: [],
    usage: emptyUsage(input.modelId || "none"),
    graph: input.graph,
    createdAt,
    updatedAt: createdAt,
  };
}

export function applyPatch(run: HierarchicalAgentRun, patch: RunPatch, clock: () => number = Date.now): HierarchicalAgentRun {
  return {
    ...run,
    ...patch,
    waitingForRunIds: patch.waitingForRunIds ? [...patch.waitingForRunIds] : run.waitingForRunIds,
    allowedTools: patch.allowedTools ? [...patch.allowedTools] : run.allowedTools,
    messages: patch.messages ? [...patch.messages] : run.messages,
    events: patch.events ? [...patch.events] : run.events,
    inbox: patch.inbox ? [...patch.inbox] : run.inbox,
    updatedAt: nowIso(clock),
  };
}

export class MemoryRunStore implements RunStore {
  private readonly runs = new Map<string, HierarchicalAgentRun>();
  private readonly idempotency = new Map<string, string>();

  constructor(private readonly clock: () => number = Date.now) {}

  async create(input: CreateRunInput): Promise<HierarchicalAgentRun> {
    const run = createRunRecord(input, this.clock);
    this.runs.set(run.id, run);
    return structuredClone(run);
  }

  async get(id: string): Promise<HierarchicalAgentRun | null> {
    const run = this.runs.get(id);
    return run ? structuredClone(run) : null;
  }

  async update(id: string, patch: RunPatch): Promise<HierarchicalAgentRun> {
    const existing = this.runs.get(id);
    if (!existing) throw new Error(`Run ${id} not found`);
    const next = applyPatch(existing, patch, this.clock);
    this.runs.set(id, next);
    return structuredClone(next);
  }

  async listByUser(userId: string, limit = 50): Promise<HierarchicalAgentRun[]> {
    return [...this.runs.values()]
      .filter((run) => run.userId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit)
      .map((run) => structuredClone(run));
  }

  async listByParent(parentRunId: string): Promise<HierarchicalAgentRun[]> {
    return [...this.runs.values()]
      .filter((run) => run.parentRunId === parentRunId)
      .map((run) => structuredClone(run));
  }

  async getByIdempotency(key: string): Promise<HierarchicalAgentRun | null> {
    const id = this.idempotency.get(key);
    return id ? this.get(id) : null;
  }

  async rememberIdempotency(key: string, runId: string): Promise<void> {
    this.idempotency.set(key, runId);
  }
}

export type DocumentBackend = {
  create(id: string, data: Record<string, unknown>): Promise<void>;
  get(id: string): Promise<Record<string, unknown> | null>;
  update(id: string, data: Record<string, unknown>): Promise<void>;
  listByUser(userId: string, limit: number): Promise<Array<Record<string, unknown>>>;
  listByParent(parentRunId: string): Promise<Array<Record<string, unknown>>>;
};

export function serializeRun(run: HierarchicalAgentRun): Record<string, unknown> {
  return {
    id: run.id,
    userId: run.userId,
    parentRunId: run.parentRunId ?? "",
    subAgentType: run.subAgentType ?? "",
    waitingForRunId: run.waitingForRunId ?? "",
    title: run.title,
    prompt: run.prompt,
    status: run.status,
    mode: run.mode,
    workspaceId: run.workspaceId ?? "",
    projectId: run.projectId ?? "",
    modelId: run.modelId ?? "",
    allowedToolsJson: JSON.stringify(run.allowedTools),
    messagesJson: JSON.stringify(run.messages),
    eventsJson: JSON.stringify(run.events),
    qaReportJson: run.qaReport ? JSON.stringify(run.qaReport) : "",
    error: run.error ?? "",
    extraJson: JSON.stringify({
      waitingForRunIds: run.waitingForRunIds,
      inbox: run.inbox,
      usage: run.usage,
      graph: run.graph,
      personaRole: run.personaRole,
      workspaceRole: run.workspaceRole,
    }),
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function deserializeRun(doc: Record<string, unknown>): HierarchicalAgentRun {
  const extra = parseJson<{
    waitingForRunIds?: string[];
    inbox?: HierarchicalAgentRun["inbox"];
    usage?: HierarchicalAgentRun["usage"];
    graph?: HierarchicalAgentRun["graph"];
    personaRole?: PersonaRole;
    workspaceRole?: WorkspaceRole;
  }>(doc.extraJson, {});
  const status = String(doc.status || "running") as HierarchicalRunStatus;
  return {
    id: String(doc.id),
    userId: String(doc.userId),
    parentRunId: String(doc.parentRunId || "") || undefined,
    subAgentType: (String(doc.subAgentType || "") || undefined) as SubAgentType | undefined,
    waitingForRunId: String(doc.waitingForRunId || "") || undefined,
    waitingForRunIds: extra.waitingForRunIds ?? [],
    title: String(doc.title || ""),
    prompt: String(doc.prompt || ""),
    status: status || "running",
    mode: doc.mode === "manual" ? "manual" : "agent",
    workspaceId: String(doc.workspaceId || "") || undefined,
    projectId: String(doc.projectId || "") || undefined,
    modelId: String(doc.modelId || "") || undefined,
    personaRole: extra.personaRole,
    workspaceRole: extra.workspaceRole,
    allowedTools: parseJson(doc.allowedToolsJson, []),
    messages: parseJson(doc.messagesJson, []),
    events: parseJson(doc.eventsJson, []),
    inbox: extra.inbox ?? [],
    qaReport: parseJson(doc.qaReportJson, undefined),
    error: String(doc.error || "") || undefined,
    usage: extra.usage ?? emptyUsage(String(doc.modelId || "none")),
    graph: extra.graph,
    createdAt: String(doc.createdAt || nowIso()),
    updatedAt: String(doc.updatedAt || doc.createdAt || nowIso()),
  };
}

export class DocumentRunStore implements RunStore {
  private readonly idempotency = new Map<string, string>();

  constructor(
    private readonly backend: DocumentBackend,
    private readonly clock: () => number = Date.now,
  ) {}

  async create(input: CreateRunInput): Promise<HierarchicalAgentRun> {
    const run = createRunRecord(input, this.clock);
    await this.backend.create(run.id, serializeRun(run));
    return run;
  }

  async get(id: string): Promise<HierarchicalAgentRun | null> {
    const doc = await this.backend.get(id);
    return doc ? deserializeRun(doc) : null;
  }

  async update(id: string, patch: RunPatch): Promise<HierarchicalAgentRun> {
    const existing = await this.get(id);
    if (!existing) throw new Error(`Run ${id} not found`);
    const next = applyPatch(existing, patch, this.clock);
    await this.backend.update(id, serializeRun(next));
    return next;
  }

  async listByUser(userId: string, limit = 50): Promise<HierarchicalAgentRun[]> {
    const docs = await this.backend.listByUser(userId, limit);
    return docs.map(deserializeRun);
  }

  async listByParent(parentRunId: string): Promise<HierarchicalAgentRun[]> {
    const docs = await this.backend.listByParent(parentRunId);
    return docs.map(deserializeRun);
  }

  async getByIdempotency(key: string): Promise<HierarchicalAgentRun | null> {
    const id = this.idempotency.get(key);
    return id ? this.get(id) : null;
  }

  async rememberIdempotency(key: string, runId: string): Promise<void> {
    this.idempotency.set(key, runId);
  }
}
