import { describe, expect, it } from "vitest";
import { toolResult, wrapUntrusted } from "./output";

describe("output envelope", () => {
  it("wraps payloads as text content", () => {
    const result = toolResult({ ok: true });
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]?.text).toContain('"ok": true');
    expect(result.isError).toBeUndefined();
  });

  it("wraps untrusted content in fairlx tags", () => {
    const wrapped = wrapUntrusted("title", "user text");
    expect(wrapped).toContain("<fairlx_untrusted_content");
    expect(wrapped).toContain('label="title"');
    expect(wrapped).toContain("user text");
  });
});
