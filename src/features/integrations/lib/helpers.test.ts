import { describe, expect, it } from "vitest";
import { hashMcpToken, suggestedBranchName, slugifyBranchTitle } from "./helpers";
import { matchAgentBranch } from "./branch";
import { buildCloneUrl, parseVcsConfig, serializeVcsConfig } from "./vcs-config";

describe("integration helpers", () => {
  it("slugifies titles for branch names", () => {
    expect(slugifyBranchTitle("Fix Login Bug!!")).toBe("fix-login-bug");
  });

  it("builds suggested branch from key + title", () => {
    expect(suggestedBranchName("PROJ-12", "Add dark mode")).toBe("PROJ-12-add-dark-mode");
  });

  it("hashes mcp tokens stably", () => {
    expect(hashMcpToken("flx_abc")).toBe(hashMcpToken("flx_abc"));
    expect(hashMcpToken("flx_abc")).not.toBe(hashMcpToken("flx_xyz"));
  });
});

describe("vcs config", () => {
  it("builds gitlab and bitbucket clone urls", () => {
    expect(buildCloneUrl("gitlab", "acme", "app")).toBe("https://gitlab.com/acme/app.git");
    expect(buildCloneUrl("gitlab", "acme", "app", "https://gitlab.example.com/")).toBe(
      "https://gitlab.example.com/acme/app.git"
    );
    expect(buildCloneUrl("bitbucket", "acme", "app")).toBe(
      "https://bitbucket.org/acme/app.git"
    );
  });

  it("round-trips serialize/parse", () => {
    const json = serializeVcsConfig({
      provider: "gitlab",
      owner: "acme",
      repo: "app",
      defaultBranch: "develop",
      baseUrl: "https://gitlab.com",
    });
    const parsed = parseVcsConfig("gitlab", json);
    expect(parsed).toMatchObject({
      provider: "gitlab",
      owner: "acme",
      repo: "app",
      defaultBranch: "develop",
      cloneUrl: "https://gitlab.com/acme/app.git",
    });
  });
});

describe("matchAgentBranch", () => {
  it("returns suggested branch when no events", () => {
    const match = matchAgentBranch("PROJ-1", "Fix bug", null);
    expect(match.status).toBe("none");
    expect(match.branchName).toBe("PROJ-1-fix-bug");
  });

  it("detects open PR on matching branch", () => {
    const match = matchAgentBranch("PROJ-1", "Fix bug", {
      pullRequests: [
        {
          branchName: "PROJ-1-fix-bug",
          prState: "open",
          prUrl: "https://github.com/o/r/pull/3",
          prNumber: 3,
        },
      ],
    });
    expect(match.status).toBe("pr_open");
    expect(match.prNumber).toBe(3);
  });

  it("detects branch from commits containing key", () => {
    const match = matchAgentBranch("PROJ-9", "Anything", {
      commits: [{ branchName: "feature/PROJ-9-wip" }],
    });
    expect(match.status).toBe("branch");
    expect(match.branchName).toBe("feature/PROJ-9-wip");
  });
});
