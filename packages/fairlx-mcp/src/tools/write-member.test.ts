import { describe, expect, it, vi } from "vitest";
import { jwtToAuthContext } from "../auth/context";
import type { McpRuntime } from "../runtime/types";
import { callTool } from "./index";

function memberDoc(overrides: Record<string, unknown>) {
  return {
    $id: "mem_actor",
    workspaceId: "ws_1",
    userId: "admin_1",
    role: "ADMIN",
    status: "ACTIVE",
    name: null,
    email: null,
    ...overrides,
  };
}

function runtimeWithMembers(docs: Record<string, unknown>[], onMembershipChanged = vi.fn()) {
  const members = docs.map((doc) => ({ ...doc }));
  const profiles = new Map(
    members.map((doc) => [
      String(doc.userId),
      {
        id: String(doc.userId),
        name: String(doc.displayName ?? doc.userId),
        email: String(doc.displayEmail ?? `${doc.userId}@fairlx.dev`),
      },
    ]),
  );

  const runtime = {
    collections: { members: "members" },
    store: {
      list: async (_collection: string, queries: Array<{ type: string; field?: string; value?: unknown }>) => {
        let filtered = members;
        for (const query of queries) {
          if (query.type === "equal" && query.field) {
            filtered = filtered.filter((doc) => doc[query.field as string] === query.value);
          }
        }
        return { documents: filtered, total: filtered.length };
      },
      update: async (_collection: string, id: string, data: Record<string, unknown>) => {
        const doc = members.find((item) => item.$id === id);
        if (!doc) throw new Error("missing");
        Object.assign(doc, data);
        return doc;
      },
      get: async () => {
        throw new Error("unused");
      },
    },
    lookupUsers: async (userIds: string[]) =>
      userIds.map((id) => profiles.get(id) ?? { id, name: "", email: "" }),
    onMembershipChanged,
  } as unknown as McpRuntime;

  return { runtime, members, onMembershipChanged };
}

const adminAuth = jwtToAuthContext("admin_1", {
  workspaceId: "ws_1",
  scopes: ["admin:manage", "members:read"],
});

describe("fairlx_workspace_member_update", () => {
  it("promotes a member to ADMIN by a close name match", async () => {
    const { runtime, members, onMembershipChanged } = runtimeWithMembers([
      memberDoc({ displayName: "Ada Admin" }),
      memberDoc({
        $id: "mem_shashank",
        userId: "user_shashank",
        role: "MEMBER",
        displayName: "Shashank Kumar Rathour",
        displayEmail: "shashank@fairlx.dev",
      }),
    ]);

    const result = await callTool(
      "fairlx_workspace_member_update",
      { workspaceId: "ws_1", name: "Shashank Kumar Rathore", role: "ADMIN" },
      runtime,
      adminAuth,
    );

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0]?.text ?? "{}")).toMatchObject({
      member: { name: "Shashank Kumar Rathour", role: "ADMIN" },
    });
    expect(members.find((doc) => doc.$id === "mem_shashank")?.role).toBe("ADMIN");
    expect(onMembershipChanged).toHaveBeenCalledWith({
      userId: "user_shashank",
      workspaceId: "ws_1",
    });
  });

  it("refuses when the actor is only a workspace member", async () => {
    const { runtime } = runtimeWithMembers([
      memberDoc({ userId: "member_1", role: "MEMBER", displayName: "Ada" }),
      memberDoc({
        $id: "mem_shashank",
        userId: "user_shashank",
        role: "MEMBER",
        displayName: "Shashank Kumar Rathour",
      }),
    ]);

    await expect(
      callTool(
        "fairlx_workspace_member_update",
        { workspaceId: "ws_1", name: "Shashank Kumar Rathour", role: "ADMIN" },
        runtime,
        jwtToAuthContext("member_1", { workspaceId: "ws_1", scopes: ["members:read"] }),
      ),
    ).rejects.toMatchObject({ httpStatus: 403 });
  });
});
