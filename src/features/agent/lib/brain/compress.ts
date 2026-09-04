import type { AgentChatMessage } from "../../types";
import { compactJsonString, unwrapMcpToolContent } from "../truncate";

export const COMPRESS_KEEP_RECENT = 8;
export const SPECIALIST_RESULT_MAX = 2000;

function summarizeToolBody(content: string): string {
  const raw = unwrapMcpToolContent(content);
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return compactJsonString(raw, 400);
    const slim: Record<string, unknown> = { compressed: true };
    for (const key of ["error", "key", "title", "status", "path", "url", "html_url", "message", "ok", "jobId"]) {
      if (parsed[key] != null) slim[key] = parsed[key];
    }
    if (Array.isArray(parsed.items)) slim.itemCount = parsed.items.length;
    if (Array.isArray(parsed.workItems)) slim.workItemCount = parsed.workItems.length;
    if (Array.isArray(parsed.findings)) slim.findingCount = parsed.findings.length;
    if (typeof parsed.content === "string") slim.contentPreview = parsed.content.slice(0, 180);
    return compactJsonString(JSON.stringify(slim), 500);
  } catch {
    return compactJsonString(raw, 400);
  }
}

export function compressMessages(messages: AgentChatMessage[]): AgentChatMessage[] {
  if (messages.length <= COMPRESS_KEEP_RECENT) return messages;
  const cut = messages.length - COMPRESS_KEEP_RECENT;
  return messages.map((message, index) => {
    if (index >= cut) return message;
    if (message.role !== "tool") return message;
    return { ...message, content: summarizeToolBody(message.content) };
  });
}

export function capSpecialistResult(content: string): string {
  return compactJsonString(content, SPECIALIST_RESULT_MAX);
}
