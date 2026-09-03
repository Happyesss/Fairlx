import { describe, expect, it } from "vitest";

import { assembleContextPayload, generateDailyBriefing } from "./context";
import type { InjectedContext } from "./types";

describe("daily briefing", () => {
  it("renders role-aware priorities in well under 800ms", () => {
    const lead = generateDailyBriefing({
      userName: "Ada Lovelace",
      personaRole: "tech_lead",
      workItems: [
        { id: "1", key: "WEB-1", title: "Overflow", status: "IN_PROGRESS", priority: "HIGH", dueAt: new Date(Date.now() + 3600_000).toISOString() },
      ],
      blockers: [{ id: "2", key: "WEB-2", title: "API down", status: "BLOCKED", blockedBy: ["x"] }],
      unassigned: [{ id: "3", key: "WEB-3", title: "Orphan bug", status: "OPEN" }],
      sprints: [{ id: "s", name: "Sprint 24", status: "active", committedPoints: 38, totalPoints: 42 }],
    });
    expect(lead.generatedInMs).toBeLessThan(800);
    expect(lead.personaRole).toBe("tech_lead");
    expect(lead.greeting).toMatch(/Ada/);
    expect(lead.priorities.some((line) => /unassigned|Unblock|Sprint 24/i.test(line))).toBe(true);
    expect(lead.topTasks[0]?.key).toBe("WEB-1");

    const ranked = generateDailyBriefing({
      userName: "Ada",
      personaRole: "frontend",
      assignedWork: [
        { id: "low", title: "Polish", status: "TODO", priority: "LOW" },
        { id: "done", title: "Shipped", status: "DONE", priority: "URGENT" },
        { id: "flag", title: "Flagged medium", status: "TODO", priority: "MEDIUM", flagged: true },
        { id: "urg", key: "WEB-9", title: "Prod down", status: "IN_PROGRESS", priority: "URGENT" },
      ],
    });
    expect(ranked.topTasks.map((item) => item.id)).toEqual(["urg", "flag", "low"]);

    const qa = generateDailyBriefing({
      userName: "Sam",
      personaRole: "qa",
      workItems: [{ id: "1", title: "Ready card", status: "IN_REVIEW" }],
    });
    expect(qa.priorities.join(" ")).toMatch(/QA|review/i);
  });
});

describe("bounded context injection", () => {
  it("omits overflow entities instead of blowing the token budget", () => {
    const context: InjectedContext = {
      user: { id: "u", name: "Ada", email: "a@x" },
      entities: Array.from({ length: 40 }, (_, index) => ({
        entityType: "WORK_ITEM",
        referenceKey: `TASK-${index}`,
        id: `id-${index}`,
        data: {
          id: `id-${index}`,
          key: `TASK-${index}`,
          title: "Item",
          status: "OPEN",
          description: "x".repeat(2000),
        },
      })),
      workItems: [],
      sprints: [],
      blockers: [],
      unassigned: [],
      repos: [],
    };
    const packed = assembleContextPayload(context, 800);
    expect(packed.tokens).toBeLessThanOrEqual(800);
    expect(packed.omitted).toBeGreaterThan(0);
    expect(packed.included).toBeGreaterThan(0);
    expect(packed.text.includes("x".repeat(2000))).toBe(false);
  });
});
