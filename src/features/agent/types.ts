export type McpTransport = "stdio" | "sse" | "http";

export type McpServerConfig = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  transport?: McpTransport;
  disabled?: boolean;
  [key: string]: unknown;
};

export type McpConfig = {
  mcpServers: Record<string, McpServerConfig>;
  [key: string]: unknown;
};

export type AgentProviderType =
  | "anthropic"
  | "azure"
  | "google"
  | "openai"
  | "openrouter"
  | "xai"
  | "ollama"
  | "custom";

export type AgentModelRole = "default" | "flash" | "custom";

export type AgentAiMode = "auto" | "manual";

export type AgentApiKeySource = "none" | "platform" | "user";

export type AgentProviderPublic = {
  id: string;
  provider: AgentProviderType;
  displayName: string;
  apiKeyMasked?: string;
  apiKeyLast4?: string;
  hasApiKey: boolean;
  apiKeySource: AgentApiKeySource;
  baseUrl?: string;
  extra?: Record<string, unknown>;
  isEnabled: boolean;
  isPlatform: boolean;
};

export type AgentProviderInput = {
  id: string;
  provider: AgentProviderType;
  displayName: string;
  apiKey?: string;
  baseUrl?: string;
  extra?: Record<string, unknown>;
  isEnabled?: boolean;
  isPlatform?: boolean;
};

export type AgentProviderStored = {
  id: string;
  provider: AgentProviderType;
  displayName: string;
  apiKeyEncrypted?: string;
  apiKeyLast4?: string;
  baseUrl?: string;
  extra?: Record<string, unknown>;
  isEnabled: boolean;
  isPlatform: boolean;
};

export type AgentModel = {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  role?: AgentModelRole;
  isEnabled: boolean;
  isPlatform: boolean;
  toolCalling?: boolean;
  vision?: boolean;
  maxInputTokens?: number;
  maxOutputTokens?: number;
};

export type AgentAiConfigPublic = {
  mode: AgentAiMode;
  selectedModelId?: string;
  providers: AgentProviderPublic[];
  models: AgentModel[];
};

export type AgentAiConfigInput = {
  mode: AgentAiMode;
  selectedModelId?: string;
  providers: AgentProviderInput[];
  models: AgentModel[];
};

export type AgentAiConfigStored = {
  mode: AgentAiMode;
  selectedModelId?: string;
  providers: AgentProviderStored[];
  models: AgentModel[];
};

export type AgentRunStatus = "idle" | "running" | "completed" | "failed" | "stopped";
export type AgentRunMode = "agent" | "manual";
export type AgentSessionMode = "agent" | "plan" | "debug" | "multitask" | "ask";
export type AgentChatRole = "user" | "assistant" | "tool";

export type AgentToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type AgentChatMessage = {
  id: string;
  role: AgentChatRole;
  content: string;
  toolCalls?: AgentToolCall[];
  toolCallId?: string;
  toolName?: string;
  createdAt: string;
};

export type AgentSpecialistId =
  | "orchestrator"
  | "planner"
  | "researcher"
  | "builder"
  | "git"
  | "reviewer";

export type AgentGitStageStatus = "unstaged" | "staged" | "committed";

export type AgentGitStageItem = {
  id: string;
  path: string;
  summary: string;
  status: AgentGitStageStatus;
  repoId?: string;
  branch?: string;
  content?: string;
  createdAt: string;
};

export type AgentGitStaging = {
  items: AgentGitStageItem[];
  updatedAt: string;
};

export type AgentChatMeta = {
  pinnedRunIds: string[];
  archivedRunIds: string[];
};

export type AgentContextGraphNode = {
  id: string;
  kind: "workspace" | "project" | "work_item" | "repo" | "mcp" | "specialist";
  label: string;
  parentId?: string;
  meta?: string;
};

export type AgentContextGraph = {
  nodes: AgentContextGraphNode[];
  specialist: AgentSpecialistId;
  workspaceId?: string;
  projectId?: string;
};

