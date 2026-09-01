import { describe, expect, it } from "vitest";

import type { AgentChatMessage, AgentToolCall } from "../types";
import {
  collapseWorkItemListFanOut,
  fingerprintsFromMessages,
  isFailedToolContent,
  listSliceKey,
  rememberListSlice,
  repeatedToolMessage,
  resolveListSliceCall,
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

describe("list slice cache", () => {
  it("ignores cursorAfter when building the slice key", () => {
    expect(
      listSliceKey("fairlx_work_item_list", { projectId: "p1", cursorAfter: "first" }),
    ).toBe(listSliceKey("fairlx_work_item_list", { projectId: "p1", cursorAfter: "last" }));
  });

  it("blocks a second page when hasMore is false", () => {
    const cache = new Map();
    rememberListSlice(
      cache,
      "fairlx_work_item_list",
      { projectId: "p1" },
      JSON.stringify({ hasMore: false, nextCursor: null, workItems: [{ id: "a" }] }),
    );
    const skip = resolveListSliceCall(cache, "fairlx_work_item_list", {
      projectId: "p1",
      cursorAfter: "anything",
    });
    expect(skip.action).toBe("skip");
    if (skip.action === "skip") expect(skip.content).toMatch(/No further pages/);
  });

  it("rejects a cursor that is not the stored nextCursor", () => {
    const cache = new Map();
    rememberListSlice(
      cache,
      "fairlx_work_item_list",
      { projectId: "p1" },
      JSON.stringify({ hasMore: true, nextCursor: "doc_last", workItems: [] }),
    );
    const skip = resolveListSliceCall(cache, "fairlx_work_item_list", {
      projectId: "p1",
      cursorAfter: "doc_first",
    });
    expect(skip.action).toBe("skip");
    if (skip.action === "skip") expect(skip.content).toMatch(/Invalid cursorAfter/);
    const ok = resolveListSliceCall(cache, "fairlx_work_item_list", {
      projectId: "p1",
      cursorAfter: "doc_last",
    });
    expect(ok.action).toBe("execute");
  });
});

describe("collapseWorkItemListFanOut", () => {
  it("rewrites overlapping BUG and TODO lists into one project list", () => {
    const calls: AgentToolCall[] = [
      { id: "c1", name: "fairlx_work_item_list", arguments: JSON.stringify({ projectId: "p1", type: "BUG" }) },
      { id: "c2", name: "fairlx_work_item_list", arguments: JSON.stringify({ projectId: "p1", status: "TODO" }) },
      { id: "c3", name: "fairlx_sprint_list", arguments: JSON.stringify({ projectId: "p1" }) },
    ];
    const { calls: next, coalescedIds } = collapseWorkItemListFanOut(calls);
    expect(JSON.parse(next[0]!.arguments)).toEqual({ projectId: "p1" });
    expect(JSON.parse(next[1]!.arguments)).toEqual({ projectId: "p1" });
    expect(next[2]!.name).toBe("fairlx_sprint_list");
    expect([...coalescedIds]).toEqual(["c2"]);
  });
});
