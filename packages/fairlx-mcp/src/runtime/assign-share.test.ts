import { describe, expect, it } from "vitest";
import { assignmentSummary, parseAssignPercent, pickAssignShareKeys } from "./assign-share";

function item(key: string, name?: string) {
  return name
    ? { key, unassigned: false, assignees: [{ name }] }
    : { key, unassigned: true, assignees: [] };
}

describe("pickAssignShareKeys", () => {
  it("assigns 60% of an unassigned backlog from the lowest keys", () => {
    const items = Array.from({ length: 22 }, (_, i) => item(`SCHO-${i + 1}`));
    const plan = pickAssignShareKeys(items, "fogef", 60);
    expect(plan).toMatchObject({ total: 22, target: 13, already: [] });
    expect(plan.pick).toEqual(Array.from({ length: 13 }, (_, i) => `SCHO-${i + 1}`));
  });

  it("only fills the gap when the person already has some board assignees", () => {
    const items = [
      item("SCHO-1", "fogef"),
      item("SCHO-2", "fogef"),
      item("SCHO-3", "fogef"),
      ...Array.from({ length: 19 }, (_, i) => item(`SCHO-${i + 4}`)),
    ];
    const plan = pickAssignShareKeys(items, "fogef", 60);
    expect(plan.target).toBe(13);
    expect(plan.already).toEqual(["SCHO-1", "SCHO-2", "SCHO-3"]);
    expect(plan.pick).toEqual(Array.from({ length: 10 }, (_, i) => `SCHO-${i + 4}`));
  });

  it("does not treat unassigned keys as already owned", () => {
    const items = Array.from({ length: 22 }, (_, i) => item(`SCHO-${i + 1}`));
    const plan = pickAssignShareKeys(items, "fogef", 60);
    expect(plan.already).toEqual([]);
    expect(plan.pick).toHaveLength(13);
    expect(plan.pick).not.toContain("SCHO-14");
  });
});

describe("assignmentSummary", () => {
  it("groups board assignees by name and lists unassigned keys", () => {
    const summary = assignmentSummary([
      item("SCHO-1", "fogef"),
      item("SCHO-2"),
      item("SCHO-3"),
    ]);
    expect(summary).toEqual({
      total: 3,
      unassignedCount: 2,
      unassignedKeys: ["SCHO-2", "SCHO-3"],
      byAssignee: { fogef: ["SCHO-1"] },
    });
  });
});

describe("parseAssignPercent", () => {
  it("accepts numbers and percent strings", () => {
    expect(parseAssignPercent(60)).toBe(60);
    expect(parseAssignPercent("60%")).toBe(60);
    expect(parseAssignPercent("half")).toBeUndefined();
  });
});
