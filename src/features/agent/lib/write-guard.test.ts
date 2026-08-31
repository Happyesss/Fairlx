import { describe, expect, it } from "vitest";

import { confirmationSummary, findPendingConfirmation, isWriteToolCall } from "./write-guard";
import type { AgentToolCall } from "../types";

function call(name: string, args: Record<string, unknown> = {}): AgentToolCall {
  return { id: "c1", name, arguments: JSON.stringify(args) };
}

describe("isWriteToolCall", () => {
  it("treats create/update/delete MCP tools as writes", () => {
    expect(isWriteToolCall(call("fairlx_work_item_create", { title: "Bug" }))).toBe(true);
    expect(isWriteToolCall(call("fairlx_work_item_update", { workItemId: "x" }))).toBe(true);
    expect(isWriteToolCall(call("fairlx_work_item_delete", { workItemId: "x" }))).toBe(true);
    expect(isWriteToolCall(call("fairlx_workspace_member_update", { name: "Ada", role: "ADMIN" }))).toBe(true);
    expect(
      isWriteToolCall(call("mcp_call", { server: "fairlx", tool: "fairlx_project_create", arguments: { name: "N" } })),
    ).toBe(true);
  });

  it("allows reads without confirmation", () => {
    expect(isWriteToolCall(call("list_work_items"))).toBe(false);
    expect(
      isWriteToolCall(call("mcp_call", { server: "fairlx", tool: "fairlx_workspace_members_list" })),
    ).toBe(false);
  });

  it("summarizes a member role change for Accept/Deny", () => {
    expect(
      confirmationSummary(call("fairlx_workspace_member_update", { name: "Shashank Kumar Rathour", role: "ADMIN" })),
    ).toBe("Make Shashank Kumar Rathour ADMIN?");
  });
});

describe("findPendingConfirmation", () => {
  it("clears after confirmation_resolved so Accept/Deny does not stick", () => {
    const pending = findPendingConfirmation([
      {
        id: "e1",
        type: "confirmation",
        title: "Make Ada ADMIN?",
        payload: { calls: [call("fairlx_workspace_member_update", { name: "Ada", role: "ADMIN" })], summary: "Make Ada ADMIN?" },
        createdAt: new Date().toISOString(),
        runId: "r1",
      },
      {
        id: "e2",
        type: "confirmation_resolved",
        title: "Accepted",
        createdAt: new Date().toISOString(),
        runId: "r1",
      },
    ]);
    expect(pending).toBeUndefined();
  });
});
