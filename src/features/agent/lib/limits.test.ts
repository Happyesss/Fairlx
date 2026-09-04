import { describe, expect, it } from "vitest";

import { agentChatTimeoutMs, DEFAULT_AGENT_CHAT_TIMEOUT_MS } from "./limits";

describe("agentChatTimeoutMs", () => {
  it("defaults to 8 minutes", () => {
    expect(agentChatTimeoutMs(undefined)).toBe(DEFAULT_AGENT_CHAT_TIMEOUT_MS);
    expect(agentChatTimeoutMs("")).toBe(DEFAULT_AGENT_CHAT_TIMEOUT_MS);
  });

  it("accepts a configured millisecond value", () => {
    expect(agentChatTimeoutMs("120000")).toBe(120_000);
  });

  it("rejects values under 30s", () => {
    expect(agentChatTimeoutMs("5000")).toBe(DEFAULT_AGENT_CHAT_TIMEOUT_MS);
  });
});
