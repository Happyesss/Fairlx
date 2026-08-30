import type { AgentModel, AgentProviderStored, AgentProviderType } from "./types";

export const AGENT_MCP_QUERY_KEY = ["agent-mcp-config"] as const;
export const AGENT_AI_QUERY_KEY = ["agent-ai-config"] as const;

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
