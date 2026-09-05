import type { McpToolResult } from "../protocol/types";
import type { McpRuntime, McpUserProfile } from "./types";

export function wrapUntrusted(label: string, value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return `<fairlx_untrusted_content label="${escapeAttr(label)}">\n${text}\n</fairlx_untrusted_content>`;
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;");
}

export function toolResult(
  payload: unknown,
  isError = false,
  options?: { compact?: boolean }
): McpToolResult {
  return {
    content: [
      {
        type: "text",
        text: options?.compact ? JSON.stringify(payload) : JSON.stringify(payload, null, 2),
      },
    ],
    ...(isError ? { isError: true } : {}),
  };
}

export function toolText(text: string, isError = false): McpToolResult {
  return {
    content: [{ type: "text", text }],
    ...(isError ? { isError: true } : {}),
  };
}

export const WORK_ITEM_LIST_SCAN_CAP = 500;
export const WORK_ITEM_LIST_PAGE_SIZE = 100;

export function assigneeIdsOf(doc: Record<string, unknown>): string[] {
  const raw = doc.assigneeIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

export type CompactAssignee = {
  name: string;
  imageUrl?: string | null;
  email?: string;
};

export function assigneeQueryMatches(people: CompactAssignee[] | undefined, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (people ?? []).some((person) => {
    const name = person.name.trim().toLowerCase();
    const email = (person.email ?? "").trim().toLowerCase();
    const local = email.split("@")[0] ?? "";
    return name === q || email === q || local === q || name.includes(q);
  });
}

export function isBacklogSprintId(sprintId: unknown): boolean {
  if (sprintId == null) return true;
  const value = String(sprintId).trim();
  return value.length === 0 || value === "null" || value === "undefined";
}

export function locationSummary(
  items: Array<{ key?: unknown; location?: unknown; sprintId?: unknown }>,
): {
  backlogCount: number;
  backlogKeys: string[];
  sprintCount: number;
  sprintKeys: string[];
} {
  const backlogKeys: string[] = [];
  const sprintKeys: string[] = [];
  for (const item of items) {
    const key = typeof item.key === "string" ? item.key.trim() : "";
    if (!key) continue;
    if (item.location === "backlog" || isBacklogSprintId(item.sprintId)) backlogKeys.push(key);
    else sprintKeys.push(key);
  }
  return {
    backlogCount: backlogKeys.length,
    backlogKeys,
    sprintCount: sprintKeys.length,
    sprintKeys,
  };
}

export function compactWorkItem(
  doc: Record<string, unknown>,
  assignees?: CompactAssignee[],
  epic?: Record<string, unknown> | null,
): Record<string, unknown> {
  const ids = assigneeIdsOf(doc);
  const people = (assignees ?? [])
    .map((person) => ({
      name: person.name.trim(),
      imageUrl: person.imageUrl ?? null,
    }))
    .filter((person) => person.name);
  const hydrated = assignees !== undefined;
  const sprintId = isBacklogSprintId(doc.sprintId) ? null : String(doc.sprintId).trim();
  const hasEpic = Boolean(String(doc.epicId ?? "").trim());
  const epicKey = epic ? String(epic.key ?? "").trim() || null : null;
  const epicTitle = epic
    ? String(epic.title ?? epic.name ?? "").trim() || null
    : null;
  return {
    key: doc.key,
    title: doc.title ?? doc.name,
    status: doc.status,
    type: doc.type,
    priority: doc.priority,
    labels: Array.isArray(doc.labels) ? doc.labels : [],
    location: sprintId ? "sprint" : "backlog",
    sprintId,
    storyPoints: doc.storyPoints ?? null,
    dueDate: doc.dueDate ?? null,
    hasEpic,
    epicKey,
    epicTitle,
    assignees: people,
    unassigned: hydrated ? people.length === 0 : ids.length === 0,
  };
}

export async function hydrateWorkItemEpics(
  runtime: Pick<McpRuntime, "store" | "collections">,
  docs: Record<string, unknown>[],
): Promise<Array<Record<string, unknown> | null>> {
  const ids = [
    ...new Set(docs.map((doc) => String(doc.epicId ?? "").trim()).filter(Boolean)),
  ];
  const map = new Map<string, Record<string, unknown>>();
  for (const id of ids) {
    try {
      const found = await runtime.store.get<Record<string, unknown>>(runtime.collections.workItems, id);
      map.set(id, found);
    } catch {
      /* missing epic */
    }
  }
  return docs.map((doc) => {
    const id = String(doc.epicId ?? "").trim();
    return id ? map.get(id) ?? null : null;
  });
}

function memberDisplayName(doc: Record<string, unknown>, profile?: McpUserProfile): string {
  const email = String(profile?.email || doc.email || "").trim();
  return String(profile?.name || doc.name || "").trim() || email;
}

async function loadMembersByIds(
  runtime: Pick<McpRuntime, "store" | "collections">,
  ids: string[]
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  const collection = runtime.collections.members;
  if (!collection || ids.length === 0) return map;

  const unique = [...new Set(ids)];
  for (let offset = 0; offset < unique.length; offset += 100) {
    const chunk = unique.slice(offset, offset + 100);
    try {
      const result = await runtime.store.list<Record<string, unknown>>(collection, [
        { type: "equal", field: "$id", value: chunk.length === 1 ? chunk[0]! : chunk },
        { type: "limit", value: chunk.length },
      ]);
      for (const doc of result.documents) {
        const id = String(doc.$id ?? doc.id ?? "");
        if (id) map.set(id, doc);
      }
    } catch {
      // fall through to per-id get
    }
    for (const id of chunk) {
      if (map.has(id)) continue;
      try {
        const doc = await runtime.store.get<Record<string, unknown>>(collection, id);
        map.set(id, doc);
      } catch {
        // stale / missing member — unresolved, same as the board
      }
    }
  }
  return map;
}

async function loadMembersForAssigneeIds(
  runtime: Pick<McpRuntime, "store" | "collections">,
  ids: string[]
): Promise<Map<string, Record<string, unknown>>> {
  const map = await loadMembersByIds(runtime, ids);
  const leftover = ids.filter((id) => !map.has(id));
  const collection = runtime.collections.members;
  if (!collection || leftover.length === 0) return map;
  try {
    const result = await runtime.store.list<Record<string, unknown>>(collection, [
      { type: "equal", field: "userId", value: leftover.length === 1 ? leftover[0]! : leftover },
      { type: "limit", value: leftover.length },
    ]);
    for (const doc of result.documents) {
      indexAssigneeMember(map, doc);
    }
  } catch {
    // Board still treats unresolved ids as Unassigned.
  }
  return map;
}

function indexAssigneeMember(
  map: Map<string, Record<string, unknown>>,
  doc: Record<string, unknown>
) {
  const membershipId = String(doc.$id ?? doc.id ?? "");
  const userId = String(doc.userId ?? "");
  if (membershipId) map.set(membershipId, doc);
  if (userId) map.set(userId, doc);
}

/** Resolve assignee display names like the Kanban card: missing members are omitted. */
export async function hydrateWorkItemAssignees(
  runtime: Pick<McpRuntime, "store" | "collections" | "lookupUsers">,
  documents: Record<string, unknown>[]
): Promise<CompactAssignee[][]> {
  if (!runtime.collections.members) {
    return documents.map(() => []);
  }
  const allIds = [...new Set(documents.flatMap((doc) => assigneeIdsOf(doc)))];
  const members = await loadMembersForAssigneeIds(runtime, allIds);
  const userIds = [
    ...new Set(
      [...members.values()]
        .map((doc) => String(doc.userId ?? ""))
        .filter(Boolean),
    ),
  ];
  const profiles = runtime.lookupUsers && userIds.length ? await runtime.lookupUsers(userIds) : [];
  const profileByUserId = new Map(profiles.map((profile) => [profile.id, profile]));
  return documents.map((doc) =>
    assigneeIdsOf(doc).flatMap((id) => {
      const member = members.get(id);
      if (!member) return [];
      const profile = profileByUserId.get(String(member.userId ?? ""));
      const name = memberDisplayName(member, profile);
      if (!name) return [];
      return [{
        name,
        imageUrl: profile?.profileImageUrl ?? (typeof member.profileImageUrl === "string" ? member.profileImageUrl : null),
        email: String(profile?.email || member.email || "").trim() || undefined,
      }];
    })
  );
}

/** Work-item keys like WEB-12 are not Appwrite document cursors. */
export function isWorkItemKeyCursor(cursor: string | undefined): boolean {
  if (!cursor) return false;
  return /^[A-Za-z][A-Za-z0-9]*-\d+$/.test(cursor.trim());
}

export function paginationMeta(
  documents: Record<string, unknown>[],
  total: number,
  limit: number
): {
  hasMore: boolean;
  nextCursor: string | null;
  returned: number;
  total: number;
} {
  const hasMore = documents.length === limit && total > documents.length;
  const last = documents[documents.length - 1];
  const lastId = last ? String(last.$id ?? last.id ?? "").trim() : "";
  return {
    hasMore,
    nextCursor: hasMore && lastId ? lastId : null,
    returned: documents.length,
    total,
  };
}

export function withId<T extends Record<string, unknown>>(doc: T): T & { id: string } {
  return { ...doc, id: String(doc.$id ?? doc.id) };
}

export function compactMember(
  doc: Record<string, unknown>,
  profile?: McpUserProfile
): {
  name: string;
  email: string;
  role: string;
  status: string;
  imageUrl: string | null;
} {
  const email = String(profile?.email || doc.email || "").trim();
  const name = String(profile?.name || doc.name || "").trim() || email || "Unknown member";
  const imageUrl =
    profile?.profileImageUrl ??
    (typeof doc.profileImageUrl === "string" ? doc.profileImageUrl : null);
  return {
    name,
    email,
    role: String(doc.role ?? "MEMBER"),
    status: String(doc.status ?? "ACTIVE"),
    imageUrl: imageUrl || null,
  };
}

export async function hydrateMembers(
  runtime: Pick<McpRuntime, "lookupUsers">,
  docs: Record<string, unknown>[]
): Promise<ReturnType<typeof compactMember>[]> {
  const userIds = docs.map((doc) => String(doc.userId ?? "")).filter(Boolean);
  const profiles = runtime.lookupUsers ? await runtime.lookupUsers(userIds) : [];
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  return docs.map((doc) => compactMember(doc, byId.get(String(doc.userId ?? ""))));
}
