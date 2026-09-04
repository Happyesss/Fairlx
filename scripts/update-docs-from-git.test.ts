import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("update-docs-from-git", () => {
  it("rewrites changelog.md and the README latest block from git history", () => {
    execFileSync("node", ["scripts/update-docs-from-git.mjs", "--push"], { cwd: ROOT });
    const changelog = readFileSync(join(ROOT, "changelog.md"), "utf8");
    expect(changelog).toMatch(/^# Changelog\n/);
    expect(changelog).toContain("Recent commits");
    expect(changelog).toContain("Last generated:");
    expect(changelog).not.toContain("docs: refresh README and changelog");

    const readme = readFileSync(join(ROOT, "README.md"), "utf8");
    const start = readme.indexOf("<!-- docs:latest:start -->");
    const end = readme.indexOf("<!-- docs:latest:end -->");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const latest = readme.slice(start, end);
    expect(latest).toMatch(/\*\*Last updated:\*\*/);
    expect(latest).toContain("changelog.md");
  });
});
