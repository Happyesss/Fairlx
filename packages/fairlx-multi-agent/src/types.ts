export const SUB_AGENT_TYPES = ["planner", "builder", "qa", "reviewer"] as const;
export type SubAgentType = (typeof SUB_AGENT_TYPES)[number];

export const PERSONA_ROLES = ["tech_lead", "frontend", "qa", "pm"] as const;
export type PersonaRole = (typeof PERSONA_ROLES)[number];

export const WORKSPACE_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const RUN_STATUSES = [
  "running",
  "waiting_for_subagent",
  "completed",
  "failed",
  "stopped",
  "awaiting_confirmation",
] as const;
export type HierarchicalRunStatus = (typeof RUN_STATUSES)[number];

export type RunMode = "manual" | "agent";

export type ChatRole = "user" | "assistant" | "tool" | "system";

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  modelId: string;
  costUsd: number;
};

export type AgentChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  toolCallId?: string;
  toolName?: string;
  createdAt: string;
};

export type AgentEventType =
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "run.stopped"
  | "orchestrator.sleep"
  | "orchestrator.wake"
  | "subagent.spawned"
  | "subagent.completed"
  | "subagent.failed"
  | "graph.node.ready"
  | "graph.node.completed"
  | "gateway.auto_apply"
  | "gateway.confirm"
  | "gateway.reject"
  | "qa.report"
  | "git.pr"
  | "meter.usage"
  | "audit"
  | "thought"
  | "error"
  | "inbox";

export type AgentEvent = {
  id: string;
  type: AgentEventType;
  runId: string;
  title: string;
  detail?: string;
  payload?: unknown;
  createdAt: string;
};

export type InboxMessage = {
  id: string;
  fromRunId: string;
  subAgentType?: SubAgentType;
  kind: "report" | "wakeup" | "error" | "approval";
  summary: string;
  payload?: unknown;
  createdAt: string;
};

export type ContextEntityType =
  | "WORK_ITEM"
  | "SPRINT"
  | "TEAMMATE"
  | "DOC"
  | "REPO"
  | "PROJECT"
  | "WORKSPACE";

export type ContextEntity = {
  entityType: ContextEntityType;
  referenceKey: string;
  id: string;
  data: Record<string, unknown>;
};

export type InjectedContext = {
  user: { id: string; name: string; email: string };
  workspaceRole?: WorkspaceRole;
  personaRole?: PersonaRole;
  workspaceId?: string;
  projectId?: string;
  workspaceName?: string;
  projectName?: string;
  projectKey?: string;
  entities: ContextEntity[];
  workItems: BriefingWorkItem[];
  sprints: BriefingSprint[];
  blockers: BriefingWorkItem[];
  unassigned: BriefingWorkItem[];
  repos: Array<{ id: string; owner?: string; name?: string; branch?: string; url?: string }>;
};

export type BriefingWorkItem = {
  id: string;
  key?: string;
  title: string;
  status?: string;
  priority?: string;
  type?: string;
  dueAt?: string;
  assigneeId?: string;
  blockedBy?: string[];
};

export type BriefingSprint = {
  id: string;
  name: string;
  status?: string;
  endDate?: string;
  committedPoints?: number;
  totalPoints?: number;
  goal?: string;
};

export type DailyBriefing = {
  personaRole: PersonaRole;
  greeting: string;
  headline: string;
  priorities: string[];
  blockers: string[];
  unassigned: string[];
  suggestedActions: string[];
  generatedInMs: number;
};

export type VisualDiff = {
  browser: string;
  passed: boolean;
  screenshotUrl?: string;
  diffPercent?: number;
};

export type QaReport = {
  passed: boolean;
  provider: "testmu" | "playwright" | "mock";
  skipped?: boolean;
  reason?: string;
  url?: string;
  intent?: string;
  browsers: string[];
  videoUrl?: string;
  visualDiffs: VisualDiff[];
  logs: { console: string[]; network: string[] };
};

export type GitPrResult = {
  owner: string;
  repo: string;
  branch: string;
  number?: number;
  url?: string;
  staged: number;
  files: string[];
  skipped?: boolean;
  reason?: string;
};

export type Artifact = {
  kind: "plan" | "diff" | "pr" | "qa" | "review" | "doc" | "work_item";
  title: string;
  body: string;
  data?: unknown;
};

export type SubAgentReport = {
  runId: string;
  subAgentType: SubAgentType;
  status: "completed" | "failed";
  summary: string;
  artifacts: Artifact[];
  qaReport?: QaReport;
  git?: GitPrResult;
  usage: TokenUsage;
  error?: string;
};

export type GatewayVerdict = "auto_apply" | "confirm" | "reject";

export type GatewayDecision = {
  verdict: GatewayVerdict;
  reason: string;
  action: string;
  riskTier: 1 | 3 | 4 | 6;
  challengeToken?: string;
  ttlSeconds?: number;
};

export type GraphNodeStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export type GraphNode = {
  id: string;
  kind: SubAgentType;
  title: string;
  prompt: string;
  dependsOn: string[];
  runId?: string;
  status: GraphNodeStatus;
  result?: SubAgentReport;
  attempts: number;
  idempotencyKey: string;
};

export type TaskGraphSnapshot = {
  nodes: GraphNode[];
};

export type HierarchicalAgentRun = {
  id: string;
  userId: string;
  parentRunId?: string;
  subAgentType?: SubAgentType;
  waitingForRunId?: string;
  waitingForRunIds: string[];
  title: string;
  prompt: string;
  status: HierarchicalRunStatus;
  mode: RunMode;
  workspaceId?: string;
  projectId?: string;
  modelId?: string;
  personaRole?: PersonaRole;
  workspaceRole?: WorkspaceRole;
  allowedTools: string[];
  messages: AgentChatMessage[];
  events: AgentEvent[];
  inbox: InboxMessage[];
  qaReport?: QaReport;
  error?: string;
  usage: TokenUsage;
  graph?: TaskGraphSnapshot;
  createdAt: string;
  updatedAt: string;
};

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ToolResult = {
  content: string;
  event?: Partial<AgentEvent>;
  error?: string;
};

export type CompletionRequest = {
  modelId: string;
  system: string;
  messages: AgentChatMessage[];
  tools?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
  maxOutputTokens?: number;
  signal?: AbortSignal;
};

export type CompletionResult = {
  content: string;
  toolCalls: ToolCall[];
  usage: TokenUsage;
};

export type RunGoalInput = {
  userId: string;
  prompt: string;
  workspaceId?: string;
  projectId?: string;
  personaRole?: PersonaRole;
  workspaceRole?: WorkspaceRole;
  context?: InjectedContext;
  title?: string;
};

export type RunGoalResult = {
  parent: HierarchicalAgentRun;
  children: HierarchicalAgentRun[];
  briefing?: DailyBriefing;
  decision?: GatewayDecision;
  events: AgentEvent[];
};

export type PendingConfirmation = {
  runId: string;
  decision: GatewayDecision;
  calls: ToolCall[];
};
