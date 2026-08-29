// Prototype JSON-RPC at /api/integrations/mcp/rpc. Production MCP is POST /api/mcp.
import { Hono } from "hono";
import { ID, Query } from "node-appwrite";
import { createAdminClient } from "@/lib/appwrite";
import {
  DATABASE_ID,
  WORK_ITEMS_ID,
  SPRINTS_ID,
  COMMENTS_ID,
  MCP_API_TOKENS_ID,
} from "@/config";
import { McpApiToken } from "../types";
import { hashMcpToken } from "../lib/helpers";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

async function authenticateMcp(
  authHeader: string | undefined
): Promise<{ projectId?: string; workspaceId: string; tokenId: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const plaintext = authHeader.slice(7).trim();
  if (!plaintext) return null;

  const { databases } = await createAdminClient();
  const hash = hashMcpToken(plaintext);

  try {
    const tokens = await databases.listDocuments<McpApiToken>(
      DATABASE_ID,
      MCP_API_TOKENS_ID,
      [Query.equal("tokenHash", hash), Query.limit(1)]
    );
    const token = tokens.documents[0];
    if (!token) return null;

    await databases
      .updateDocument(DATABASE_ID, MCP_API_TOKENS_ID, token.$id, {
        lastUsedAt: new Date().toISOString(),
      })
      .catch(() => undefined);

    return {
      projectId: token.projectId || undefined,
      workspaceId: token.workspaceId,
      tokenId: token.$id,
    };
  } catch {
    return null;
  }
}

const TOOLS = [
  {
    name: "list_work_items",
    description: "List work items in the authenticated Fairlx project",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
        sprintId: { type: "string" },
      },
    },
  },
  {
    name: "get_work_item",
    description: "Get a work item by id",
    inputSchema: {
      type: "object",
      properties: { workItemId: { type: "string" } },
      required: ["workItemId"],
    },
  },
  {
    name: "create_work_item",
    description: "Create a work item in the project",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        type: { type: "string" },
        priority: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_work_item",
    description: "Update fields on a work item",
    inputSchema: {
      type: "object",
      properties: {
        workItemId: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        priority: { type: "string" },
      },
      required: ["workItemId"],
    },
  },
  {
    name: "add_comment",
    description: "Add a comment to a work item",
    inputSchema: {
      type: "object",
      properties: {
        workItemId: { type: "string" },
        content: { type: "string" },
      },
      required: ["workItemId", "content"],
    },
  },
  {
    name: "list_sprints",
    description: "List sprints for the project",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number" } },
    },
  },
];

