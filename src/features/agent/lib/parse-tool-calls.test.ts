import { describe, expect, it } from "vitest";

import { extractToolCallsFromText, resolveToolName, stripToolCallMarkup } from "./parse-tool-calls";

const MCP = [
  "fairlx_work_item_list",
  "fairlx_workspace_members_list",
  "fairlx_project_list",
  "fairlx_workspace_list",
];

describe("resolveToolName", () => {
  it("maps screenshot-style Fairlx XML names onto real tools", () => {
    expect(resolveToolName("fairlx:listWorkItems", MCP)).toBe("fairlx_work_item_list");
    expect(resolveToolName("listWorkspaceMembers", MCP)).toBe("fairlx_workspace_members_list");
    expect(resolveToolName("updateWorkspaceMember", ["fairlx_workspace_member_update"])).toBe(
      "fairlx_workspace_member_update",
    );
    expect(resolveToolName("mcp_list", MCP)).toBe("mcp_list");
  });
});

describe("extractToolCallsFromText", () => {
  it("parses leaked Grok XML tool calls from the chat transcript", () => {
    const content = [
      "Let me check your assigned tasks properly.",
      'fairlx:listWorkItems { "workspaceId": "69d2d1720023d3c1f3e9" } </fairlx:listWorkItems>',
    ].join("\n");
    const calls = extractToolCallsFromText(content, MCP);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe("fairlx_work_item_list");
    expect(JSON.parse(calls[0]?.arguments ?? "{}")).toEqual({ workspaceId: "69d2d1720023d3c1f3e9" });
  });

  it("maps workspace member lookups onto the Fairlx MCP tool", () => {
    const content =
      'fairlx:listWorkspaceMembers { "workspaceId": "69d2d1720023d3c1f3e9" } </fairlx:listWorkspaceMembers>';
    const calls = extractToolCallsFromText(content, MCP);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe("fairlx_workspace_members_list");
    expect(JSON.parse(calls[0]?.arguments ?? "{}")).toEqual({ workspaceId: "69d2d1720023d3c1f3e9" });
  });

  it("strips tool markup so users never see XML", () => {
    const stripped = stripToolCallMarkup(
      'Let me check.\nfairlx:mcp_list {} </fairlx:mcp_list>\n',
    );
    expect(stripped).not.toMatch(/mcp_list/);
    expect(stripped).not.toMatch(/<\/fairlx/);
    expect(stripped).toContain("Let me check.");
  });
});
