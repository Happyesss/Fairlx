import { describe, expect, it } from "vitest";
import { groupItemsBySprintAndEpic, flattenTimelineItems } from "./utils";
import {
  WorkItemType,
  WorkItemStatus,
  WorkItemPriority,
  PopulatedWorkItem,
  PopulatedSprint,
} from "../sprints/types";

function makeEpic(overrides: Partial<PopulatedWorkItem> & { $id: string }): PopulatedWorkItem {
  return {
    $createdAt: "",
    $updatedAt: "",
    workspaceId: "ws1",
    projectId: "p1",
    key: overrides.key || "EPIC-1",
    title: overrides.title || "Parent Epic",
    type: WorkItemType.EPIC,
    status: WorkItemStatus.TODO,
    priority: WorkItemPriority.MEDIUM,
    assigneeIds: [],
    ...overrides,
  } as PopulatedWorkItem;
}

function makeTask(overrides: Partial<PopulatedWorkItem> & { $id: string }): PopulatedWorkItem {
  return {
    $createdAt: "",
    $updatedAt: "",
    workspaceId: "ws1",
    projectId: "p1",
    key: overrides.key || "TASK-1",
    title: overrides.title || "Sprint Task",
    type: WorkItemType.TASK,
    status: WorkItemStatus.TODO,
    priority: WorkItemPriority.MEDIUM,
    assigneeIds: [],
    ...overrides,
  } as PopulatedWorkItem;
}

describe("groupItemsBySprintAndEpic", () => {
  it("does not duplicate an unscheduled epic as a full bar inside a sprint", () => {
    const sprint = {
      $id: "sprint-1",
      name: "Sprint 1",
      status: "ACTIVE",
      workspaceId: "ws1",
      projectId: "p1",
      startDate: "2026-01-01",
      endDate: "2026-01-14",
      $createdAt: "",
      $updatedAt: "",
    } as PopulatedSprint;

    const epic = makeEpic({ $id: "epic-1", sprintId: null, key: "EPIC-1", title: "Platform" });
    const task = makeTask({
      $id: "task-1",
      sprintId: "sprint-1",
      epicId: "epic-1",
      key: "TASK-1",
    });

    const expanded = new Set(["unscheduled", "sprint-1", "epic-1", "epic-label-epic-1-sprint-1"]);
    const groups = groupItemsBySprintAndEpic([sprint], [epic, task], expanded);

    const unscheduled = groups.find((g) => g.sprint.$id === "unscheduled");
    expect(unscheduled?.epics.some((e) => e.epic.id === "epic-1")).toBe(true);

    const sprintGroup = groups.find((g) => g.sprint.$id === "sprint-1");
    expect(sprintGroup).toBeTruthy();

    const sprintEpicRows = sprintGroup!.epics.filter((e) => e.epic.type === WorkItemType.EPIC);
    expect(sprintEpicRows).toHaveLength(1);
    expect(sprintEpicRows[0].epic.isLabelOnly).toBe(true);
    expect(sprintEpicRows[0].epic.id).toBe("epic-label-epic-1-sprint-1");
    expect(sprintEpicRows[0].tasks.map((t) => t.id)).toEqual(["task-1"]);

    // Flat grid must not include the real epic id twice / under the sprint
    const flat = flattenTimelineItems(
      groups.map((g) => ({ ...g, isExpanded: true, epics: g.epics.map((e) => ({ ...e, isExpanded: true })) }))
    );
    const epicBars = flat.filter((i) => i.id === "epic-1");
    expect(epicBars).toHaveLength(1);
    expect(flat.some((i) => i.id === "epic-label-epic-1-sprint-1")).toBe(false);
  });

  it("keeps a full epic row when the epic itself is in the sprint", () => {
    const sprint = {
      $id: "sprint-1",
      name: "Sprint 1",
      status: "ACTIVE",
      workspaceId: "ws1",
      projectId: "p1",
      startDate: "2026-01-01",
      endDate: "2026-01-14",
      $createdAt: "",
      $updatedAt: "",
    } as PopulatedSprint;

    const epic = makeEpic({ $id: "epic-1", sprintId: "sprint-1" });
    const task = makeTask({ $id: "task-1", sprintId: "sprint-1", epicId: "epic-1" });

    const groups = groupItemsBySprintAndEpic(
      [sprint],
      [epic, task],
      new Set(["sprint-1", "epic-1"])
    );
    const sprintGroup = groups.find((g) => g.sprint.$id === "sprint-1");
    const epicRow = sprintGroup!.epics.find((e) => e.epic.id === "epic-1");
    expect(epicRow).toBeTruthy();
    expect(epicRow!.epic.isLabelOnly).toBeFalsy();
  });
});
