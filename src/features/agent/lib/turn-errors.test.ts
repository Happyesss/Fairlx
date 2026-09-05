import { describe, expect, it } from "vitest";

import { formatAgentTurnError } from "./turn-errors";

describe("formatAgentTurnError", () => {
  it("maps AbortError to a timeout message", () => {
    const error = new Error("This operation was aborted");
    error.name = "AbortError";
    expect(formatAgentTurnError(error, 60_000)).toBe(
      "The model request timed out after 60s. Try again."
    );
  });

  it("maps TimeoutError to a timeout message", () => {
    const error = new Error("The operation was aborted due to timeout");
    error.name = "TimeoutError";
    expect(formatAgentTurnError(error)).toMatch(/timed out after \d+s/);
  });

  it("uses an 8-minute default so paid long-context calls are not killed at 60s", () => {
    const error = Object.assign(new Error("aborted"), { name: "AbortError" });
    expect(formatAgentTurnError(error, 480_000)).toBe(
      "The model request timed out after 480s. Try again.",
    );
  });

  it("passes through other errors", () => {
    expect(formatAgentTurnError(new Error("No AI model is configured."))).toBe(
      "No AI model is configured."
    );
  });
});
