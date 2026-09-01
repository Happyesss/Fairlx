import type { McpToolResult } from "../protocol/types";
import type { McpRuntime, McpUserProfile } from "./types";

export function wrapUntrusted(label: string, value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return `<fairlx_untrusted_content label="${escapeAttr(label)}">\n${text}\n</fairlx_untrusted_content>`;
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;");
}

export function toolResult(payload: unknown, isError = false): McpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

export function toolText(text: string, isError = false): McpToolResult {
  return {
    content: [{ type: "text", text }],
    ...(isError ? { isError: true } : {}),
  };
}

export function compactWorkItem(doc: Record<string, unknown>): Record<string, unknown> {
  return {
    id: doc.$id ?? doc.id,
    key: doc.key,
    title: doc.title ?? doc.name,
    status: doc.status,
    type: doc.type,
    priority: doc.priority,
    assigneeIds: doc.assigneeIds ?? [],
    sprintId: doc.sprintId ?? null,
    storyPoints: doc.storyPoints ?? null,
  };
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
} {
  const email = String(profile?.email || doc.email || "").trim();
  const name = String(profile?.name || doc.name || "").trim() || email || "Unknown member";
  return {
    name,
    email,
    role: String(doc.role ?? "MEMBER"),
    status: String(doc.status ?? "ACTIVE"),
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
