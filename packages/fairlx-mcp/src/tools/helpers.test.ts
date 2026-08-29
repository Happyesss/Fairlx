import { describe, expect, it } from "vitest";
import { wouldCreateCycle } from "./helpers";

describe("wouldCreateCycle", () => {
  it("detects a cycle using targetItemId", () => {
    const links = [
      { sourceItemId: "a", targetItemId: "b", linkType: "BLOCKS" },
      { sourceItemId: "b", targetItemId: "c", linkType: "BLOCKS" },
    ];
    expect(wouldCreateCycle(links, "c", "a")).toBe(true);
  });

  it("ignores targetWorkItemId", () => {
    const links = [{ sourceItemId: "a", targetWorkItemId: "b", linkType: "BLOCKS" }];
    expect(wouldCreateCycle(links, "b", "a")).toBe(false);
  });
});
