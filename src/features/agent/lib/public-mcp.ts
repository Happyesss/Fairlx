import { isInternalMcpServer } from "../constants";
import type { McpConfig, McpServerConfig } from "../types";
import { maskEncryptedSecret } from "./secrets";

function maskRecord(record: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!record) return undefined;
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    masked[key] = maskEncryptedSecret(value) ?? "";
  }
  return masked;
}

export function toPublicMcpConfig(config: McpConfig): McpConfig {
  const mcpServers: Record<string, McpServerConfig> = {};
  for (const [name, server] of Object.entries(config.mcpServers ?? {})) {
    mcpServers[name] = {
      ...server,
      env: maskRecord(server.env as Record<string, string> | undefined),
      headers: maskRecord(server.headers as Record<string, string> | undefined),
    };
  }
  return {
    ...config,
    mcpServers,
  };
}

export function connectedMcpCount(config: McpConfig | undefined): number {
  if (!config?.mcpServers) return 0;
  return Object.entries(config.mcpServers).filter(
    ([name, server]) => !isInternalMcpServer(name, server) && !server.disabled
  ).length;
}
