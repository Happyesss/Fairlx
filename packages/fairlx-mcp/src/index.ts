import { handleMcpRequest } from "./protocol/dispatcher";
import { handleStreamableHttp } from "./http/streamable";
import type { McpRuntime } from "./runtime/types";

export { handleMcpRequest, MCP_SERVER_INFO } from "./protocol/dispatcher";
export { handleStreamableHttp } from "./http/streamable";
export { TOOL_CATALOG, getToolDefinition, listToolsForClient, wouldCreateCycle } from "./tools";
export { RESOURCE_TEMPLATES, listResources, listResourceTemplates } from "./resources/catalog";
export { PROMPT_CATALOG, listPrompts, getPrompt } from "./prompts/catalog";
export { SKILLS, getSkill, listSkills } from "./skills/registry";
export { authenticateBearer, isFairlxSecretToken } from "./auth/dual-auth";
export { DEFAULT_LEGACY_SCOPES, PERMISSIONS } from "./runtime/types";
export { McpError, notFoundError } from "./protocol/errors";
export type { McpRuntime, McpStore, McpRedis, McpCollections, McpTokenRecord, McpQuery } from "./runtime/types";
export type { AuthContext } from "./auth/context";

export function createMcpServer(runtime: McpRuntime) {
  return {
    runtime,
    handleRequest: (body: unknown, authorization?: string) =>
      handleMcpRequest(runtime, body, authorization),
    handleHttp: (method: string, body: unknown, authorization?: string) =>
      handleStreamableHttp({ runtime, method, body, authorization }),
  };
}
