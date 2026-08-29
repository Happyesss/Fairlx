import type { McpToolResult } from "../protocol/types";

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

export function withId<T extends Record<string, unknown>>(doc: T): T & { id: string } {
  return { ...doc, id: String(doc.$id ?? doc.id) };
}
