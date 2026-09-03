import { resolveConfig, type MultiAgentConfig } from "./config";
import {
  MemoryAudit,
  MemoryGitHub,
  MemoryMeter,
  MemoryQa,
  type AuditLogger,
  type GitHubConnector,
  type QaConnector,
  type UsageMeter,
} from "./connectors";
import { assembleContextPayload, briefingFromContext, generateDailyBriefing } from "./context";
import { TaskGraph, decomposeGoal } from "./graph";
import { addUsage, emptyUsage, newId, nowIso } from "./ids";
import { EventBus, appendEvent, makeEvent, makeInbox, type EventListener } from "./protocol";
import { compilePersonaPrompt, inferPersonaRole, isToolAllowed, toolsForRole } from "./roles";
import {
  CancellationRegistry,
  WorkerPool,
  immediateScheduler,
  type Scheduler,
} from "./runtime";
import { MemoryChallengeStore, VerificationGateway } from "./safety";
import { MemoryRunStore, type RunStore } from "./store";
import type {
  DailyBriefing,
  GatewayDecision,
  GraphNode,
  HierarchicalAgentRun,
  InjectedContext,
  RunGoalInput,
  RunGoalResult,
  SubAgentReport,
} from "./types";
import { executeWorker, type WorkerDeps } from "./workers";

export type EngineOptions = {
  store?: RunStore;
  events?: EventBus;
  github?: GitHubConnector;
  qa?: QaConnector;
  audit?: AuditLogger;
  meter?: UsageMeter;
  gateway?: VerificationGateway;
  scheduler?: Scheduler;
  clock?: () => number;
  config?: Partial<MultiAgentConfig>;
};

export class MultiAgentEngine {
  readonly store: RunStore;
  readonly events: EventBus;
  readonly config: MultiAgentConfig;
  readonly cancellations = new CancellationRegistry();
  readonly inFlight = new Set<string>();
  readonly scheduled = new Set<string>();
  private readonly pendingWake = new Set<string>();
  private readonly contexts = new Map<string, InjectedContext>();
  private readonly github: GitHubConnector;
  private readonly qa: QaConnector;
  private readonly audit: AuditLogger;
  private readonly meter: UsageMeter;
  readonly gateway: VerificationGateway;
  private readonly scheduler: Scheduler;
  private readonly clock: () => number;
  private readonly pool: WorkerPool;
  private readonly workerDeps: WorkerDeps;

  constructor(options: EngineOptions = {}) {
    this.store = options.store ?? new MemoryRunStore(options.clock);
    this.events = options.events ?? new EventBus();
    this.config = resolveConfig(options.config);
    this.github = options.github ?? new MemoryGitHub();
    this.qa = options.qa ?? new MemoryQa();
    this.audit = options.audit ?? new MemoryAudit(options.clock);
    this.meter = options.meter ?? new MemoryMeter();
    this.gateway = options.gateway ?? new VerificationGateway(new MemoryChallengeStore(options.clock), this.config.confirmationTtlMs);
    this.scheduler = options.scheduler ?? immediateScheduler;
    this.clock = options.clock ?? Date.now;
    this.pool = new WorkerPool(this.config.maxConcurrentWorkers);
    this.workerDeps = {
      github: this.github,
      qa: this.qa,
      gateway: this.gateway,
      workerModel: this.config.workerModel,
    };
  }

  subscribe(listener: EventListener): () => void {
    return this.events.subscribe(listener);
  }

  cancel(runId: string): void {
    this.cancellations.cancel(runId);
    void this.store.update(runId, { status: "stopped", error: "stopped" }).catch(() => undefined);
  }

  isTurnInFlight(runId: string): boolean {
    return this.inFlight.has(runId);
  }

  wasScheduled(runId: string): boolean {
    return this.scheduled.has(runId);
  }

  async getRun(runId: string): Promise<HierarchicalAgentRun | null> {
    return this.store.get(runId);
  }

  generateDailyBriefing = generateDailyBriefing;

  async runGoal(input: RunGoalInput): Promise<RunGoalResult> {
    const parentId = await this.startGoal(input);
    await this.drain(parentId);
    return this.snapshotResult(parentId);
  }

