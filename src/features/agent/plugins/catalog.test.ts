import { describe, expect, it } from "vitest";

import { inferCapabilities, missingCapabilities, hasCapability, catalogForCapability } from "./catalog";
import { scanSourceFiles, verifyFindings } from "./security";
import { githubCapabilityGap, parsePrFiles } from "./github-helpers";
import type { AgentContext } from "../types";

function context(): AgentContext {
  return {
    user: { id: "u1", name: "Ada", email: "ada@fairlx.dev" },
    workspaces: [],
    projects: [],
    workItems: [],
    notifications: [],
    githubRepos: [],
    integrations: [],
    docs: [],
  };
}

describe("capability inference", () => {
  it("requires email.send for mail prompts when no plugin is connected", () => {
    expect(inferCapabilities("Send a mail about WEB-12 to the client")).toContain("email.send");
    expect(missingCapabilities("Send a mail about WEB-12", [], context())).toContain("email.send");
  });

  it("treats linked GitHub repos as code.read", () => {
    const ctx = context();
    ctx.githubRepos = [{ id: "r1", owner: "acme", repositoryName: "app", branch: "main" }];
    expect(hasCapability([], ctx, "code.read")).toBe(true);
    expect(missingCapabilities("read the repo file", [], ctx)).toEqual([]);
  });

  it("offers GitHub PAT connect for code.write when no repo is linked", () => {
    const items = catalogForCapability("code.write");
    expect(items.some((item) => item.id === "github")).toBe(true);
  });
});

describe("security scanner", () => {
  it("drops findings without a path after verification", () => {
    const scanned = scanSourceFiles([
      { path: "src/db.ts", content: 'const query = "SELECT * FROM users WHERE id=" + userId' },
      { path: "", content: "innerHTML = x" },
    ]);
    const verified = verifyFindings(scanned);
    expect(verified.length).toBeGreaterThan(0);
    expect(verified.every((item) => item.verified && item.path)).toBe(true);
  });
});

describe("github helpers", () => {
  it("maps missing-token errors to code.write", () => {
    expect(githubCapabilityGap({ error: "GitHub token is missing or cannot push." })).toBe("code.write");
    expect(githubCapabilityGap({ html_url: "https://github.com/x" })).toBeUndefined();
  });

  it("parses PR file batches", () => {
    expect(parsePrFiles([{ path: "a.ts", content: "x" }, { path: "", content: "y" }])).toEqual([
      { path: "a.ts", content: "x", message: undefined },
    ]);
  });
});
