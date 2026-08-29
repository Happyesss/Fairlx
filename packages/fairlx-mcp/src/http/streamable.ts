import { handleMcpRequest } from "../protocol/dispatcher";
import type { McpRuntime } from "../runtime/types";

export async function handleStreamableHttp(options: {
  runtime: McpRuntime;
  method: string;
  body?: unknown;
  authorization?: string;
}): Promise<{ status: number; json: unknown; headers: Record<string, string> }> {
  const method = options.method.toUpperCase();
  const headers = { "Content-Type": "application/json" };

  if (method !== "POST") {
    return {
      status: 405,
      json: { error: "Method not allowed. Use POST for Streamable HTTP MCP." },
      headers: { ...headers, Allow: "POST" },
    };
  }

  const result = await handleMcpRequest(
    options.runtime,
    options.body ?? {},
    options.authorization
  );

  return {
    status: result.status,
    json: result.json,
    headers,
  };
}
