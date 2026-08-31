import type { AgentGitStageItem, AgentGitStaging } from "../types";

export function emptyGitStaging(): AgentGitStaging {
  return { items: [], updatedAt: new Date().toISOString() };
}

export function emptyChatMeta() {
  return { pinnedRunIds: [] as string[], archivedRunIds: [] as string[] };
}

export function parseGitStaging(raw: unknown): AgentGitStaging {
  if (!raw || typeof raw !== "object") return emptyGitStaging();
  const items = Array.isArray((raw as AgentGitStaging).items) ? (raw as AgentGitStaging).items : [];
  return {
    items: items
      .filter((item) => item && typeof item === "object" && typeof item.path === "string")
      .map((item) => ({
        id: String(item.id || crypto.randomUUID()),
        path: String(item.path),
        summary: String(item.summary || ""),
        status:
          item.status === "staged" || item.status === "committed" || item.status === "unstaged"
            ? item.status
            : "unstaged",
        repoId: item.repoId ? String(item.repoId) : undefined,
        branch: item.branch ? String(item.branch) : undefined,
        content: item.content ? String(item.content) : undefined,
        createdAt: String(item.createdAt || new Date().toISOString()),
      })),
    updatedAt: String((raw as AgentGitStaging).updatedAt || new Date().toISOString()),
  };
}

export function parseChatMeta(raw: unknown) {
  const empty = emptyChatMeta();
  if (!raw || typeof raw !== "object") return empty;
  const pinned = Array.isArray((raw as { pinnedRunIds?: unknown }).pinnedRunIds)
    ? ((raw as { pinnedRunIds: unknown[] }).pinnedRunIds.filter((id) => typeof id === "string") as string[])
    : [];
  const archived = Array.isArray((raw as { archivedRunIds?: unknown }).archivedRunIds)
    ? ((raw as { archivedRunIds: unknown[] }).archivedRunIds.filter((id) => typeof id === "string") as string[])
    : [];
  return { pinnedRunIds: pinned, archivedRunIds: archived };
}

export function stageItem(
  staging: AgentGitStaging,
  input: { path: string; summary?: string; repoId?: string; branch?: string; content?: string },
): AgentGitStaging {
  const path = input.path.trim();
  if (!path) return staging;
  const existing = staging.items.find((item) => item.path === path && item.status !== "committed");
  const nextItem: AgentGitStageItem = {
    id: existing?.id || crypto.randomUUID(),
    path,
    summary: (input.summary || existing?.summary || path).trim(),
    status: "staged",
    repoId: input.repoId || existing?.repoId,
    branch: input.branch || existing?.branch,
    content: input.content || existing?.content,
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  const items = existing
    ? staging.items.map((item) => (item.id === existing.id ? nextItem : item))
    : [...staging.items, nextItem];
  return { items, updatedAt: new Date().toISOString() };
}

export function unstageItem(staging: AgentGitStaging, idOrPath: string): AgentGitStaging {
  const needle = idOrPath.trim();
  return {
    items: staging.items.map((item) =>
      item.id === needle || item.path === needle
        ? { ...item, status: item.status === "committed" ? item.status : "unstaged" }
        : item,
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function commitStaged(
  staging: AgentGitStaging,
  message: string,
): { staging: AgentGitStaging; committed: AgentGitStageItem[]; message: string } {
  const committed = staging.items.filter((item) => item.status === "staged");
  return {
    message: message.trim() || "Planned commit",
    committed,
    staging: {
      items: staging.items.map((item) => (item.status === "staged" ? { ...item, status: "committed" } : item)),
      updatedAt: new Date().toISOString(),
    },
  };
}
