import { describe, expect, it } from "vitest";

import { indexAssigneesByStoredId, pickAssignees } from "./work-item-assignees";

describe("work item assignee lookup", () => {
  const members = [
    { $id: "mem_fogef", userId: "user_fogef", name: "fogef" },
    { $id: "mem_ada", userId: "user_ada", name: "Ada" },
  ];

  it("indexes both membership ids and user ids", () => {
    const index = indexAssigneesByStoredId(members);
    expect(index.get("mem_fogef")?.name).toBe("fogef");
    expect(index.get("user_fogef")?.name).toBe("fogef");
  });

  it("resolves board membership ids and agent user ids", () => {
    expect(pickAssignees(["mem_fogef"], members).map((member) => member.name)).toEqual(["fogef"]);
    expect(pickAssignees(["user_fogef"], members).map((member) => member.name)).toEqual(["fogef"]);
    expect(pickAssignees(["missing"], members)).toEqual([]);
  });
});
