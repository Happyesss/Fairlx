/**
 * Task ID Parser Utilities
 *
 * Extracts Fairlx task IDs from commit messages, branch names, and PR titles.
 * Task IDs follow the format FLX-{number} (case insensitive).
 *
 * Supported formats:
 *   - Commit: "fix: resolve login bug [FLX-123]"
 *   - Commit: "FLX-123 fix login bug"
 *   - Commit: "fix login bug FLX-123 and FLX-456"
 *   - Branch: "flx-123-fix-login-bug"
 *   - PR:     "[FLX-123] Fix login redirect"
 */

const TASK_ID_REGEX = /\[?FLX-(\d+)\]?/gi;
const BRANCH_TASK_ID_REGEX = /^flx-(\d+)/i;

/**
 * Extract all task IDs from a commit message.
 * Returns deduplicated, uppercase task IDs (e.g., ["FLX-123", "FLX-456"]).
 */
export function parseTaskIdsFromCommitMessage(message: string): string[] {
  if (!message) return [];

  const matches: string[] = [];
  let match: RegExpExecArray | null;

  // Reset regex lastIndex for safety
  TASK_ID_REGEX.lastIndex = 0;

  while ((match = TASK_ID_REGEX.exec(message)) !== null) {
    matches.push(`FLX-${match[1]}`);
  }

  // Deduplicate
  return [...new Set(matches)];
}

/**
 * Extract a single task ID from a branch name.
 * Branch must start with "flx-{id}" prefix.
 * Returns uppercase task ID (e.g., "FLX-123") or null if no match.
 */
export function parseTaskIdFromBranchName(
  branchName: string
): string | null {
  if (!branchName) return null;

  // Reset regex lastIndex for safety
  BRANCH_TASK_ID_REGEX.lastIndex = 0;

  const match = BRANCH_TASK_ID_REGEX.exec(branchName);
  if (!match) return null;

  return `FLX-${match[1]}`;
}

/**
 * Extract all task IDs from a PR title.
 * Uses the same regex as commit messages.
 */
export function parseTaskIdsFromPRTitle(title: string): string[] {
  return parseTaskIdsFromCommitMessage(title);
}

/**
 * Collect all unique task IDs from a push event.
 * Checks both commit messages and the branch name.
 */
export function collectTaskIdsFromPush(
  commitMessages: string[],
  branchName: string
): string[] {
  const allIds = new Set<string>();

  // From branch name
  const branchTaskId = parseTaskIdFromBranchName(branchName);
  if (branchTaskId) {
    allIds.add(branchTaskId);
  }

  // From commit messages
  for (const message of commitMessages) {
    const ids = parseTaskIdsFromCommitMessage(message);
    for (const id of ids) {
      allIds.add(id);
    }
  }

  return [...allIds];
}
