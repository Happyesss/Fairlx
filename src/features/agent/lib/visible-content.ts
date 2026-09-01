import { stripToolCallMarkup } from "./parse-tool-calls";

const APPWRITE_ID_RE = /\b[0-9a-f]{20}\b/gi;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const NARRATION_RE =
  /^(let me (check|look|search|fetch|find|inspect|query|get)|i('ll| will) (check|look|search|fetch|find|inspect|query|look up|get)|looking that up|checking (your|the)|i('m| am) (calling|using|invoking)|calling (the )?(model|mcp|tool)|use mcp_|fairlx is the platform).*$/gim;

function parseTruncatedPreview(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{") || !trimmed.includes('"truncated"')) return null;
  try {
    const parsed = JSON.parse(trimmed) as { truncated?: unknown; preview?: unknown };
    if (parsed?.truncated === true && typeof parsed.preview === "string") {
      return parsed.preview;
    }
  } catch {
    return null;
  }
  return null;
}

function unwrapTruncatedPreview(content: string): string {
  return parseTruncatedPreview(content) ?? content;
}

/** True when Appwrite stored `{truncated:true, preview}` instead of the full answer. */
export function isPersistedTruncatedAssistant(content: string | null | undefined): boolean {
  return Boolean(content && parseTruncatedPreview(content));
}

export function sanitizeAssistantVisible(content: string | null | undefined): string {
  if (!content?.trim()) return "";
  let next = unwrapTruncatedPreview(content);
  next = stripToolCallMarkup(next);
  next = next.replace(NARRATION_RE, "");
  next = next.replace(APPWRITE_ID_RE, "");
  next = next.replace(UUID_RE, "");
  next = next.replace(/\(\s*\)/g, "");
  next = next.replace(/[ \t]{2,}/g, " ");
  next = next.replace(/\n{3,}/g, "\n\n");
  return next.trim();
}

export function isToolNarrationOnly(content: string | null | undefined): boolean {
  return !sanitizeAssistantVisible(content);
}
