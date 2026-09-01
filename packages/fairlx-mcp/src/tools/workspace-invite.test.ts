import { describe, expect, it } from "vitest";
import { jwtToAuthContext } from "../auth/context";
import { FORBIDDEN_ERROR } from "../protocol/errors";
import type { McpQuery, McpRuntime } from "../runtime/types";
import { callTool } from "./index";

function inviteRuntime(options: {
  workspace: Record<string, unknown>;
  members: Record<string, unknown>[];
}) {
  const runtime = {
    collections: { workspaces: "workspaces", members: "members" },
    store: {
      get: async (collection: string, id: string) => {
        if (collection === "workspaces" && id === String(options.workspace.$id)) {
          return options.workspace;
        }
        throw new Error("not found");
      },
      list: async (_collection: string, queries: McpQuery[]) => {
        let documents = options.members;
        for (const query of queries) {
          if (query.type === "equal") {
            documents = documents.filter((doc) => doc[query.field] === query.value);
          }
        }
        return { documents, total: documents.length };
      },
    },
    resolveUserProjectAccess: async () => ({
      hasAccess: true,
      isOwner: false,
      isAdmin: true,
      permissions: [],
      role: "ADMIN",
    }),
    hasProjectPermission: () => true,
  } as unknown as McpRuntime;
  return runtime;
}

function payloadOf(result: { content: Array<{ text?: string }> }) {
  return JSON.parse(result.content[0]?.text ?? "{}") as Record<string, unknown>;
}

const adminAuth = jwtToAuthContext("admin_1", {
  workspaceId: "ws_1",
  scopes: ["members:read"],
});

describe("fairlx_workspace_invite_get", () => {
  it("returns the same join URL as Members → Quick Invite", async () => {
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.fairlx.dev";
    try {
      const runtime = inviteRuntime({
        workspace: { $id: "ws_1", name: "Acme", inviteCode: "abc123" },
        members: [{ $id: "m1", userId: "admin_1", workspaceId: "ws_1", role: "ADMIN" }],
      });
      const result = await callTool("fairlx_workspace_invite_get", { workspaceId: "ws_1" }, runtime, adminAuth);
      expect(payloadOf(result)).toEqual({
        available: true,
        workspace: "Acme",
        inviteUrl: "https://app.fairlx.dev/workspaces/ws_1/join/abc123",
      });
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = previous;
    }
  });

  it("does not expose invite links for organization workspaces", async () => {
    const runtime = inviteRuntime({
      workspace: { $id: "ws_1", name: "Stemlen", inviteCode: "abc123", organizationId: "org_1" },
      members: [{ $id: "m1", userId: "admin_1", workspaceId: "ws_1", role: "OWNER" }],
    });
    const result = await callTool("fairlx_workspace_invite_get", { workspaceId: "ws_1" }, runtime, adminAuth);
    expect(payloadOf(result)).toMatchObject({
      available: false,
      reason: "ORG_INVITE_DISABLED",
    });
  });

  it("forbids members who are not admins", async () => {
    const runtime = inviteRuntime({
      workspace: { $id: "ws_1", name: "Acme", inviteCode: "abc123" },
      members: [{ $id: "m2", userId: "admin_1", workspaceId: "ws_1", role: "MEMBER" }],
    });
    await expect(
      callTool("fairlx_workspace_invite_get", { workspaceId: "ws_1" }, runtime, adminAuth),
    ).rejects.toMatchObject({ code: FORBIDDEN_ERROR });
  });
});
