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
