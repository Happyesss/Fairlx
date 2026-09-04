import { describe, expect, it } from "vitest";

import { compactJsonString, parseJson, stringifyBounded, unwrapMcpToolContent } from "./truncate";

describe("stringifyBounded", () => {
  it("keeps valid JSON under the Appwrite string cap", () => {
    const messages = Array.from({ length: 40 }, (_, index) => ({
      id: `m${index}`,
      role: index % 2 === 0 ? "user" : "assistant",
      content: "x".repeat(800),
      createdAt: new Date().toISOString(),
    }));
    const json = stringifyBounded(messages, 16384);
    expect(json.startsWith("[")).toBe(true);
    expect(json.endsWith("]")).toBe(true);
    expect(json.length).toBeLessThanOrEqual(16384);
    const parsed = parseJson<unknown[]>(json, []);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  it("prefers user and assistant messages over tool dumps", () => {
    const dump = "y".repeat(2000);
    const messages = [
      { id: "u1", role: "user", content: "unique-user", createdAt: new Date().toISOString() },
      ...Array.from({ length: 20 }, (_, index) => ({
        id: `t${index}`,
        role: "tool",
        content: dump,
        toolCallId: `c${index}`,
        toolName: "fairlx_work_item_list",
        createdAt: new Date().toISOString(),
      })),
      { id: "a1", role: "assistant", content: "unique-assistant", createdAt: new Date().toISOString() },
    ];
    const json = stringifyBounded(messages, 16384);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(json).toContain("unique-user");
    expect(json).toContain("unique-assistant");
    expect(json.length).toBeLessThanOrEqual(16384);
  });

  it("keeps long assistant markdown instead of wrapping it as truncated JSON", () => {
    const proposal = [
      "Good — I can see the current open items are mostly bugs.",
      "",
      "## Feature: Automated Invoice & Payment Reminders",
      "x".repeat(2500),
    ].join("\n");
    const messages = [
      { id: "u1", role: "user", content: "propose a feature", createdAt: new Date().toISOString() },
      {
        id: "t1",
        role: "tool",
        content: JSON.stringify({ workItems: Array.from({ length: 40 }, (_, i) => ({ id: `wi${i}`, title: "z".repeat(200) })) }),
        toolCallId: "c1",
        toolName: "fairlx_work_item_list",
        createdAt: new Date().toISOString(),
      },
      { id: "a1", role: "assistant", content: proposal, createdAt: new Date().toISOString() },
    ];
    const json = stringifyBounded(messages, 16384);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(json.length).toBeLessThanOrEqual(16384);
    const parsed = parseJson<Array<{ role?: string; content?: string }>>(json, []);
    const assistant = parsed.find((message) => message.role === "assistant");
    expect(assistant?.content).toContain("Automated Invoice");
    expect(assistant?.content).toContain("Good —");
    expect(assistant?.content?.trim().startsWith("{")).toBe(false);
    expect(assistant?.content).not.toContain('"truncated":true');
  });

  it("pins an 8k assistant proposal instead of cutting it at the tool preview budget", () => {
    const proposal = [
      "Good — I can see the current open items.",
      "",
      "## Feature: Automated Invoice & Payment Reminders",
      "",
      "3. As a customer, I want automated reminders when invoices are overdue.",
      "x".repeat(7800),
    ].join("\n");
    const messages = [
      { id: "u0", role: "user", content: "older question " + "q".repeat(2000), createdAt: new Date().toISOString() },
      { id: "a0", role: "assistant", content: "older answer " + "a".repeat(2000), createdAt: new Date().toISOString() },
      { id: "u1", role: "user", content: "propose a feature", createdAt: new Date().toISOString() },
      {
        id: "t1",
        role: "tool",
        content: JSON.stringify({ workItems: Array.from({ length: 80 }, (_, i) => ({ id: `wi${i}`, title: "z".repeat(300) })) }),
        toolCallId: "c1",
        toolName: "fairlx_work_item_list",
        createdAt: new Date().toISOString(),
      },
      { id: "a1", role: "assistant", content: proposal, createdAt: new Date().toISOString() },
    ];
    const json = stringifyBounded(messages, 16384);
    expect(json.length).toBeLessThanOrEqual(16384);
    const parsed = parseJson<Array<{ role?: string; content?: string }>>(json, []);
    const assistant = parsed.filter((message) => message.role === "assistant").at(-1);
    expect(assistant?.content).toBe(proposal);
    expect(assistant?.content).toContain("As a customer, I want automated reminders");
    expect(assistant?.content?.endsWith("…")).toBe(false);
  });

  it("truncates a single oversized assistant at a sentence boundary, not mid-word", () => {
    const oversized = Array.from(
      { length: 400 },
      (_, i) => `Paragraph ${i + 1}. This is a complete sentence about invoicing.`,
    ).join("\n\n");
    const json = stringifyBounded(
      [{ id: "a1", role: "assistant", content: oversized, createdAt: new Date().toISOString() }],
      16384,
    );
    expect(json.length).toBeLessThanOrEqual(16384);
    const parsed = parseJson<Array<{ content?: string }>>(json, []);
    const content = parsed[0]?.content ?? "";
    expect(content.trim().startsWith("{")).toBe(false);
    expect(content).toContain("Paragraph 1.");
    expect(content.endsWith("…")).toBe(true);
    expect(content).not.toMatch(/wan…/);
    expect(content).not.toMatch(/\w…$/);
  });
});

describe("unwrapMcpToolContent", () => {
  it("extracts JSON from an MCP text envelope", () => {
    const inner = { hasMore: true, nextCursor: "abc", workItems: [{ key: "A-1" }] };
    const raw = JSON.stringify({
      content: [{ type: "text", text: JSON.stringify(inner, null, 2) }],
    });
    expect(JSON.parse(unwrapMcpToolContent(raw))).toEqual(inner);
  });
});

describe("compactJsonString work item lists", () => {
  it("keeps hasMore and nextCursor when dropping tail rows", () => {
    const payload = {
      hasMore: true,
      nextCursor: "doc_last",
      returned: 40,
      total: 61,
      unassignedCount: 18,
      workItems: Array.from({ length: 40 }, (_, i) => ({
        key: `PROJ-${i}`,
        title: "z".repeat(200),
        status: "TODO",
        assignees: [] as string[],
        unassigned: true,
      })),
    };
    const json = compactJsonString(JSON.stringify(payload), 800);
    const parsed = JSON.parse(json) as {
      hasMore: boolean;
      nextCursor: string;
      truncated?: boolean;
      omitted?: number;
      workItems: unknown[];
    };
    expect(parsed.hasMore).toBe(true);
    expect(parsed.nextCursor).toBe("doc_last");
    expect(parsed.truncated).toBe(true);
    expect((parsed.omitted ?? 0) + parsed.workItems.length).toBe(40);
    expect(
      (parsed as { assignment?: { unassignedCount: number; unassignedKeys: string[] } }).assignment
        ?.unassignedCount,
    ).toBe(40);
    expect(json).not.toContain('"preview"');
  });

  it("unwraps an envelope then compact the inner list", () => {
    const inner = {
      hasMore: true,
      nextCursor: "next",
      workItems: Array.from({ length: 30 }, (_, i) => ({ key: `K-${i}`, title: "y".repeat(180) })),
    };
    const envelope = JSON.stringify({
      content: [{ type: "text", text: JSON.stringify(inner) }],
    });
    const json = compactJsonString(envelope, 600);
    const parsed = JSON.parse(json) as { hasMore: boolean; nextCursor: string; workItems: unknown[] };
    expect(parsed.hasMore).toBe(true);
    expect(parsed.nextCursor).toBe("next");
    expect(Array.isArray(parsed.workItems)).toBe(true);
  });
});
