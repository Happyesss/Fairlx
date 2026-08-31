import { describe, expect, it } from "vitest";

import { isToolNarrationOnly, sanitizeAssistantVisible } from "./visible-content";

describe("sanitizeAssistantVisible", () => {
  it("hides XML tool calls, IDs, and lookup narration", () => {
    const visible = sanitizeAssistantVisible(
      [
        "Let me check your assigned tasks properly.",
        'fairlx:listWorkItems { "workspaceId": "69d2d1720023d3c1f3e9" } </fairlx:listWorkItems>',
      ].join("\n"),
    );
    expect(visible).toBe("");
    expect(isToolNarrationOnly(
      'I\'ll look up the workspace members and their roles.\nfairlx:listWorkspaceMembers { "workspaceId": "69d2d1720023d3c1f3e9" } </fairlx:listWorkspaceMembers>',
    )).toBe(true);
  });

  it("keeps the real answer and strips leftover IDs", () => {
    const visible = sanitizeAssistantVisible(
      "Ada is an Admin and Sam is a Member. Workspace 69d2d1720023d3c1f3e9.",
    );
    expect(visible).toContain("Ada is an Admin");
    expect(visible).not.toMatch(/69d2d1720023d3c1f3e9/);
  });
});
