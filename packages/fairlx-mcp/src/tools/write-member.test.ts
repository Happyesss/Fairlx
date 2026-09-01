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

function runtimeWithMembers(
  docs: Record<string, unknown>[],
  onMembershipChanged = vi.fn(),
  options?: {
    workspace?: Record<string, unknown>;
    orgMembers?: Record<string, unknown>[];
  },
) {
  const members = docs.map((doc) => ({ ...doc }));
  const orgMembers = (options?.orgMembers ?? []).map((doc) => ({ ...doc }));
  const workspace = options?.workspace ?? { $id: "ws_1", name: "Acme" };
  const profiles = new Map(
    [...members, ...orgMembers].map((doc) => [
      String(doc.userId),
      {
        id: String(doc.userId),
        name: String(doc.displayName ?? doc.userId),
        email: String(doc.displayEmail ?? `${doc.userId}@fairlx.dev`),
      },
    ]),
  );

  const runtime = {
    collections: { members: "members", workspaces: "workspaces", organizationMembers: "organization_members" },
    store: {
      list: async (collection: string, queries: Array<{ type: string; field?: string; value?: unknown }>) => {
        let filtered = collection === "organization_members" ? orgMembers : members;
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
      create: async (_collection: string, data: Record<string, unknown>) => {
        const doc = { $id: `mem_${members.length + 1}`, ...data };
        members.push(doc);
        return doc;
      },
      delete: async (_collection: string, id: string) => {
        const index = members.findIndex((item) => item.$id === id);
        if (index >= 0) members.splice(index, 1);
      },
      get: async (collection: string, id: string) => {
        if (collection === "workspaces" && id === String(workspace.$id)) return workspace;
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

describe("fairlx_workspace_member_add", () => {
  it("adds an organization member to the workspace by name", async () => {
    const { runtime, members, onMembershipChanged } = runtimeWithMembers(
      [memberDoc({ displayName: "Ada Admin" })],
      vi.fn(),
      {
        workspace: { $id: "ws_1", name: "Stemlen", organizationId: "org_1" },
        orgMembers: [
          {
            $id: "org_ada",
            organizationId: "org_1",
            userId: "admin_1",
            displayName: "Ada Admin",
            displayEmail: "ada@fairlx.dev",
          },
          {
            $id: "org_ragul",
            organizationId: "org_1",
            userId: "user_ragul",
            displayName: "Ragul",
            displayEmail: "ragul@fairlx.dev",
          },
        ],
      },
    );

    const result = await callTool(
      "fairlx_workspace_member_add",
      { workspaceId: "ws_1", name: "Ragul" },
      runtime,
      adminAuth,
    );

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0]?.text ?? "{}")).toMatchObject({
      added: true,
      member: { name: "Ragul", role: "MEMBER" },
    });
    expect(members.some((doc) => doc.userId === "user_ragul")).toBe(true);
    expect(onMembershipChanged).toHaveBeenCalledWith({ userId: "user_ragul", workspaceId: "ws_1" });
  });

  it("refuses when the person is already a workspace member", async () => {
    const { runtime } = runtimeWithMembers(
      [
        memberDoc({ displayName: "Ada Admin" }),
        memberDoc({
          $id: "mem_ragul",
          userId: "user_ragul",
          role: "MEMBER",
          displayName: "Ragul",
          displayEmail: "ragul@fairlx.dev",
        }),
      ],
      vi.fn(),
      {
        workspace: { $id: "ws_1", name: "Stemlen", organizationId: "org_1" },
        orgMembers: [
          {
            $id: "org_ragul",
            organizationId: "org_1",
            userId: "user_ragul",
            displayName: "Ragul",
            displayEmail: "ragul@fairlx.dev",
          },
        ],
      },
    );

    const result = await callTool(
      "fairlx_workspace_member_add",
      { workspaceId: "ws_1", name: "Ragul" },
      runtime,
      adminAuth,
    );

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0]?.text ?? "{}").error).toMatch(/already a workspace member/i);
  });

  it("points personal workspaces at the invite tool", async () => {
    const { runtime } = runtimeWithMembers([memberDoc({ displayName: "Ada Admin" })]);

    const result = await callTool(
      "fairlx_workspace_member_add",
      { workspaceId: "ws_1", name: "Ragul" },
      runtime,
      adminAuth,
    );

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0]?.text ?? "{}").error).toMatch(/invite/i);
  });
});

describe("fairlx_workspace_member_remove", () => {
  it("removes a workspace member by name", async () => {
    const { runtime, members } = runtimeWithMembers([
      memberDoc({ displayName: "Ada Admin" }),
      memberDoc({
        $id: "mem_ragul",
        userId: "user_ragul",
        role: "MEMBER",
        displayName: "Ragul",
        displayEmail: "ragul@fairlx.dev",
      }),
    ]);

    const result = await callTool(
      "fairlx_workspace_member_remove",
      { workspaceId: "ws_1", name: "Ragul" },
      runtime,
      adminAuth,
    );

    expect(JSON.parse(result.content[0]?.text ?? "{}")).toMatchObject({
      removed: true,
      member: { name: "Ragul" },
    });
    expect(members.find((doc) => doc.$id === "mem_ragul")).toBeUndefined();
  });

  it("refuses to remove the owner", async () => {
    const { runtime } = runtimeWithMembers([
      memberDoc({ displayName: "Ada Admin" }),
      memberDoc({
        $id: "mem_owner",
        userId: "user_owner",
        role: "OWNER",
        displayName: "Pat Owner",
        displayEmail: "pat@fairlx.dev",
      }),
    ]);

    await expect(
      callTool(
        "fairlx_workspace_member_remove",
        { workspaceId: "ws_1", name: "Pat Owner" },
        runtime,
        adminAuth,
      ),
    ).rejects.toMatchObject({ httpStatus: 403 });
  });
});

describe("fairlx_organization_members_list", () => {
  it("marks who is already on the workspace", async () => {
    const { runtime } = runtimeWithMembers(
      [memberDoc({ displayName: "Ada Admin" })],
      vi.fn(),
      {
        workspace: { $id: "ws_1", name: "Stemlen", organizationId: "org_1" },
        orgMembers: [
          {
            $id: "org_ada",
            organizationId: "org_1",
            userId: "admin_1",
            displayName: "Ada Admin",
            displayEmail: "ada@fairlx.dev",
          },
          {
            $id: "org_ragul",
            organizationId: "org_1",
            userId: "user_ragul",
            displayName: "Ragul",
            displayEmail: "ragul@fairlx.dev",
          },
        ],
      },
    );

    const result = await callTool(
      "fairlx_organization_members_list",
      { workspaceId: "ws_1" },
      runtime,
      adminAuth,
    );

    expect(JSON.parse(result.content[0]?.text ?? "{}")).toMatchObject({
      organization: true,
      members: [
        { name: "Ada Admin", inWorkspace: true },
        { name: "Ragul", inWorkspace: false },
      ],
    });
  });
});
