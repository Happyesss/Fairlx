import { Hono } from "hono";
import integrations from "./route";
import mcp from "./mcp-route";

const app = new Hono()
  // MCP JSON-RPC protocol (must not collide with /mcp/tokens)
  .route("/mcp/rpc", mcp)
  .route("/", integrations);

export default app;
