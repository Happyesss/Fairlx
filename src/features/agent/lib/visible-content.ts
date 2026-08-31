import { stripToolCallMarkup } from "./parse-tool-calls";

const APPWRITE_ID_RE = /\b[0-9a-f]{20}\b/gi;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const NARRATION_RE =
  /^(let me (check|look|search|fetch|find|inspect|query)|i('ll| will) (check|look|search|fetch|find|inspect|query|look up)|looking that up|checking (your|the)|i('m| am) (calling|using|invoking)|calling (the )?(model|mcp|tool)|use mcp_|fairlx is the platform).*$/gim;

export function sanitizeAssistantVisible(content: string | null | undefined): string {
  if (!content?.trim()) return "";
  let next = stripToolCallMarkup(content);
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