  async startGoal(input: RunGoalInput): Promise<string> {
    const personaRole = inferPersonaRole(input);
    const context = input.context;
    const parent = await this.store.create({
      userId: input.userId,
      prompt: input.prompt,
      title: input.title,
      workspaceId: input.workspaceId ?? context?.workspaceId,
      projectId: input.projectId ?? context?.projectId,
      modelId: this.config.orchestratorModel,
      personaRole,
      workspaceRole: input.workspaceRole ?? context?.workspaceRole,
      allowedTools: toolsForRole("orchestrator"),
    });
    this.cancellations.controller(parent.id);
    if (context) this.contexts.set(parent.id, context);
    const graph = decomposeGoal(input.prompt, parent.id);
    await this.store.update(parent.id, { graph: graph.snapshot() });
    this.emit(parent.id, "run.started", parent.title, compilePersonaPrompt(personaRole, context?.workspaceName, context?.projectName));
    await this.audit.log({
      runId: parent.id,
      userId: parent.userId,
      action: "autonomous_run_started",
      metadata: { personaRole, prompt: parent.prompt },
    });
    this.scheduleTurn(parent.id);
    return parent.id;
  }

  async resume(runId: string, decision?: "accept" | "deny"): Promise<RunGoalResult> {
    const run = await this.requireRun(runId);
    if (decision === "deny") {
      await this.store.update(runId, { status: "stopped", error: "User denied the gated action." });
      this.emit(runId, "run.stopped", "Denied");
      return this.snapshotResult(run.parentRunId || runId);
    }
    if (run.status === "awaiting_confirmation" || run.status === "waiting_for_subagent" || run.status === "running") {
      await this.store.update(runId, { status: "running", error: "" });
      this.scheduleTurn(run.parentRunId || runId);
    }
    await this.drain(run.parentRunId || runId);
    return this.snapshotResult(run.parentRunId || runId);
  }

  private scheduleTurn(runId: string): void {
    if (this.cancellations.isCancelled(runId)) return;
    this.scheduled.add(runId);
    if (this.inFlight.has(runId)) {
      this.pendingWake.add(runId);
      return;
    }
    this.scheduler.schedule(async () => {
      if (this.inFlight.has(runId) || this.cancellations.isCancelled(runId)) return;
      this.inFlight.add(runId);
      try {
        await this.pump(runId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message !== "cancelled") {
          await this.store.update(runId, { status: "failed", error: message });
          this.emit(runId, "run.failed", "Turn failed", message);
        }
      } finally {
        this.inFlight.delete(runId);
        if (this.pendingWake.has(runId)) {
          this.pendingWake.delete(runId);
          this.scheduleTurn(runId);
        }
      }
    });
  }

  private async pump(parentId: string): Promise<void> {
    this.cancellations.throwIfCancelled(parentId);
    const parent = await this.requireRun(parentId);
    if (!parent.graph) return;
    const graph = TaskGraph.fromSnapshot(parent.graph);

    if (graph.hasFailed()) {
      const failed = graph.failed()[0]!;
      await this.finish(parent, "failed", failed.result?.error || failed.result?.summary || "Sub-agent failed");
      return;
    }

    if (graph.isComplete()) {
      await this.finish(parent, "completed");
      return;
    }

    const ready = graph.ready();
    const inFlightNodes = graph.inFlight();
    const slots = Math.max(0, this.config.maxConcurrentWorkers - inFlightNodes.length);
    const toSpawn = ready.slice(0, slots);

    if (!toSpawn.length && !inFlightNodes.length) {
      await this.finish(parent, "failed", "Graph stalled with no ready nodes");
      return;
    }

    if (toSpawn.length) {
      const childIds: string[] = [...parent.waitingForRunIds];
      for (const node of toSpawn) {
        const child = await this.spawnSubAgent(parent, node, graph);
        childIds.push(child.id);
      }
      const sleeping = await this.store.update(parentId, {
        status: "waiting_for_subagent",
        waitingForRunId: childIds[0],
        waitingForRunIds: childIds,
        graph: graph.snapshot(),
      });
      this.emit(parentId, "orchestrator.sleep", "Waiting for sub-agent", undefined, {
        waitingForRunIds: sleeping.waitingForRunIds,
      });
      for (const node of toSpawn) {
        if (node.runId) this.enqueueChild(parentId, node);
      }
      return;
    }

    for (const node of inFlightNodes) {
      if (node.runId) this.enqueueChild(parentId, node);
    }
  }

  private enqueueChild(parentId: string, node: GraphNode): void {
    const childId = node.runId;
    if (!childId || this.inFlight.has(childId)) return;
    this.scheduled.add(childId);
    this.scheduler.schedule(async () => {
      if (this.inFlight.has(childId) || this.cancellations.isCancelled(parentId)) return;
      this.inFlight.add(childId);
      try {
        await this.pool.run(() => this.executeChild(parentId, node.id));
      } finally {
        this.inFlight.delete(childId);
      }
    });
  }

