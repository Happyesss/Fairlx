import { describe, expect, it } from "vitest";

import { isAttributeNotReady } from "./lib/db-helpers";

describe("isAttributeNotReady", () => {
  it("matches Appwrite's processing race", () => {
    expect(
      isAttributeNotReady(new Error("The requested attribute 'userId' is not yet available. Please try again later.")),
    ).toBe(true);
    expect(isAttributeNotReady(new Error("Unknown attribute: extraJson"))).toBe(false);
  });
});
