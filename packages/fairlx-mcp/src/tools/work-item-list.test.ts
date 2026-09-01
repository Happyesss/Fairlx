import { describe, expect, it } from "vitest";
import { jwtToAuthContext } from "../auth/context";
import { PERMISSIONS, type McpQuery, type McpRuntime } from "../runtime/types";
import { callTool } from "./index";

function listRuntime(documents: Record<string, unknown>[]) {
  const seen: McpQuery[][] = [];
  const runtime = {
    collections: { workItems: "work_items" },
    store: {
      list: async (_collection: string, queries: McpQuery[]) => {
        seen.push(queries);
        const cursor = queries.find((query) => query.type === "cursorAfter");
        expect(cursor).toBeUndefined();
        return { documents, total: documents.length };
      },
    },
    resolveUserProjectAccess: async () => ({
      hasAccess: true,
      isOwner: false,
      isAdmin: false,
      permissions: [PERMISSIONS.VIEW_TASKS],
      role: "MEMBER",
    }),
    hasProjectPermission: (access: { permissions: string[] }, permission: string) =>
      access.permissions.includes(permission),
  } as unknown as McpRuntime;
  return { runtime, seen };
}

describe("fairlx_work_item_list", () => {
  it("ignores key-shaped cursorAfter and still returns page 1", async () => {
    const docs = [
      { $id: "doc_a", key: "WEB-1", title: "One", status: "TODO", type: "TASK" },
      { $id: "doc_b", key: "WEB-2", title: "Two", status: "TODO", type: "BUG" },
    ];
    const { runtime, seen } = listRuntime(docs);
    const result = await callTool(
      "fairlx_work_item_list",
      { projectId: "p1", cursorAfter: "WEB-2" },
      runtime,
      jwtToAuthContext("u1", { workspaceId: "ws_1", projectId: "p1", scopes: ["tasks:read"] }),
    );
    const payload = JSON.parse(result.content[0]?.text ?? "{}") as {
      hasMore: boolean;
      nextCursor: string | null;
      error?: string;
      workItems: unknown[];
    };
    expect(payload.error).toMatch(/nextCursor/);
    expect(payload.workItems).toHaveLength(2);
    expect(payload.hasMore).toBe(false);
    expect(seen).toHaveLength(1);
  });
});
