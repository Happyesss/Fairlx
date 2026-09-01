import { describe, expect, it } from "vitest";

import type { AgentChatMessage } from "../types";
import {
  fingerprintsFromMessages,
  isFailedToolContent,
  repeatedToolMessage,
  stableToolArgs,
  toolCallFingerprint,
} from "./tool-loop";

describe("toolCallFingerprint", () => {
  it("is stable for the same name and argument values regardless of key order", () => {
    const left = toolCallFingerprint(
      "fairlx_work_item_list",
      JSON.stringify({ workspaceId: "w1", projectId: "p1" }),
    );
    const right = toolCallFingerprint(
      "fairlx_work_item_list",
      JSON.stringify({ projectId: "p1", workspaceId: "w1" }),
    );
    expect(left).toBe(right);
    expect(stableToolArgs('{"b":1,"a":2}')).toBe(stableToolArgs('{"a":2,"b":1}'));
  });
});

describe("repeatedToolMessage", () => {
  it("is not treated as a failed tool result", () => {
    const content = repeatedToolMessage(JSON.stringify({ workItems: [{ id: "i1" }] }));
    expect(isFailedToolContent(content)).toBe(false);
    expect(JSON.parse(content).repeated).toBe(true);
  });
});

describe("fingerprintsFromMessages", () => {
  it("maps assistant toolCalls then matching tool results", () => {
    const now = new Date().toISOString();
    const messages: AgentChatMessage[] = [
      {
        id: "a1",
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "c1",
            name: "fairlx_work_item_list",
            arguments: JSON.stringify({ workspaceId: "w1" }),
          },
        ],
        createdAt: now,
      },
      {
        id: "t1",
        role: "tool",
        content: JSON.stringify({ workItems: [] }),
        toolCallId: "c1",
        toolName: "fairlx_work_item_list",
        createdAt: now,
      },
    ];
    const map = fingerprintsFromMessages(messages);
    const fingerprint = toolCallFingerprint(
      "fairlx_work_item_list",
      JSON.stringify({ workspaceId: "w1" }),
    );
    expect(map.get(fingerprint)).toBe(JSON.stringify({ workItems: [] }));
  });
});
