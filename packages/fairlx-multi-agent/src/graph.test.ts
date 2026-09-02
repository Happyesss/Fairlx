import { describe, expect, it } from "vitest";

import { TaskGraph, createNode, decomposeGoal } from "./graph";

describe("TaskGraph", () => {
  it("returns nodes whose dependencies are complete", () => {
    const graph = decomposeGoal("Fix overflow", "parent-1");
    expect(graph.ready().map((node) => node.kind)).toEqual(["planner"]);
    const planner = graph.ready()[0]!;
    graph.markRunning(planner.id, "run-planner");
    graph.markCompleted(planner.id, {
      runId: "run-planner",
      subAgentType: "planner",
      status: "completed",
      summary: "planned",
      artifacts: [],
      usage: { inputTokens: 0, outputTokens: 0, modelId: "x", costUsd: 0 },
    });
    expect(graph.ready().map((node) => node.kind)).toEqual(["builder"]);
  });

  it("allows independent nodes to be ready together", () => {
    const a = createNode({ kind: "planner", title: "A", prompt: "a", parentRunId: "p" });
    const b = createNode({ kind: "planner", title: "B", prompt: "b", parentRunId: "p" });
    const c = createNode({ kind: "reviewer", title: "C", prompt: "c", dependsOn: [a.id, b.id], parentRunId: "p" });
    const graph = new TaskGraph([a, b, c]);
    expect(graph.ready().map((node) => node.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("rejects cycles", () => {
    const a = createNode({ kind: "planner", title: "A", prompt: "a", parentRunId: "p" });
    const b = createNode({ kind: "builder", title: "B", prompt: "b", dependsOn: [a.id], parentRunId: "p" });
    a.dependsOn = [b.id];
    expect(() => new TaskGraph([a, b])).toThrow(/cycle/i);
  });

  it("is complete only after every node finishes", () => {
    const graph = decomposeGoal("x", "p");
    expect(graph.isComplete()).toBe(false);
    for (const node of graph.nodes) {
      graph.markRunning(node.id, `r-${node.id}`);
      graph.markCompleted(node.id, {
        runId: `r-${node.id}`,
        subAgentType: node.kind,
        status: "completed",
        summary: "ok",
        artifacts: [],
        usage: { inputTokens: 1, outputTokens: 1, modelId: "x", costUsd: 0 },
      });
    }
    expect(graph.isComplete()).toBe(true);
    expect(graph.hasFailed()).toBe(false);
  });
});
