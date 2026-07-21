/** Client-safe branch naming helpers (no Node-only imports). */

export function slugifyBranchTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function suggestedBranchName(key: string, title: string): string {
  const slug = slugifyBranchTitle(title);
  return slug ? `${key}-${slug}` : key;
}

export type AgentBranchMatch = {
  status: "none" | "branch" | "pr_open" | "pr_merged" | "pr_closed";
  branchName?: string;
  prUrl?: string;
  prNumber?: number;
};

/**
 * Match GitHub-synced events against the suggested agent branch (or any branch
 * containing the work-item key).
 */
export function matchAgentBranch(
  taskKey: string,
  taskTitle: string,
  events?: {
    commits?: Array<{ branchName?: string }>;
    pullRequests?: Array<{
      branchName?: string;
      prState?: string;
      prUrl?: string;
      prNumber?: number;
    }>;
  } | null
): AgentBranchMatch {
  if (!taskKey) return { status: "none" };

  const suggested = suggestedBranchName(taskKey, taskTitle || "work-item");
  const keyUpper = taskKey.toUpperCase();

  const matchesBranch = (name?: string) => {
    if (!name) return false;
    const n = name.toLowerCase();
    return (
      n === suggested.toLowerCase() ||
      n.includes(keyUpper.toLowerCase()) ||
      n.startsWith(`${taskKey.toLowerCase()}-`)
    );
  };

  const prs = events?.pullRequests || [];
  const matchedPr =
    prs.find((p) => matchesBranch(p.branchName) && p.prState?.toLowerCase() === "merged") ||
    prs.find((p) => matchesBranch(p.branchName) && p.prState?.toLowerCase() === "open") ||
    prs.find((p) => matchesBranch(p.branchName));

  if (matchedPr) {
    const state = (matchedPr.prState || "open").toLowerCase();
    return {
      status:
        state === "merged"
          ? "pr_merged"
          : state === "closed"
            ? "pr_closed"
            : "pr_open",
      branchName: matchedPr.branchName,
      prUrl: matchedPr.prUrl,
      prNumber: matchedPr.prNumber,
    };
  }

  const commit = (events?.commits || []).find((c) => matchesBranch(c.branchName));
  if (commit?.branchName) {
    return { status: "branch", branchName: commit.branchName };
  }

  return { status: "none", branchName: suggested };
}
