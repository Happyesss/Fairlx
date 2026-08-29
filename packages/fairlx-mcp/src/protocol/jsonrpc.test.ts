import { describe, expect, it } from "vitest";
import { PARSE_ERROR } from "./errors";
import { negotiateProtocolVersion, parseJsonRpc } from "./jsonrpc";
import { PREFERRED_PROTOCOL_VERSION } from "./types";

describe("parseJsonRpc", () => {
  it("returns PARSE_ERROR for invalid JSON", () => {
    const parsed = parseJsonRpc("not json");
    expect(parsed.request).toBeUndefined();
    expect(parsed.error).toMatchObject({
      jsonrpc: "2.0",
      id: null,
      error: { code: PARSE_ERROR },
    });
  });

  it("parses a valid ping request", () => {
    const parsed = parseJsonRpc(
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" })
    );
    expect(parsed.error).toBeUndefined();
    expect(parsed.request).toMatchObject({ method: "ping", id: 1, jsonrpc: "2.0" });
  });
});

describe("negotiateProtocolVersion", () => {
  it("returns a known requested version", () => {
    expect(negotiateProtocolVersion("2024-11-05")).toBe("2024-11-05");
    expect(negotiateProtocolVersion("2026-07-28")).toBe("2026-07-28");
  });

  it("falls back to preferred for unknown versions", () => {
    expect(negotiateProtocolVersion("nope")).toBe(PREFERRED_PROTOCOL_VERSION);
    expect(negotiateProtocolVersion(undefined)).toBe(PREFERRED_PROTOCOL_VERSION);
  });
});