  private async spawnSubAgent(parent: HierarchicalAgentRun, node: GraphNode, graph: TaskGraph): Promise<HierarchicalAgentRun> {
    const existing = await this.store.getByIdempotency(node.idempotencyKey);
    if (existing) {
      graph.markRunning(node.id, existing.id);
      return existing;
    }
    const tools = toolsForRole(node.kind);
    const child = await this.store.create({
      userId: parent.userId,
      prompt: node.prompt,
      title: node.title,
      parentRunId: parent.id,
      subAgentType: node.kind,
      workspaceId: parent.workspaceId,
      projectId: parent.projectId,
      modelId: this.config.workerModel,
      personaRole: parent.personaRole,
      workspaceRole: parent.workspaceRole,
      allowedTools: tools,
    });
    await this.store.rememberIdempotency(node.idempotencyKey, child.id);
    graph.markRunning(node.id, child.id);
    this.emit(parent.id, "subagent.spawned", `${node.kind} spawned`, node.title, {
      childId: child.id,
      allowedTools: tools,
    });
    this.emit(parent.id, "graph.node.ready", node.title);
    return child;
  }

  private async executeChild(parentId: string, nodeId: string): Promise<void> {
    this.cancellations.throwIfCancelled(parentId);
    const parent = await this.requireRun(parentId);
    if (!parent.graph) return;
    const graph = TaskGraph.fromSnapshot(parent.graph);
    const node = graph.byId(nodeId);
    if (!node?.runId) return;
    const child = await this.requireRun(node.runId);

    for (const tool of child.allowedTools) {
      if (!isToolAllowed(node.kind, tool)) {
        throw new Error(`Tool ${tool} is not allowed for ${node.kind}`);
      }
    }

    const report = await executeWorker(
      {
        run: child,
        kind: node.kind,
        prompt: node.prompt,
        context: this.contexts.get(parentId) ?? contextFromRun(parent),
        dependencyReports: graph.dependencyResults(node.id),
        workspaceRole: parent.workspaceRole,
      },
      this.workerDeps,
    );

    const status = report.status === "failed" ? "failed" : "completed";
    await this.store.update(child.id, {
      status,
      error: report.error,
      qaReport: report.qaReport,
      usage: report.usage,
      messages: [
        ...child.messages,
        {
          id: newId(),
          role: "assistant",
          content: report.summary,
          createdAt: nowIso(this.clock),
        },
      ],
    });
    await this.meter.record(parentId, report.usage);
    await this.meter.record(child.id, report.usage);
    if (status === "failed") graph.markFailed(node.id, report);
    else graph.markCompleted(node.id, report);
    this.emit(child.id, status === "failed" ? "subagent.failed" : "subagent.completed", report.summary, undefined, report);
    if (report.qaReport) this.emit(child.id, "qa.report", report.summary, undefined, report.qaReport);
    if (report.git?.url) this.emit(child.id, "git.pr", report.git.url, undefined, report.git);
    await this.onSubAgentComplete(parent, child, report, graph);
  }

  private async onSubAgentComplete(
    parent: HierarchicalAgentRun,
    child: HierarchicalAgentRun,
    report: SubAgentReport,
    graph: TaskGraph,
  ): Promise<void> {
    const latest = await this.requireRun(parent.id);
    const inbox = [...latest.inbox];
    const message = makeInbox(
      {
        fromRunId: child.id,
        subAgentType: child.subAgentType,
        kind: report.status === "failed" ? "error" : "report",
        summary: report.summary,
        payload: report,
      },
      this.clock,
    );
    inbox.push(message);
    if (inbox.length > this.config.inboxLimit) inbox.splice(0, inbox.length - this.config.inboxLimit);
    const waitingForRunIds = latest.waitingForRunIds.filter((id) => id !== child.id);
    addUsage(latest.usage, report.usage);
    await this.store.update(parent.id, {
      inbox,
      waitingForRunIds,
      waitingForRunId: waitingForRunIds[0],
      usage: latest.usage,
      graph: graph.snapshot(),
      qaReport: report.qaReport ?? latest.qaReport,
    });
    this.emit(parent.id, "inbox", message.summary, undefined, { fromRunId: child.id });
    this.emit(parent.id, "orchestrator.wake", "Sub-agent finished", child.subAgentType);
    this.scheduleTurn(parent.id);
  }

