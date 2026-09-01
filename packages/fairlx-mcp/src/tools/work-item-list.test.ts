import { describe, expect, it } from "vitest";
import { jwtToAuthContext } from "../auth/context";
import { PERMISSIONS, type McpQuery, type McpRuntime } from "../runtime/types";
import { callTool } from "./index";

function listRuntime(options: {
  documents: Record<string, unknown>[];
  members?: Record<string, unknown>[];
      profiles?: Array<{ id: string; name: string; email: string; profileImageUrl?: string | null }>;
}) {
  const seen: McpQuery[][] = [];
  const members = options.members ?? [];
  const runtime = {
    collections: {
      workItems: "work_items",
      ...(options.members ? { members: "members" } : {}),
    },
    store: {
      list: async (collection: string, queries: McpQuery[]) => {
        seen.push(queries);
        if (collection === "members") {
          const equal = queries.find((query) => query.type === "equal" && query.field === "$id");
          const wanted = equal && "value" in equal
            ? Array.isArray(equal.value)
              ? equal.value.map(String)
              : [String(equal.value)]
            : [];
          const documents = wanted.length
            ? members.filter((member) => wanted.includes(String(member.$id)))
            : members;
          return { documents, total: documents.length };
        }
        const cursor = queries.find((query) => query.type === "cursorAfter");
        const limitQuery = queries.find((query) => query.type === "limit");
        const limit = limitQuery && "value" in limitQuery ? Number(limitQuery.value) : 50;
        let start = 0;
        if (cursor && "value" in cursor) {
          const index = options.documents.findIndex((doc) => String(doc.$id) === String(cursor.value));
          start = index >= 0 ? index + 1 : 0;
        }
        const documents = options.documents.slice(start, start + limit);
        return { documents, total: options.documents.length };
      },
      get: async (collection: string, id: string) => {
        if (collection === "members") {
          const member = members.find((doc) => String(doc.$id) === id);
          if (!member) throw new Error("not found");
          return member;
        }
        throw new Error("not found");
      },
    },
    lookupUsers: options.profiles
      ? async () => options.profiles!
      : undefined,
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

function payloadOf(result: { content: Array<{ text?: string }> }) {
  return JSON.parse(result.content[0]?.text ?? "{}") as {
    hasMore: boolean;
    nextCursor: string | null;
    returned: number;
    total: number;
    matched?: number;
    unassignedCount?: number;
    error?: string;
    workItems: Array<{
      key?: string;
      title?: string;
      type?: string;
      assignees?: Array<string | { name?: string; imageUrl?: string | null }>;
      unassigned?: boolean;
    }>;
  };
}

describe("fairlx_work_item_list", () => {
  it("ignores key-shaped cursorAfter and still returns page 1", async () => {
    const docs = [
      { $id: "doc_a", key: "WEB-1", title: "One", status: "TODO", type: "TASK" },
      { $id: "doc_b", key: "WEB-2", title: "Two", status: "TODO", type: "BUG" },
    ];
    const { runtime, seen } = listRuntime({ documents: docs });
    const result = await callTool(
      "fairlx_work_item_list",
      { projectId: "p1", cursorAfter: "WEB-2" },
      runtime,
      jwtToAuthContext("u1", { workspaceId: "ws_1", projectId: "p1", scopes: ["tasks:read"] }),
    );
    const payload = payloadOf(result);
    expect(payload.error).toMatch(/nextCursor/);
    expect(payload.workItems).toHaveLength(2);
    expect(payload.hasMore).toBe(false);
    expect(seen).toHaveLength(1);
  });

  it("returns empty-assignee and stale-member items as unassigned, including bugs", async () => {
    const docs = [
      {
        $id: "d1",
        key: "PROJ-1",
        title: "Empty assignees",
        status: "TODO",
        type: "TASK",
        assigneeIds: [],
      },
      {
        $id: "d2",
        key: "PROJ-2",
        title: "Stale member",
        status: "ASSIGNED",
        type: "BUG",
        assigneeIds: ["gone"],
      },
      {
        $id: "d3",
        key: "PROJ-3",
        title: "Assigned to Ada",
        status: "TODO",
        type: "TASK",
        assigneeIds: ["m1"],
      },
    ];
    const { runtime } = listRuntime({
      documents: docs,
      members: [{ $id: "m1", userId: "u1", name: "Ada" }],
      profiles: [{ id: "u1", name: "Ada Lovelace", email: "ada@fairlx.dev" }],
    });
    const result = await callTool(
      "fairlx_work_item_list",
      { projectId: "p1", unassigned: true },
      runtime,
      jwtToAuthContext("u1", { workspaceId: "ws_1", projectId: "p1", scopes: ["tasks:read"] }),
    );
    const payload = payloadOf(result);
    expect(payload.workItems.map((item) => item.key)).toEqual(["PROJ-1", "PROJ-2"]);
    expect(payload.workItems.every((item) => item.unassigned)).toBe(true);
    expect(payload.unassignedCount).toBe(2);
    expect(payload.matched).toBe(2);
    expect(payload.workItems.some((item) => item.type === "BUG")).toBe(true);
    expect(payload.workItems.find((item) => item.key === "PROJ-3")).toBeUndefined();
  });

  it("hydrates current member names on assigned items", async () => {
    const { runtime } = listRuntime({
      documents: [
        {
          $id: "d3",
          key: "PROJ-3",
          title: "Assigned to Ada",
          status: "TODO",
          type: "TASK",
          assigneeIds: ["m1"],
        },
      ],
      members: [{ $id: "m1", userId: "u1", name: "Ada" }],
      profiles: [{ id: "u1", name: "Ada Lovelace", email: "ada@fairlx.dev" }],
    });
    const result = await callTool(
      "fairlx_work_item_list",
      { projectId: "p1" },
      runtime,
      jwtToAuthContext("u1", { workspaceId: "ws_1", projectId: "p1", scopes: ["tasks:read"] }),
    );
    const payload = payloadOf(result);
    expect(payload.workItems[0]).toMatchObject({
      key: "PROJ-3",
      assignees: [{ name: "Ada Lovelace", imageUrl: null }],
      unassigned: false,
    });
    expect(payload.workItems[0]).not.toHaveProperty("assigneeIds");
    expect(payload.workItems[0]).not.toHaveProperty("id");
  });

  it("includes assignee profile images from user prefs", async () => {
    const { runtime } = listRuntime({
      documents: [
        {
          $id: "d3",
          key: "PROJ-3",
          title: "Assigned to Ada",
          status: "TODO",
          type: "TASK",
          assigneeIds: ["m1"],
        },
      ],
      members: [{ $id: "m1", userId: "u1", name: "Ada" }],
      profiles: [
        {
          id: "u1",
          name: "Ada Lovelace",
          email: "ada@fairlx.dev",
          profileImageUrl: "https://cdn.example/ada.png",
        },
      ],
    });
    const result = await callTool(
      "fairlx_work_item_list",
      { projectId: "p1" },
      runtime,
      jwtToAuthContext("u1", { workspaceId: "ws_1", projectId: "p1", scopes: ["tasks:read"] }),
    );
    const payload = payloadOf(result);
    expect(payload.workItems[0]?.assignees).toEqual([
      { name: "Ada Lovelace", imageUrl: "https://cdn.example/ada.png" },
    ]);
  });

  it("auto-pages past the default page size so one unassigned call is complete", async () => {
    const docs = Array.from({ length: 150 }, (_, index) => ({
      $id: `doc_${index}`,
      key: `PROJ-${index + 1}`,
      title: `Item ${index}`,
      status: "TODO",
      type: index % 2 === 0 ? "TASK" : "BUG",
      assigneeIds: index < 3 ? [] : ["m1"],
    }));
    const { runtime, seen } = listRuntime({
      documents: docs,
      members: [{ $id: "m1", userId: "u1", name: "Ada" }],
      profiles: [{ id: "u1", name: "Ada", email: "ada@fairlx.dev" }],
    });
    const result = await callTool(
      "fairlx_work_item_list",
      { projectId: "p1", unassigned: true },
      runtime,
      jwtToAuthContext("u1", { workspaceId: "ws_1", projectId: "p1", scopes: ["tasks:read"] }),
    );
    const payload = payloadOf(result);
    expect(seen.length).toBeGreaterThan(1);
    expect(payload.workItems).toHaveLength(3);
    expect(payload.hasMore).toBe(false);
    expect(payload.unassignedCount).toBe(3);
  });
});
