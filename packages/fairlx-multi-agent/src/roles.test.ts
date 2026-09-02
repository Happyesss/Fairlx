import { describe, expect, it } from "vitest";

import { isDeleteTool, isHighRiskTool, isToolAllowed, toolsForRole } from "./roles";

describe("least-privilege tool scoping", () => {
  it("gives planner docs and items but not git writes or browser tools", () => {
    const tools = toolsForRole("planner");
    expect(tools.some((tool) => tool.startsWith("fairlx_doc_"))).toBe(true);
    expect(tools).toContain("search_harness");
    expect(tools).not.toContain("git_stage");
    expect(tools).not.toContain("testmu_run_test");
    expect(isToolAllowed("planner", "fairlx_work_item_delete")).toBe(false);
  });

  it("forbids builder deletes while allowing stage and item updates", () => {
    expect(isToolAllowed("builder", "git_stage")).toBe(true);
    expect(isToolAllowed("builder", "code_inspect")).toBe(true);
    expect(isToolAllowed("builder", "fairlx_work_item_update")).toBe(true);
    expect(isToolAllowed("builder", "fairlx_work_item_delete")).toBe(false);
    expect(isDeleteTool("fairlx_project_delete")).toBe(true);
  });

  it("gives QA browser tools and no code writes", () => {
    const tools = toolsForRole("qa");
    expect(tools).toEqual(expect.arrayContaining(["testmu_run_test", "browser_click", "browser_shot"]));
    expect(isToolAllowed("qa", "git_stage")).toBe(false);
    expect(isToolAllowed("qa", "fairlx_work_item_update")).toBe(false);
  });

  it("gives reviewer git status, items, and write_guard", () => {
    const tools = toolsForRole("reviewer");
    expect(tools).toContain("git_status");
    expect(tools).toContain("write_guard");
    expect(isToolAllowed("reviewer", "git_stage")).toBe(false);
  });

  it("treats production merge as high risk", () => {
    expect(isHighRiskTool("git_merge", { branch: "main" })).toBe(true);
    expect(isHighRiskTool("fairlx_work_item_update", { title: "Done" })).toBe(false);
  });
});
