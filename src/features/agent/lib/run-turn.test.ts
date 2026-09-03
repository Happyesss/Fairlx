import { describe, expect, it } from "vitest";

import { runNeedsAgentTurn } from "./run-turn";
import type { AgentChatMessage, AgentRun } from "../types";

function run(messages: AgentChatMessage[], status: AgentRun["status"] = "running"): Pick<AgentRun, "status" | "messages"> {
  return { status, messages };
}

const now = "2026-09-03T00:00:00.000Z";

describe("runNeedsAgentTurn", () => {
  it("starts a turn for an empty training chat", () => {
    expect(runNeedsAgentTurn(run([]))).toBe(true);
  });

  it("starts a turn after a user reply", () => {
    expect(
      runNeedsAgentTurn(
        run([{ id: "u1", role: "user", content: "I'm a frontend engineer", createdAt: now }]),
      ),
    ).toBe(true);
  });

  it("does not start a turn while waiting for the user after an assistant question", () => {
    expect(
      runNeedsAgentTurn(
        run([
          { id: "a1", role: "assistant", content: "Does Tech Lead sound right?", createdAt: now },
        ]),
      ),
    ).toBe(false);
  });

  it("does not continue completed chats", () => {
    expect(
      runNeedsAgentTurn(
        run([{ id: "a1", role: "assistant", content: "Question 1?", createdAt: now }], "completed"),
      ),
    ).toBe(false);
  });
});
