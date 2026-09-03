import { describe, expect, it } from "vitest";

import {
  mergeWorkItem,
  normalizePriority,
  normalizeStatus,
  splitMarkdownWorkItemTable,
} from "./work-item-table";

describe("splitMarkdownWorkItemTable", () => {
  it("parses kanban-style markdown tables and normalizes tags", () => {
    const parsed = splitMarkdownWorkItemTable(`
Here are the items:

| Key | Title | Status | Priority | Assignee |
| --- | --- | --- | --- | --- |
| PROJ-43 | Export timeline | Done | Medium | Surendra Mattaparthi |
| PROJ-12 | Missing owner | TODO | HIGH | Unassigned |
`);
    expect(parsed?.before).toContain("Here are the items");
    expect(parsed?.rows).toEqual([
      {
        key: "PROJ-43",
        title: "Export timeline",
        status: "DONE",
        type: "",
        priority: "MEDIUM",
        unassigned: false,
        assignees: [{ name: "Surendra Mattaparthi" }],
      },
      {
        key: "PROJ-12",
        title: "Missing owner",
        status: "TODO",
        type: "",
        priority: "HIGH",
        unassigned: true,
        assignees: [],
      },
    ]);
  });

  it("parses numbered tables with Type, Priority, and Description (proposals)", () => {
    const parsed = splitMarkdownWorkItemTable(`
Initial proposed items:

| # | Title | Type | Priority | Description | Labels |
|---|---|---|---|---|---|
| 1 | Set up project tech stack | Task | High | Configure Next.js and Tailwind | frontend, infra |
| 2 | Design database schema | Story | Urgent | Set up Appwrite collections | backend |
`);
    expect(parsed?.rows).toEqual([
      {
        key: "#1",
        title: "Set up project tech stack",
        status: "TODO",
        type: "TASK",
        priority: "HIGH",
        unassigned: true,
        assignees: [],
        labels: ["frontend", "infra"],
        description: "Configure Next.js and Tailwind",
      },
      {
        key: "#2",
        title: "Design database schema",
        status: "TODO",
        type: "STORY",
        priority: "URGENT",
        unassigned: true,
        assignees: [],
        labels: ["backend"],
        description: "Set up Appwrite collections",
      },
    ]);
  });
});

describe("mergeWorkItem", () => {
  it("fills type and assignee photos from the list payload", () => {
    const merged = mergeWorkItem(
      {
        key: "PROJ-43",
        title: "Export timeline",
        status: "Done",
        priority: "Medium",
        assignees: [{ name: "Surendra Mattaparthi" }],
      },
      {
        key: "PROJ-43",
        type: "BUG",
        status: "DONE",
        priority: "MEDIUM",
        assignees: [{ name: "Surendra Mattaparthi", imageUrl: "https://cdn.example/s.png" }],
      },
    );
    expect(merged).toMatchObject({
      type: "BUG",
      status: "DONE",
      priority: "MEDIUM",
      assignees: [{ name: "Surendra Mattaparthi", imageUrl: "https://cdn.example/s.png" }],
    });
  });
});

describe("normalize tags", () => {
  it("maps human labels to board enums", () => {
    expect(normalizeStatus("In Progress")).toBe("IN_PROGRESS");
    expect(normalizePriority("urgent")).toBe("URGENT");
    expect(normalizePriority("— 🔴 high")).toBe("HIGH");
    expect(normalizePriority("🔴 high")).toBe("HIGH");
    expect(normalizePriority("— 🟡 medium")).toBe("MEDIUM");
    expect(normalizePriority("🟡 medium")).toBe("MEDIUM");
    expect(normalizePriority("🟢 low")).toBe("LOW");
    expect(normalizePriority("🔥 urgent")).toBe("URGENT");
    expect(normalizeStatus("🟡 In Progress")).toBe("IN_PROGRESS");
    expect(normalizeStatus("✅ Done")).toBe("DONE");
  });
});
