import { describe, expect, it } from "vitest";

import { createMultiAgentEngine } from "./engine";
import { createManualScheduler, WorkerPool } from "./runtime";
import { MemoryGitHub } from "./connectors";

describe("sleep and wake lifecycle", () => {
  it("spawns a child, sleeps the parent, then wakes on the inbox report", async () => {
    const scheduler = createManualScheduler();
    const github = new MemoryGitHub();
    const engine = createMultiAgentEngine({ scheduler, github });
    const types: string[] = [];
    engine.subscribe((event) => types.push(event.type));

    const parentId = await engine.startGoal({
      userId: "u1",
      prompt: "Fix mobile sidebar overflow and test it.",
      personaRole: "frontend",
      workspaceRole: "ADMIN",
      context: {
        user: { id: "u1", name: "Ada", email: "ada@fairlx.dev" },
        workspaceId: "w1",
        projectId: "p1",
        entities: [],
        workItems: [{ id: "i1", key: "WEB-102", title: "Sidebar overflow" }],
        sprints: [],
        blockers: [],
        unassigned: [],
        repos: [{ id: "r1", owner: "acme", name: "web" }],
      },
    });

    expect(scheduler.pending).toBe(1);
    await scheduler.flushOne();

    const sleeping = await engine.getRun(parentId);
    expect(sleeping?.status).toBe("waiting_for_subagent");
    expect(sleeping?.waitingForRunIds.length).toBeGreaterThan(0);
    expect(engine.isTurnInFlight(parentId)).toBe(false);
    expect(types).toContain("orchestrator.sleep");
    expect(types).toContain("subagent.spawned");
    expect(types).not.toContain("orchestrator.wake");

    let guard = 0;
    while ((await engine.getRun(parentId))?.status === "waiting_for_subagent" && guard < 20) {
      guard += 1;
      await scheduler.flush();
    }

    const done = await engine.getRun(parentId);
    expect(done?.status === "completed" || done?.status === "awaiting_confirmation").toBe(true);
    expect(done?.inbox.length).toBeGreaterThan(0);
    expect(types).toContain("orchestrator.wake");
    expect(types).toContain("subagent.completed");
    expect(github.pullRequests.length).toBe(1);

    const children = await engine.store.listByParent(parentId);
    expect(children.map((child) => child.subAgentType).sort()).toEqual(["builder", "planner", "qa", "reviewer"]);
    for (const child of children) {
      expect(child.parentRunId).toBe(parentId);
      expect(child.allowedTools.length).toBeGreaterThan(0);
    }
  });
});

describe("end-to-end autonomous cycle", () => {
  it("runs planner → builder → qa → reviewer and meters tokens", async () => {
    const result = await createMultiAgentEngine().runGoal({
      userId: "u1",
      prompt: "Fix mobile sidebar overflow and test it.",
      personaRole: "tech_lead",
      workspaceRole: "ADMIN",
    });
    expect(result.parent.status).toBe("completed");
    expect(result.decision?.verdict).toBe("auto_apply");
    expect(result.children).toHaveLength(4);
    expect(result.parent.usage.inputTokens).toBeGreaterThan(0);
    expect(result.parent.qaReport?.passed).toBe(true);
    const builder = result.children.find((child) => child.subAgentType === "builder");
    expect(builder?.status).toBe("completed");
  });

  it("is idempotent when spawning the same graph node twice", async () => {
    const engine = createMultiAgentEngine();
    const first = await engine.runGoal({ userId: "u1", prompt: "Ship the fix." });
    const node = first.parent.graph?.nodes[0];
    expect(node?.idempotencyKey).toBeTruthy();
    const remembered = await engine.store.getByIdempotency(node!.idempotencyKey);
    expect(remembered?.id).toBe(node?.runId);
  });
});

describe("worker pool backpressure", () => {
  it("never runs more than max concurrent workers", async () => {
    const pool = new WorkerPool(2);
    let current = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 8 }, () =>
        pool.run(async () => {
          current += 1;
          peak = Math.max(peak, current);
          await new Promise((resolve) => setTimeout(resolve, 5));
          current -= 1;
        }),
      ),
    );
    expect(peak).toBeLessThanOrEqual(2);
  });
});
