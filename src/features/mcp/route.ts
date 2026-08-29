import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { handleStreamableHttp } from "@fairlx/mcp-server";
import { createMcpRuntime } from "./bind-runtime";

const mcpApp = new Hono();

async function handleMcpHttp(c: Context) {
  const runtime = await createMcpRuntime();
  let body: unknown = {};
  if (c.req.method.toUpperCase() === "POST") {
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }
  }

  const result = await handleStreamableHttp({
    runtime,
    method: c.req.method,
    body,
    authorization: c.req.header("authorization") ?? undefined,
  });

  for (const [key, value] of Object.entries(result.headers)) {
    c.header(key, value);
  }

  if (result.status === 202 && (result.json === null || result.json === undefined)) {
    return c.body(null, 202);
  }

  return c.json(result.json as Record<string, unknown>, result.status as ContentfulStatusCode);
}

mcpApp.all("/", handleMcpHttp);
mcpApp.all("", handleMcpHttp);

export default mcpApp;
