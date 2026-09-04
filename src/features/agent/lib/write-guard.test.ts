import { describe, expect, it } from "vitest";

import {
  confirmationSummary,
  findPendingConfirmation,
  isWriteToolCall,
  parseConfirmationCall,
  parseWorkItemCall,
} from "./write-guard";
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
    expect(isWriteToolCall(call("fairlx_workspace_member_add", { name: "Ada" }))).toBe(true);
    expect(isWriteToolCall(call("fairlx_workspace_member_remove", { name: "Ada" }))).toBe(true);
    expect(isWriteToolCall(call("fairlx_project_team_create", { name: "Developers" }))).toBe(true);
    expect(isWriteToolCall(call("fairlx_project_team_member_add", { name: "Surendra" }))).toBe(true);
    expect(
      isWriteToolCall(call("mcp_call", { server: "fairlx", tool: "fairlx_project_create", arguments: { name: "N" } })),
    ).toBe(true);
    expect(isWriteToolCall(call("mail_send", { to: "ada@x.com", subject: "Hi", body: "x" }))).toBe(true);
    expect(isWriteToolCall(call("github_write_file", { path: "a.ts", content: "x" }))).toBe(true);
    expect(isWriteToolCall(call("github_open_pr", { title: "Fix", head: "fairlx/x" }))).toBe(true);
    expect(isWriteToolCall(call("github_read_file", { path: "a.ts" }))).toBe(false);
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

  it("summarizes add and remove for Accept/Deny", () => {
    expect(confirmationSummary(call("fairlx_workspace_member_add", { name: "Ada" }))).toBe(
      "Add Ada to the workspace?",
    );
    expect(
      confirmationSummary(call("fairlx_workspace_member_add", { name: "Ada", role: "MEMBER" })),
    ).toBe("Add Ada as MEMBER?");
    expect(confirmationSummary(call("fairlx_workspace_member_remove", { name: "Ada" }))).toBe(
      "Remove Ada from the workspace?",
    );
    expect(
      confirmationSummary(
        call("fairlx_project_team_member_add", { name: "Surendra", teamName: "Developers" }),
      ),
    ).toBe("Add Surendra to Developers?");
    expect(confirmationSummary(call("fairlx_project_team_create", { name: "Developers" }))).toBe(
      'Create team "Developers"?',
    );
    expect(confirmationSummary(call("mail_send", { to: "ada@x.com", subject: "Issue" }))).toBe("Send mail to ada@x.com?");
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

describe("parseWorkItemCall", () => {
  it("extracts structured work item parameters", () => {
    const parsed = parseWorkItemCall(
      call("fairlx_work_item_create", {
        projectId: "p1",
        title: "Setup auth",
        type: "STORY",
        priority: "HIGH",
        description: "Configure OAuth and RBAC",
        labels: ["backend", "security"],
      })
    );
    expect(parsed).toEqual({
      id: "c1",
      toolName: "fairlx_work_item_create",
      projectId: "p1",
      title: "Setup auth",
      type: "STORY",
      priority: "HIGH",
      description: "Configure OAuth and RBAC",
      labels: ["backend", "security"],
      sprintId: undefined,
    });
  });

  it("returns null for non-work-item-create calls", () => {
    expect(parseWorkItemCall(call("fairlx_workspace_member_add", { name: "Ada" }))).toBeNull();
  });
});

describe("parseConfirmationCall", () => {
  it("parses work item calls with workItem details", () => {
    const confirmation = parseConfirmationCall(
      call("fairlx_work_item_create", {
        title: "Fix crash",
        type: "BUG",
        priority: "URGENT",
      })
    );
    expect(confirmation.workItem).toBeDefined();
    expect(confirmation.workItem?.type).toBe("BUG");
    expect(confirmation.workItem?.priority).toBe("URGENT");
    expect(confirmation.summary).toContain("Fix crash");
  });
});
