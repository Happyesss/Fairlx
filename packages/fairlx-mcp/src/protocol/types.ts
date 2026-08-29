export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
}

export interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: JsonRpcError;
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

export const MCP_PROTOCOL_VERSIONS = [
  "2026-07-28",
  "2025-03-26",
  "2024-11-05",
] as const;

export const PREFERRED_PROTOCOL_VERSION = "2026-07-28";

export type McpProtocolVersion = (typeof MCP_PROTOCOL_VERSIONS)[number];

export type RiskTier = 1 | 2 | 3 | 4 | 5 | 6;

export type RateClass = "read" | "write" | "destructive";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  riskTier: RiskTier;
  rateClass: RateClass;
  scopes: string[];
  permission?: string;
}

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface McpResourceTemplate {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface McpPromptDefinition {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

export interface McpContentItem {
  type: "text";
  text: string;
}

export interface McpToolResult {
  content: McpContentItem[];
  isError?: boolean;
}

export interface McpServerInfo {
  name: string;
  version: string;
}
