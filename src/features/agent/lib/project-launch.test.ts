import { describe, expect, it } from "vitest";

import type { AgentChatMessage } from "../types";
import {
  extractBoardProject,
  extractBoardProjectFromTool,
  extractCreatedProject,
  isBoardMutationTool,
  kanbanCtasForBlocks,
  projectKanbanHref,
  userAskedToViewBoard,
  withWorkspaceFallback,
} from "./project-launch";
import { groupTranscript } from "./transcript";

const now = "2026-09-03T00:00:00.000Z";

function tool(name: string, content: unknown, toolCallId?: string): AgentChatMessage {
  return {
    id: name + (toolCallId ?? ""),
    role: "tool",
    toolName: name,
    toolCallId,
    content: JSON.stringify(content),
    createdAt: now,
  };
}

describe("isBoardMutationTool", () => {
  it("matches kanban writes and ignores list tools", () => {
    expect(isBoardMutationTool("create_project")).toBe(true);
    expect(isBoardMutationTool("fairlx_work_item_update")).toBe(true);
    expect(isBoardMutationTool("fairlx_sprint_start")).toBe(true);
    expect(isBoardMutationTool("fairlx_work_item_list")).toBe(false);
    expect(isBoardMutationTool("fairlx_work_item_delete")).toBe(true);
    expect(isBoardMutationTool("fairlx_sprint_list")).toBe(false);
    expect(isBoardMutationTool("fairlx_space_list")).toBe(false);
  });
});

describe("extractBoardProjectFromTool", () => {
  it("reads create_project results", () => {
    expect(
      extractBoardProjectFromTool(
        "create_project",
        JSON.stringify({ id: "proj_1", name: "School Stacker", workspaceId: "ws_1" }),
      ),
    ).toEqual({ workspaceId: "ws_1", projectId: "proj_1", name: "School Stacker" });
  });

  it("reads a work item update without treating the item id as the project", () => {
    expect(
      extractBoardProjectFromTool(
        "fairlx_work_item_update",
        JSON.stringify({
          workItem: {
            id: "wi_9",
            title: "Set up auth",
            projectId: "proj_1",
            workspaceId: "ws_1",
          },
        }),
      ),
    ).toEqual({ workspaceId: "ws_1", projectId: "proj_1" });
  });

  it("reads projectId from tool arguments when the result omits it", () => {
    expect(
      extractBoardProjectFromTool("fairlx_sprint_start", JSON.stringify({ sprint: { $id: "sp_1", status: "ACTIVE" } }), JSON.stringify({ sprintId: "sp_1", projectId: "proj_4" })),
    ).toEqual({ projectId: "proj_4", workspaceId: "" });
  });
});

describe("extractBoardProject", () => {
  it("prefers the latest board mutation", () => {
    expect(
      extractCreatedProject([
        tool("fairlx_project_create", {
          project: { $id: "old", name: "Old", workspaceId: "ws_1" },
        }),
        tool("fairlx_work_item_create", {
          workItem: { id: "wi_1", title: "Task", projectId: "proj_2", workspaceId: "ws_1" },
        }),
      ]),
    ).toEqual({ workspaceId: "ws_1", projectId: "proj_2" });
  });

  it("fills workspace from an earlier project create", () => {
    expect(
      extractBoardProject([
        tool("create_project", { id: "proj_3", name: "School Stacker", workspaceId: "ws_9" }),
        tool("fairlx_sprint_start", { sprint: { $id: "sp_1", projectId: "proj_3", status: "ACTIVE" } }),
      ]),
    ).toEqual({ workspaceId: "ws_9", projectId: "proj_3", name: "School Stacker" });
  });

  it("returns null for list-only transcripts", () => {
    expect(extractBoardProject([tool("fairlx_work_item_list", { workItems: [] })])).toBeNull();
  });
});

describe("withWorkspaceFallback", () => {
  it("uses the run workspace when the tool result omitted it", () => {
    expect(
      withWorkspaceFallback({ projectId: "proj_1", workspaceId: "" }, "ws_1"),
    ).toEqual({ projectId: "proj_1", workspaceId: "ws_1" });
    expect(withWorkspaceFallback({ projectId: "proj_1", workspaceId: "" }, "")).toBeNull();
  });
});

describe("projectKanbanHref", () => {
  it("builds the project kanban query URL", () => {
    expect(projectKanbanHref({ workspaceId: "ws_1", projectId: "proj_1" })).toBe(
      "/workspaces/ws_1/projects/proj_1?task-view=kanban",
    );
  });
});

describe("userAskedToViewBoard", () => {
  it("detects explicit view requests and ignores unrelated questions", () => {
    expect(userAskedToViewBoard("open the kanban board")).toBe(true);
    expect(userAskedToViewBoard("what is spaces ?")).toBe(false);
    expect(userAskedToViewBoard("tell me about the project")).toBe(false);
  });
});

describe("kanbanCtasForBlocks", () => {
  it("pins the kanban button to the mutation turn, not a later question", () => {
    const messages: AgentChatMessage[] = [
      { id: "u1", role: "user", content: "create the project", createdAt: now },
      {
        id: "a1",
        role: "assistant",
        content: "Creating sprint",
        createdAt: now,
        toolCalls: [{ id: "c1", name: "fairlx_sprint_create", arguments: "{}" }],
      },
      tool("fairlx_sprint_create", {
        sprint: { $id: "sp_1", projectId: "proj_1", workspaceId: "ws_1", name: "Sprint 1" },
        started: true,
      }, "c1"),
      { id: "a2", role: "assistant", content: "Sprint 1 is active.", createdAt: now },
      { id: "u2", role: "user", content: "what is spaces ?", createdAt: now },
      {
        id: "a3",
        role: "assistant",
        content: "Looking up spaces",
        createdAt: now,
        toolCalls: [{ id: "c2", name: "fairlx_space_list", arguments: "{}" }],
      },
      tool("fairlx_space_list", { spaces: [] }, "c2"),
      { id: "a4", role: "assistant", content: "Spaces are folders.", createdAt: now },
    ];
    const blocks = groupTranscript(messages);
    const ctas = kanbanCtasForBlocks(blocks, "ws_1");
    const assistantIndexes = blocks
      .map((block, index) => (block.kind === "assistant" ? index : -1))
      .filter((index) => index >= 0);
    const lastAssistant = assistantIndexes[assistantIndexes.length - 1];
    const mutationAssistant = assistantIndexes[0];
    expect(ctas.size).toBe(1);
    expect(ctas.has(mutationAssistant!)).toBe(true);
    expect(ctas.has(lastAssistant!)).toBe(false);
    expect(ctas.get(mutationAssistant!)?.projectId).toBe("proj_1");
  });
});
