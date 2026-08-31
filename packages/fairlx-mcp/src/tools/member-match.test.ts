import { describe, expect, it } from "vitest";
import { levenshtein, matchWorkspaceMember, normalizeMemberRole } from "./member-match";

const shashank = {
  id: "m1",
  name: "Shashank Kumar Rathour",
  email: "shashank@fairlx.dev",
  role: "MEMBER",
  status: "ACTIVE",
};

describe("normalizeMemberRole", () => {
  it("maps admin aliases onto ADMIN", () => {
    expect(normalizeMemberRole("admin")).toBe("ADMIN");
    expect(normalizeMemberRole("ws-admin")).toBe("ADMIN");
  });

  it("rejects unknown roles", () => {
    expect(() => normalizeMemberRole("superuser")).toThrow(/Unknown role/);
  });
});

describe("matchWorkspaceMember", () => {
  it("accepts a one-letter last-name typo like Rathore vs Rathour", () => {
    const match = matchWorkspaceMember("Shashank Kumar Rathore", [shashank]);
    expect(match).toEqual({ kind: "one", member: shashank });
  });

  it("matches a last name typo on its own when only one person fits", () => {
    expect(matchWorkspaceMember("Rathore", [shashank])).toEqual({ kind: "one", member: shashank });
  });

  it("returns several people when the query is ambiguous", () => {
    const match = matchWorkspaceMember("Shashank", [
      shashank,
      { ...shashank, id: "m2", name: "Shashank Gupta", email: "gupta@fairlx.dev" },
    ]);
    expect(match.kind).toBe("many");
  });
});

describe("levenshtein", () => {
  it("is 2 for Rathore vs Rathour", () => {
    expect(levenshtein("rathore", "rathour")).toBe(2);
  });
});