  private async finish(parent: HierarchicalAgentRun, status: "completed" | "failed", error?: string): Promise<void> {
    const decision = this.decisionFromGraph(parent);
    const nextStatus =
      decision?.verdict === "confirm" && status === "completed" ? "awaiting_confirmation" : status;
    await this.store.update(parent.id, {
      status: nextStatus,
      error,
      waitingForRunIds: [],
      waitingForRunId: undefined,
    });
    await this.audit.log({
      runId: parent.id,
      userId: parent.userId,
      action: nextStatus === "awaiting_confirmation" ? "gateway_confirm" : `run_${status}`,
      metadata: { decision, error },
    });
    this.emit(
      parent.id,
      nextStatus === "awaiting_confirmation"
        ? "gateway.confirm"
        : status === "completed"
          ? "run.completed"
          : "run.failed",
      nextStatus === "awaiting_confirmation" ? "Needs 1-click confirmation" : parent.title,
      error,
      decision,
    );
    this.cancellations.release(parent.id);
  }

  private decisionFromGraph(parent: HierarchicalAgentRun): GatewayDecision | undefined {
    const review = parent.graph?.nodes.find((node) => node.kind === "reviewer")?.result?.artifacts.find((artifact) => artifact.kind === "review");
    const data = review?.data as { decision?: GatewayDecision } | undefined;
    return data?.decision;
  }

  private async drain(parentId: string): Promise<void> {
    const scheduler = this.scheduler as { flush?: () => Promise<void>; pending?: number };
    let guard = 0;
    while (guard < 64) {
      guard += 1;
      if (typeof scheduler.flush === "function") {
        await scheduler.flush();
        if ((scheduler.pending ?? 0) > 0) continue;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (this.inFlight.size) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        continue;
      }
      const parent = await this.store.get(parentId);
      if (!parent) return;
      if (parent.status === "waiting_for_subagent" && parent.waitingForRunIds.length) {
        this.scheduleTurn(parentId);
        continue;
      }
      if (parent.status !== "running" && parent.status !== "waiting_for_subagent") return;
      if (parent.status === "waiting_for_subagent" && !parent.waitingForRunIds.length) {
        this.scheduleTurn(parentId);
        continue;
      }
      return;
    }
  }

  private async snapshotResult(parentId: string): Promise<RunGoalResult> {
    const parent = await this.requireRun(parentId);
    const children = await this.store.listByParent(parentId);
    const stored = this.contexts.get(parentId);
    const briefing = stored
      ? briefingFromContext(stored)
      : parent.personaRole
        ? briefingFromContext({
            user: { id: parent.userId, name: "", email: "" },
            personaRole: parent.personaRole,
            workspaceRole: parent.workspaceRole,
            workspaceId: parent.workspaceId,
            projectId: parent.projectId,
            entities: [],
            workItems: [],
            sprints: [],
            blockers: [],
            unassigned: [],
            repos: [],
          })
        : undefined;
    return {
      parent,
      children,
      briefing,
      decision: this.decisionFromGraph(parent),
      events: this.events.snapshot().filter((event) => event.runId === parentId || children.some((child) => child.id === event.runId)),
    };
  }

  private emit(
    runId: string,
    type: Parameters<typeof makeEvent>[0],
    title: string,
    detail?: string,
    payload?: unknown,
  ): void {
    const event = makeEvent(type, runId, title, detail, payload, this.clock);
    this.events.emit(event);
    void this.store.get(runId).then((run) => {
      if (!run) return;
      appendEvent(run, event, this.config.eventLimit);
      void this.store.update(runId, { events: run.events });
    });
  }

  private async requireRun(id: string): Promise<HierarchicalAgentRun> {
    const run = await this.store.get(id);
    if (!run) throw new Error(`Run ${id} not found`);
    return run;
  }
}

export function createMultiAgentEngine(options?: EngineOptions): MultiAgentEngine {
  return new MultiAgentEngine(options);
}

export function contextFromRun(run: HierarchicalAgentRun): InjectedContext | undefined {
  if (!run.workspaceId && !run.projectId) return undefined;
  return {
    user: { id: run.userId, name: "", email: "" },
    workspaceRole: run.workspaceRole,
    personaRole: run.personaRole,
    workspaceId: run.workspaceId,
    projectId: run.projectId,
    entities: [],
    workItems: [],
    sprints: [],
    blockers: [],
    unassigned: [],
    repos: [],
  };
}

export function packRunContext(context: InjectedContext, budget: number): string {
  return assembleContextPayload(context, budget).text;
}