export type AgentSearchKind =
  | "run"
  | "workspace"
  | "project"
  | "work_item"
  | "skill"
  | "knowledge"
  | "automation"
  | "pattern"
  | "doc"
  | "repo"
  | "mcp"
  | "staging";

export type AgentSearchHit = {
  id: string;
  kind: AgentSearchKind;
  title: string;
  href: string;
  meta: string;
  score: number;
};

export type AgentToolEventType =
  | "code_inspect"
  | "terminal"
  | "file_search"
  | "web_search"
  | "database_query"
  | "use_skill"
  | "list_workspaces"
  | "list_projects"
  | "list_work_items"
  | "mcp_list"
  | "mcp_call"
  | "mcp_resources"
  | "delegate_agent"
  | "search_harness"
  | "create_project"
  | "git_status"
  | "git_stage"
  | "git_unstage"
  | "git_commit_plan"
  | "run_automation"
  | "personal_read"
  | "thought"
  | "error";

export type AgentToolEvent = {
  id: string;
  type: AgentToolEventType;
  title: string;
  detail?: string;
  payload?: unknown;
  createdAt: string;
  runId: string;
};

export type AgentRun = {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  status: AgentRunStatus;
  mode: AgentRunMode;
  workspaceId?: string;
  projectId?: string;
  modelId?: string;
  messages: AgentChatMessage[];
  events: AgentToolEvent[];
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentSkill = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  enabled: boolean;
  createdAt: string;
};

export type AgentAutomation = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  enabled: boolean;
  createdAt: string;
};

export type AgentKnowledgeItem = {
  id: string;
  title: string;
  content: string;
  source?: string;
  createdAt: string;
};

export type AgentWorkPattern = {
  id: string;
  name: string;
  instructions: string;
  enabled: boolean;
  createdAt: string;
};

export type AgentHarnessSettings = {
  mode: AgentRunMode;
  enabledTools: string[];
  defaultWorkspaceId?: string;
  defaultProjectId?: string;
  sessionMode?: AgentSessionMode;
};

export type AgentContextChipKind =
  | "workspace"
  | "project"
  | "work_item"
  | "skill"
  | "mcp"
  | "file"
  | "image"
  | "doc"
  | "repo"
  | "knowledge";

export type AgentContextChip = {
  kind: AgentContextChipKind;
  id: string;
  label: string;
  meta?: string;
};

export type AgentHarness = {
  id: string;
  userId: string;
  skills: AgentSkill[];
  automations: AgentAutomation[];
  knowledge: AgentKnowledgeItem[];
  workPatterns: AgentWorkPattern[];
  settings: AgentHarnessSettings;
  gitStaging: AgentGitStaging;
  chatMeta: AgentChatMeta;
  updatedAt: string;
};

export type AgentContextWorkspace = {
  id: string;
  name: string;
  imageUrl?: string;
  inviteCode?: string;
};

export type AgentContextProject = {
  id: string;
  name: string;
  imageUrl?: string;
  workspaceId: string;
  description?: string;
  status?: string;
  key?: string;
};

export type AgentContextWorkItem = {
  id: string;
  key?: string;
  title: string;
  type?: string;
  status?: string;
  priority?: string;
  workspaceId?: string;
  projectId?: string;
};

export type AgentContextNotification = {
  id: string;
  title?: string;
  message?: string;
  isRead?: boolean;
  workspaceId?: string;
  createdAt: string;
};

export type AgentContextRepo = {
  id: string;
  repositoryName?: string;
  owner?: string;
  githubUrl?: string;
  workspaceId?: string;
  projectId?: string;
  branch?: string;
};

export type AgentContextIntegration = {
  id: string;
  provider?: string;
  projectId?: string;
  workspaceId?: string;
  name?: string;
};

export type AgentContextDoc = {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  projectId?: string;
  workspaceId?: string;
  category?: string;
};

export type AgentContext = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  workspaces: AgentContextWorkspace[];
  projects: AgentContextProject[];
  workItems: AgentContextWorkItem[];
  notifications: AgentContextNotification[];
  githubRepos: AgentContextRepo[];
  integrations: AgentContextIntegration[];
  docs: AgentContextDoc[];
};
