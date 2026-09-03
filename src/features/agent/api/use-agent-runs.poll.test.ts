import { describe, expect, it } from "vitest";

import { agentRunPollMs, shouldPollAgentRun } from "./use-agent-runs";

describe("agent run polling", () => {
  it("polls running every two seconds and awaiting confirmation a bit slower", () => {
    expect(shouldPollAgentRun("running")).toBe(true);
    expect(shouldPollAgentRun("completed")).toBe(false);
    expect(agentRunPollMs("running")).toBe(2000);
    expect(agentRunPollMs("awaiting_confirmation")).toBe(2500);
    expect(agentRunPollMs("completed")).toBe(false);
  });
});
