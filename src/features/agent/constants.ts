import type {
  AgentModel,
  AgentProviderStored,
  AgentProviderType,
  AgentSkill,
  AgentWorkPattern,
} from "./types";

export const AGENT_MCP_QUERY_KEY = ["agent-mcp-config"] as const;
export const AGENT_AI_QUERY_KEY = ["agent-ai-config"] as const;
export const AGENT_RUNS_QUERY_KEY = ["agent-runs"] as const;
export const AGENT_HARNESS_QUERY_KEY = ["agent-harness"] as const;
export const AGENT_CONTEXT_QUERY_KEY = ["agent-context"] as const;

export const PLATFORM_XAI_PROVIDER_ID = "platform-xai";
export const PLATFORM_DEEPSEEK_PROVIDER_ID = "platform-deepseek";
export const GROK_46_MODEL_ID = "grok-4.6";
export const DEEPSEEK_FLASH_MODEL_ID = "deepseek-flash";

export const DEFAULT_FAIRLX_MCP_SERVER_NAME = "fairlx";

export const PROVIDER_CATALOG: Array<{
  type: AgentProviderType;
  label: string;
  icon: string;
  defaultBaseUrl?: string;
  needsBaseUrl?: boolean;
}> = [
  { type: "anthropic", label: "Anthropic", icon: "fa-solid fa-brain" },
  { type: "azure", label: "Azure", icon: "fa-solid fa-cloud", needsBaseUrl: true },
  { type: "google", label: "Google", icon: "fa-brands fa-google" },
  { type: "openai", label: "OpenAI", icon: "fa-solid fa-microchip" },
  { type: "openrouter", label: "Open Router", icon: "fa-solid fa-route", defaultBaseUrl: "https://openrouter.ai/api/v1" },
  { type: "xai", label: "xAI", icon: "fa-solid fa-bolt", defaultBaseUrl: "https://api.x.ai/v1" },
  { type: "ollama", label: "Ollama", icon: "fa-solid fa-server", defaultBaseUrl: "http://localhost:11434", needsBaseUrl: true },
  { type: "custom", label: "Custom", icon: "fa-solid fa-plug", needsBaseUrl: true },
];

// Public Azure resource URLs only. API keys live in server env (AGENT_*_AZURE_API_KEY).
export const PLATFORM_PROVIDERS: AgentProviderStored[] = [
  {
    id: PLATFORM_XAI_PROVIDER_ID,
    provider: "azure",
    displayName: "Azure Grok (Fairlx)",
    baseUrl: "https://personal-use-g1-resource.openai.azure.com",
    extra: {
      vendor: "azure",
      deployment: "grok-4.6",
      openaiPath: "/openai/v1",
      authHeader: "api-key",
    },
    isEnabled: true,
    isPlatform: true,
  },
  {
    id: PLATFORM_DEEPSEEK_PROVIDER_ID,
    provider: "azure",
    displayName: "Azure DeepSeek (Fairlx)",
    baseUrl: "https://projectfairlx-resource.services.ai.azure.com/api/projects/projectfairlx",
    extra: {
      vendor: "azure",
      deployment: "DeepSeek-V4-Flash",
      openaiPath: "/openai/v1",
      authHeader: "api-key",
      project: "projectfairlx",
    },
    isEnabled: true,
    isPlatform: true,
  },
];

export const PLATFORM_MODELS: AgentModel[] = [
  {
    id: GROK_46_MODEL_ID,
    providerId: PLATFORM_XAI_PROVIDER_ID,
    modelId: "grok-4.6",
    displayName: "Grok 4.6",
    role: "default",
    isEnabled: true,
    isPlatform: true,
    toolCalling: true,
    vision: true,
    maxInputTokens: 72000,
    maxOutputTokens: 128000,
  },
  {
    id: DEEPSEEK_FLASH_MODEL_ID,
    providerId: PLATFORM_DEEPSEEK_PROVIDER_ID,
    modelId: "DeepSeek-V4-Flash",
    displayName: "DeepSeek V4 Flash",
    role: "flash",
    isEnabled: true,
    isPlatform: true,
  },
];

export function getMcpServerIcon(name: string): { kind: "icon" | "badge"; value: string; className?: string } {
  const key = name.toLowerCase();
  if (key.includes("github")) return { kind: "icon", value: "fa-brands fa-github", className: "text-white" };
  if (key.includes("postgres") || key.includes("pgsql") || key.includes("database")) {
    return { kind: "icon", value: "fa-solid fa-database", className: "text-blue-400" };
  }
  if (key.includes("slack")) return { kind: "icon", value: "fa-brands fa-slack", className: "text-white" };
  if (key.includes("linear")) return { kind: "icon", value: "fa-solid fa-chart-gantt", className: "text-white" };
  if (key.includes("notion")) return { kind: "badge", value: "N" };
  if (key.includes("fairlx")) return { kind: "icon", value: "fa-solid fa-cube", className: "text-fairlx-primary" };
  return { kind: "icon", value: "fa-solid fa-server", className: "text-fairlx-text-muted" };
}

