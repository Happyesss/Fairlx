import { describe, expect, it } from "vitest";

import { activeSubagents, editedFilePaths, estimateTokensFromText } from "./context-meter";
import type { AgentToolEvent } from "../types";

function event(type: AgentToolEvent["type"], payload?: unknown): AgentToolEvent {
  return {
    id: crypto.randomUUID(),
    type,
    title: type,
    payload,
    createdAt: new Date().toISOString(),
    runId: "r1",
  };
}

describe("context meter helpers", () => {
  it("counts active subagents until done", () => {
    const events = [
      event("subagent_started", { id: "s1", specialist: "planner", parent: "orchestrator", task: "Plan" }),
      event("subagent_started", { id: "s2", specialist: "builder", parent: "orchestrator", task: "Build" }),
      event("subagent_done", { id: "s1" }),
    ];
    const live = activeSubagents(events);
    expect(live).toHaveLength(1);
    expect(live[0]?.specialist).toBe("builder");
  });

  it("collects edited file paths", () => {
    expect(
      editedFilePaths([
        event("github_write_file", { path: "src/a.ts" }),
        event("git_stage", { path: "src/b.ts" }),
        event("github_write_file", { path: "src/a.ts" }),
      ]),
    ).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("estimates tokens from text length", () => {
    expect(estimateTokensFromText("abcd")).toBe(1);
    expect(estimateTokensFromText("abcdefgh")).toBe(2);
  });
});
