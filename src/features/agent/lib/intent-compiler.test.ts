import { describe, expect, it } from "vitest";

import { compileFairlxListIntent } from "./intent-compiler";

describe("compileFairlxListIntent", () => {
  it("maps unassigned questions to one project list with unassigned=true", () => {
    expect(
      compileFairlxListIntent("Tell me all unassigned task", { projectId: "p1" }),
    ).toEqual({
      tool: "fairlx_work_item_list",
      args: { projectId: "p1", unassigned: true },
    });
  });

  it("does not fan out unassigned queries by type=TASK", () => {
    const intent = compileFairlxListIntent("show every unassigned work item", { projectId: "p1" });
    expect(intent?.args.type).toBeUndefined();
    expect(intent?.args.unassigned).toBe(true);
  });

  it("filters bugs only when the user asked for unassigned bugs", () => {
    expect(compileFairlxListIntent("list unassigned bugs", { projectId: "p1" })?.args).toEqual({
      projectId: "p1",
      unassigned: true,
      type: "BUG",
    });
  });

  it("returns null without a project or for writes", () => {
    expect(compileFairlxListIntent("all unassigned tasks", {})).toBeNull();
    expect(compileFairlxListIntent("create a task called login", { projectId: "p1" })).toBeNull();
  });
});
