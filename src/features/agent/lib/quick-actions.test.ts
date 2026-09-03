import { describe, expect, it } from "vitest";
import { FolderPlus, Lightbulb } from "lucide-react";
import {
  countWorkspaceProjects,
  getQuickActions,
  CREATE_PROJECT_ACTION,
  PLAN_FEATURE_ACTION,
} from "./quick-actions";

describe("countWorkspaceProjects", () => {
  it("returns 0 when projects array is undefined or empty", () => {
    expect(countWorkspaceProjects(undefined, "ws-1")).toBe(0);
    expect(countWorkspaceProjects(null, "ws-1")).toBe(0);
    expect(countWorkspaceProjects([], "ws-1")).toBe(0);
  });

  it("filters projects matching the specified workspaceId", () => {
    const projects = [
      { workspaceId: "ws-1" },
      { workspaceId: "ws-1" },
      { workspaceId: "ws-2" },
    ];
    expect(countWorkspaceProjects(projects, "ws-1")).toBe(2);
    expect(countWorkspaceProjects(projects, "ws-2")).toBe(1);
    expect(countWorkspaceProjects(projects, "ws-3")).toBe(0);
  });

  it("returns total projects count when workspaceId is not specified", () => {
    const projects = [{ workspaceId: "ws-1" }, { workspaceId: "ws-2" }];
    expect(countWorkspaceProjects(projects, undefined)).toBe(2);
    expect(countWorkspaceProjects(projects, "")).toBe(2);
  });
});

describe("getQuickActions", () => {
  it("returns 'Create project' as the first label when hasProjects is false", () => {
    const actions = getQuickActions(false);
    expect(actions).toHaveLength(5);
    expect(actions[0].label).toBe("Create project");
    expect(actions[0].icon).toBe(FolderPlus);
    expect(actions[0].prompt).toBe(CREATE_PROJECT_ACTION.prompt);

    expect(actions[1].label).toBe("Fix a bug");
    expect(actions[2].label).toBe("Refactor code");
    expect(actions[3].label).toBe("Write tests");
    expect(actions[4].label).toBe("Add docs");
  });

  it("returns 'Plan new feature' as the first label when hasProjects is true", () => {
    const actions = getQuickActions(true);
    expect(actions).toHaveLength(5);
    expect(actions[0].label).toBe("Plan new feature");
    expect(actions[0].icon).toBe(Lightbulb);
    expect(actions[0].prompt).toBe(PLAN_FEATURE_ACTION.prompt);

    expect(actions[1].label).toBe("Fix a bug");
    expect(actions[2].label).toBe("Refactor code");
    expect(actions[3].label).toBe("Write tests");
    expect(actions[4].label).toBe("Add docs");
  });
});
