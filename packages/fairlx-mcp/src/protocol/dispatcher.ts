import { authenticateBearer } from "../auth/dual-auth";
import type { AuthContext } from "../auth/context";
import { listPrompts, getPrompt } from "../prompts/catalog";
import { listResources, listResourceTemplates } from "../resources/catalog";
import { readResource } from "../resources/resolve";
import { requireConfirmation } from "../runtime/confirmation";
import { toolResult } from "../runtime/output";
import { checkMcpRateLimit } from "../runtime/rate-limit";
import type { McpRuntime } from "../runtime/types";
import { callTool, getToolDefinition, listToolsForClient } from "../tools";
import { McpError, errorToRpc, invalidParams, methodNotFound } from "./errors";
import { asRecord, asString, isNotification, negotiateProtocolVersion, parseJsonRpc } from "./jsonrpc";
import type { JsonRpcRequest, JsonRpcResponse, McpServerInfo } from "./types";

export const MCP_SERVER_INFO: McpServerInfo = {
  name: "fairlx-mcp",
  version: "1.0.0",
};

const INSTRUCTIONS =
  "Fairlx MCP server. Use tools for project work. Untrusted user content is wrapped in <fairlx_untrusted_content> tags. High-risk writes need confirm:true. Destructive tools also need a one-time challengeToken. Tenant-hidden resources return Not found.";

export async function handleMcpRequest(
  runtime: McpRuntime,
  body: string | unknown,
  authorization: string | undefined
): Promise<{ status: number; json: JsonRpcResponse | null }> {
  const raw = typeof body === "string" ? body : JSON.stringify(body ?? {});
  const parsed = parseJsonRpc(raw);
  if (parsed.error) {
    return { status: 400, json: parsed.error };
  }
  const req = parsed.request!;
  const id = req.id ?? null;

  try {
    const auth = await authenticateBearer(runtime, authorization);

    if (req.method === "notifications/initialized") {
      if (isNotification(req)) {
        return { status: 202, json: null };
      }
      return { status: 200, json: { jsonrpc: "2.0", id, result: {} } };
    }

    if (isNotification(req)) {
      return { status: 202, json: null };
    }

    const result = await dispatch(runtime, auth, req);
    return { status: 200, json: { jsonrpc: "2.0", id, result } };
  } catch (error) {
    const rpc = errorToRpc(isNotification(req) ? null : id, error);
    const status = error instanceof McpError ? error.httpStatus : 200;
    return { status, json: rpc };
  }
}

async function dispatch(
  runtime: McpRuntime,
  auth: AuthContext,
  req: JsonRpcRequest
): Promise<unknown> {
  const method = req.method ?? "";
  const params = asRecord(req.params);

  switch (method) {
    case "initialize": {
      const protocolVersion = negotiateProtocolVersion(asString(params.protocolVersion));
      return {
        protocolVersion,
        capabilities: {
          tools: {},
          resources: { subscribe: false },
          prompts: {},
        },
        serverInfo: MCP_SERVER_INFO,
        instructions: INSTRUCTIONS,
      };
    }
    case "ping":
      return {};
    case "tools/list":
      return { tools: listToolsForClient(auth) };
    case "tools/call":
      return callNamedTool(runtime, auth, params);
    case "resources/list":
      return { resources: listResources(auth) };
    case "resources/templates/list":
      return { resourceTemplates: listResourceTemplates() };
    case "resources/read": {
      const uri = asString(params.uri);
      if (!uri) throw invalidParams("uri is required");
      return readResource(runtime, auth, uri);
    }
    case "prompts/list":
      return { prompts: listPrompts() };
    case "prompts/get": {
      const name = asString(params.name);
      if (!name) throw invalidParams("name is required");
      return getPrompt(name, asRecord(params.arguments));
    }
    default:
      throw methodNotFound(method);
  }
}

async function callNamedTool(
  runtime: McpRuntime,
  auth: AuthContext,
  params: Record<string, unknown>
) {
  const name = asString(params.name);
  if (!name) throw invalidParams("name is required");
  const args = asRecord(params.arguments);
  const def = getToolDefinition(name);
  if (!def) throw methodNotFound(name);

  const rl = await checkMcpRateLimit(runtime, auth, def.rateClass);
  if (!rl.allowed) {
    return toolResult(
      {
        code: "RATE_LIMITED",
        message: `Rate limit exceeded for ${def.rateClass} tools`,
        remaining: rl.remaining,
        rateClass: def.rateClass,
      },
      true
    );
  }

  if (def.riskTier === 3 || def.riskTier === 4 || def.riskTier === 6) {
    const confirmation = await requireConfirmation({
      runtime,
      auth,
      tool: name,
      args,
      tier: def.riskTier,
    });
    if (confirmation) return confirmation;
  }

  return callTool(name, args, runtime, auth);
}