async function callTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { projectId?: string; workspaceId: string }
) {
  const { databases } = await createAdminClient();
  const projectId = ctx.projectId ?? (typeof args.projectId === "string" ? args.projectId : "");
  if (!projectId) throw new Error("projectId is required (use a project-scoped token or pass projectId)");

  switch (name) {
    case "list_work_items": {
      const queries = [
        Query.equal("projectId", projectId),
        Query.limit(Math.min(Number(args.limit) || 50, 100)),
        Query.orderDesc("$createdAt"),
      ];
      if (args.sprintId) queries.push(Query.equal("sprintId", String(args.sprintId)));
      const result = await databases.listDocuments(DATABASE_ID, WORK_ITEMS_ID, queries);
      return result.documents.map((d) => ({
        id: d.$id,
        key: d.key,
        title: d.title,
        status: d.status,
        type: d.type,
        priority: d.priority,
        sprintId: d.sprintId,
      }));
    }
    case "get_work_item": {
      const item = await databases.getDocument(
        DATABASE_ID,
        WORK_ITEMS_ID,
        String(args.workItemId)
      );
      if (item.projectId !== projectId) throw new Error("Work item not in project");
      return item;
    }
    case "create_work_item": {
      const existing = await databases.listDocuments(DATABASE_ID, WORK_ITEMS_ID, [
        Query.equal("projectId", projectId),
        Query.limit(1),
      ]);
      const key = `AI-${(existing.total || 0) + 1}`;
      const doc = await databases.createDocument(DATABASE_ID, WORK_ITEMS_ID, ID.unique(), {
        workspaceId: ctx.workspaceId,
        projectId: projectId,
        title: String(args.title),
        description: args.description ? String(args.description) : null,
        key,
        type: String(args.type || "TASK"),
        status: "TODO",
        priority: String(args.priority || "MEDIUM"),
        assigneeIds: [],
        reporterId: "mcp",
      });
      return { id: doc.$id, key: doc.key, title: doc.title };
    }
    case "update_work_item": {
      const id = String(args.workItemId);
      const item = await databases.getDocument(DATABASE_ID, WORK_ITEMS_ID, id);
      if (item.projectId !== projectId) throw new Error("Work item not in project");
      const updates: Record<string, unknown> = {};
      if (args.title !== undefined) updates.title = args.title;
      if (args.description !== undefined) updates.description = args.description;
      if (args.status !== undefined) updates.status = args.status;
      if (args.priority !== undefined) updates.priority = args.priority;
      const updated = await databases.updateDocument(DATABASE_ID, WORK_ITEMS_ID, id, updates);
      return { id: updated.$id, key: updated.key, status: updated.status, title: updated.title };
    }
    case "add_comment": {
      const workItemId = String(args.workItemId);
      const item = await databases.getDocument(DATABASE_ID, WORK_ITEMS_ID, workItemId);
      if (item.projectId !== projectId) throw new Error("Work item not in project");
      const comment = await databases.createDocument(DATABASE_ID, COMMENTS_ID, ID.unique(), {
        workspaceId: ctx.workspaceId,
        taskId: workItemId,
        content: String(args.content),
        authorId: "mcp",
      });
      return { id: comment.$id, content: comment.content };
    }
    case "list_sprints": {
      const result = await databases.listDocuments(DATABASE_ID, SPRINTS_ID, [
        Query.equal("projectId", projectId),
        Query.limit(Math.min(Number(args.limit) || 50, 100)),
        Query.orderDesc("$createdAt"),
      ]);
      return result.documents.map((d) => ({
        id: d.$id,
        name: d.name,
        status: d.status,
        startDate: d.startDate,
        endDate: d.endDate,
      }));
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function rpcResult(id: JsonRpcId | undefined, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(id: JsonRpcId | undefined, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

const app = new Hono()
  .get("/", async (c) => {
    return c.json({
      name: "fairlx",
      version: "1.0.0",
      protocol: "mcp-jsonrpc",
      transport: "http",
      auth: "Bearer <mcp_api_token>",
      tools: TOOLS.map((t) => t.name),
    });
  })
  .post("/", async (c) => {
    const auth = await authenticateMcp(c.req.header("Authorization"));
    if (!auth) {
      return c.json(rpcError(null, -32001, "Unauthorized"), 401);
    }

    const body = await c.req.json<JsonRpcRequest>();
    const method = body.method || "";
    const id = body.id;

    try {
      if (method === "initialize") {
        return c.json(
          rpcResult(id, {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "fairlx", version: "1.0.0" },
          })
        );
      }

      if (method === "tools/list" || method === "list_tools") {
        return c.json(rpcResult(id, { tools: TOOLS }));
      }

      if (method === "tools/call" || method === "call_tool") {
        const params = body.params || {};
        const name = String(params.name || "");
        const args = (params.arguments || params.args || {}) as Record<string, unknown>;
        const result = await callTool(name, args, auth);
        return c.json(
          rpcResult(id, {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          })
        );
      }

      // Convenience non-RPC: { tool, arguments }
      if ((body as { tool?: string }).tool) {
        const tool = String((body as { tool: string }).tool);
        const args = ((body as { arguments?: Record<string, unknown> }).arguments ||
          {}) as Record<string, unknown>;
        const result = await callTool(tool, args, auth);
        return c.json({ ok: true, result });
      }

      return c.json(rpcError(id, -32601, `Method not found: ${method}`));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tool error";
      return c.json(rpcError(id, -32000, message));
    }
  });

export default app;
