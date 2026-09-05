import { describe, expect, it } from "vitest";

import { matchWorkItem } from "./work-item-key";

describe("matchWorkItem", () => {
  it("matches by key or id for mail comments", () => {
    const items = [{ id: "i1", key: "WEB-12", title: "Client copy" }];
    expect(matchWorkItem(items, "WEB-12")?.id).toBe("i1");
    expect(matchWorkItem(items, "i1")?.key).toBe("WEB-12");
    expect(matchWorkItem(items, "WEB-99")).toBeUndefined();
  });
});