export function getProviderCatalogItem(type: AgentProviderType) {
  return PROVIDER_CATALOG.find((item) => item.type === type);
}

export const AGENT_NAV = [
  { href: "/agent/dashboard", label: "Agent Home", icon: "fa-solid fa-house", shortcut: "⌘H" },
  { href: "/agent/projects", label: "Projects", icon: "fa-regular fa-folder" },
  { href: "/agent/workspaces", label: "Workspaces", icon: "fa-solid fa-border-all" },
  { href: "/agent/skills", label: "Skills", icon: "fa-solid fa-bullseye" },
  { href: "/agent/tools", label: "Tools", icon: "fa-solid fa-wrench" },
  { href: "/agent/mcp", label: "MCP Servers", icon: "fa-solid fa-server" },
  { href: "/agent/automations", label: "Automations", icon: "fa-solid fa-bolt" },
  { href: "/agent/integrations", label: "Integrations", icon: "fa-solid fa-puzzle-piece" },
  { href: "/agent/knowledge", label: "Knowledge Base", icon: "fa-regular fa-book" },
  { href: "/agent/settings", label: "Settings", icon: "fa-solid fa-gear" },
] as const;

export const AGENT_SETTINGS_NAV = [
  { href: "/agent/settings#reset", label: "Reset", icon: "fa-solid fa-rotate-left" },
  { href: "/agent/settings#work-patterns", label: "Work patterns", icon: "fa-solid fa-diagram-project" },
] as const;

export const AGENT_TOOL_CATALOG = [
  {
    id: "code_inspect",
    name: "Code inspector",
    icon: "fa-solid fa-code",
    description: "Inspect work items, repositories, and docs.",
  },
  {
    id: "terminal",
    name: "Terminal",
    icon: "fa-solid fa-terminal",
    description: "Record planned shell commands. Never executed on the Fairlx host.",
  },
  {
    id: "file_search",
    name: "File search",
    icon: "fa-solid fa-file-magnifying-glass",
    description: "Search Fairlx docs and work items.",
  },
  {
    id: "web_search",
    name: "Web search",
    icon: "fa-solid fa-globe",
    description: "Search the public web via DuckDuckGo.",
  },
  {
    id: "database_query",
    name: "Database queries",
    icon: "fa-solid fa-database",
    description: "Query Fairlx workspaces, projects, items, and docs.",
  },
  {
    id: "use_skill",
    name: "Skills",
    icon: "fa-solid fa-bullseye",
    description: "Apply a saved skill from the harness.",
  },
  {
    id: "list_workspaces",
    name: "List workspaces",
    icon: "fa-solid fa-border-all",
    description: "List your Fairlx workspaces.",
  },
  {
    id: "list_projects",
    name: "List projects",
    icon: "fa-regular fa-folder",
    description: "List projects in your workspaces.",
  },
  {
    id: "list_work_items",
    name: "List work items",
    icon: "fa-regular fa-square-check",
    description: "List work items assigned to you.",
  },
  {
    id: "mcp_list",
    name: "MCP servers",
    icon: "fa-solid fa-server",
    description: "List configured MCP servers.",
  },
] as const;

export const DEFAULT_ENABLED_TOOLS = AGENT_TOOL_CATALOG.map((tool) => tool.id);

export const STARTER_SKILLS: Omit<AgentSkill, "id" | "createdAt">[] = [
  {
    name: "Frontend",
    description: "UI, React, Next.js, and Tailwind in Fairlx.",
    instructions:
      "Prefer existing Fairlx UI components and fairlx-* tokens. Keep screens dynamic with live data. Avoid mock content and inaccessible markup.",
    enabled: true,
  },
  {
    name: "Backend",
    description: "Hono routes, Appwrite, and Fairlx domain APIs.",
    instructions:
      "Use existing Fairlx collections and RPC patterns. Validate input, return { data } or { error }, and never leak secrets. Prefer session-aware queries.",
    enabled: true,
  },
  {
    name: "DevOps",
    description: "Deployments, env, and operational safety.",
    instructions:
      "Do not execute host shell commands. Record planned commands instead. Never commit .env.local or secrets. Prefer existing setup scripts.",
    enabled: true,
  },
];

export const STARTER_WORK_PATTERNS: Omit<AgentWorkPattern, "id" | "createdAt">[] = [
  {
    name: "Ship small PRs",
    instructions: "Prefer small, reviewable changes. Summarize what changed and why.",
    enabled: true,
  },
  {
    name: "Ask before destructive actions",
    instructions: "Never delete, overwrite, or reset data without an explicit user request.",
    enabled: true,
  },
];

export const AGENT_FIELD_CLASS =
  "border-fairlx-border bg-fairlx-bg text-fairlx-text placeholder:text-fairlx-text-muted";
