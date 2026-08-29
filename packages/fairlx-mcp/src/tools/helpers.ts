import { invalidParams } from "../protocol/errors";
import type { McpQuery } from "../runtime/types";
import type { McpRuntime } from "../runtime/types";
import { paginationQueries } from "../runtime/tenant";

export const LINK_INVERSE: Record<string, string> = {
  BLOCKS: "IS_BLOCKED_BY",
  IS_BLOCKED_BY: "BLOCKS",
  SPLIT_FROM: "SPLIT_TO",
  SPLIT_TO: "SPLIT_FROM",
  DUPLICATES: "IS_DUPLICATED_BY",
  IS_DUPLICATED_BY: "DUPLICATES",
  CLONED_FROM: "CLONED_TO",
  CLONED_TO: "CLONED_FROM",
  IS_CHILD_OF: "IS_PARENT_OF",
  IS_PARENT_OF: "IS_CHILD_OF",
  CAUSES: "IS_CAUSED_BY",
  IS_CAUSED_BY: "CAUSES",
};

export type LinkRecord = {
  $id?: string;
  sourceItemId?: string;
  targetItemId?: string;
  targetWorkItemId?: string;
  linkType?: string;
};

export function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || !value) {
    throw invalidParams(`Missing required string: ${key}`);
  }
  return value;
}

export function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function listQuery(args: Record<string, unknown>, extra: McpQuery[] = []): McpQuery[] {
  const { limit, cursorAfter } = paginationQueries(args);
  const queries: McpQuery[] = [...extra, { type: "limit", value: limit }, { type: "orderDesc", field: "$createdAt" }];
  if (cursorAfter) queries.push({ type: "cursorAfter", value: cursorAfter });
  return queries;
}

/**
 * Cycle detection for BLOCKS links. MUST use targetItemId (not targetWorkItemId).
 * Walks outbound BLOCKS edges from the proposed target; a cycle exists if we reach source.
 */
export function wouldCreateCycle(
  links: LinkRecord[],
  sourceItemId: string,
  targetItemId: string
): boolean {
  if (sourceItemId === targetItemId) return true;

  const adjacency = new Map<string, string[]>();
  for (const link of links) {
    if (link.linkType !== "BLOCKS") continue;
    const from = link.sourceItemId;
    const to = link.targetItemId;
    if (!from || !to) continue;
    const list = adjacency.get(from) ?? [];
    list.push(to);
    adjacency.set(from, list);
  }

  const stack = [targetItemId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === sourceItemId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    const next = adjacency.get(current) ?? [];
    for (const node of next) stack.push(node);
  }
  return false;
}

export async function loadBlocksLinks(
  runtime: McpRuntime,
  projectId: string
): Promise<LinkRecord[]> {
  const result = await runtime.store.list<LinkRecord>(runtime.collections.workItemLinks, [
    { type: "equal", field: "projectId", value: projectId },
    { type: "equal", field: "linkType", value: "BLOCKS" },
    { type: "limit", value: 100 },
  ]);
  return result.documents;
}

export function parseCustomFields(raw: unknown): Array<{ fieldId: string; value: unknown }> {
  if (Array.isArray(raw)) {
    return raw.filter((item) => item && typeof item === "object") as Array<{
      fieldId: string;
      value: unknown;
    }>;
  }
  if (typeof raw === "string" && raw) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function redactGithubRepo(doc: Record<string, unknown>): Record<string, unknown> {
  const { accessToken: _a, webhookSecret: _w, ...rest } = doc;
  return { ...rest, accessToken: undefined, webhookSecret: undefined };
}

export async function audit(
  runtime: McpRuntime,
  entry: Record<string, unknown>
): Promise<void> {
  try {
    await runtime.logAudit?.(entry);
  } catch {
    // audit must never fail the tool
  }
}
