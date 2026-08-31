import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@fairlx/mcp-server";

import { mergeAgentMcpAuth } from "./agent-auth-scopes";

describe("mergeAgentMcpAuth", () => {
  it("keeps workspace admin manage scope when a project is selected", () => {
    const merged = mergeAgentMcpAuth({
      workspaceRole: "ADMIN",
      projectAccess: {
        hasAccess: true,
        isOwner: false,
        permissions: [PERMISSIONS.VIEW_PROJECT, PERMISSIONS.VIEW_TASKS, PERMISSIONS.EDIT_TASKS],
      },
    });
    expect(merged.scopes).toContain("admin:manage");
    expect(merged.scopes).toContain("tasks:write");
  });

  it("does not grant admin:manage to workspace members", () => {
    const merged = mergeAgentMcpAuth({
      workspaceRole: "MEMBER",
      projectAccess: {
        hasAccess: true,
        isOwner: false,
        permissions: [PERMISSIONS.VIEW_PROJECT, PERMISSIONS.CREATE_TASKS, PERMISSIONS.EDIT_TASKS],
      },
    });
    expect(merged.scopes).not.toContain("admin:manage");
  });
});
