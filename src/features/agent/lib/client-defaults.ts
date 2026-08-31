import { DEFAULT_FAIRLX_MCP_SERVER_NAME } from "../constants";
import type { AgentAiConfigPublic, AgentModel, McpConfig } from "../types";

export function defaultMcpConfig(): McpConfig {
  return {
    mcpServers: {
      [DEFAULT_FAIRLX_MCP_SERVER_NAME]: {
        url: "/api/mcp",
        transport: "http",
        disabled: false,
      },
    },
  };
}

export function selectedModelLabel(config: AgentAiConfigPublic | undefined): string {
  if (!config || config.mode === "auto") return "Auto";
  const selected = config.models.find((model) => model.id === config.selectedModelId && model.isEnabled);
  return selected?.displayName || "Select model";
}

export function enabledModels(config: AgentAiConfigPublic | undefined): AgentModel[] {
  if (!config) return [];
  const enabledProviders = new Set(
    config.providers.filter((provider) => provider.isEnabled).map((provider) => provider.id)
  );
  return config.models.filter((model) => model.isEnabled && enabledProviders.has(model.providerId));
}
