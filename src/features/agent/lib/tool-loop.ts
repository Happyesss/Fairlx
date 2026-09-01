import type { AgentChatMessage } from "../types";
import { compactJsonString, truncateString } from "./truncate";

const PREVIOUS_RESULT_MAX = 1500;
export const MAX_CONSECUTIVE_TOOL_FAILURES = 3;
export const MAX_DUPLICATE_SKIPS = 2;

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function stableToolArgs(raw: string): string {
  try {
    const parsed = JSON.parse(raw || "{}") as unknown;
    if (parsed && typeof parsed === "object") return JSON.stringify(sortKeys(parsed));
  } catch {
    // keep raw
  }
  return raw || "{}";
}

export function toolCallFingerprint(name: string, args: string): string {
  return `${name}:${stableToolArgs(args)}`;
}

export function fingerprintsFromMessages(messages: AgentChatMessage[]): Map<string, string> {
  const map = new Map<string, string>();
  const pending = new Map<string, string>();
  for (const message of messages) {
    if (message.role === "assistant" && message.toolCalls?.length) {
      for (const call of message.toolCalls) {
        pending.set(call.id, toolCallFingerprint(call.name, call.arguments));
      }
    }
    if (message.role === "tool" && message.toolCallId) {
      const fingerprint = pending.get(message.toolCallId);
      if (fingerprint) {
        map.set(fingerprint, message.content);
        pending.delete(message.toolCallId);
      }
    }
  }
  return map;
}

export function repeatedToolMessage(previous: string): string {
  return JSON.stringify({
    repeated: true,
    message:
      "This exact tool call was already made. Use the previous result and answer the user now. Do not call this tool again with the same arguments.",
    previous: compactPrevious(previous),
  });
}

function compactPrevious(previous: string): unknown {
  const compact = compactJsonString(previous, PREVIOUS_RESULT_MAX);
  try {
    return JSON.parse(compact) as unknown;
  } catch {
    return truncateString(previous, PREVIOUS_RESULT_MAX);
  }
}

export function isFailedToolContent(content: string): boolean {
  if (!content?.trim()) return false;
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      if (parsed.repeated === true) return false;
      if (typeof parsed.error === "string" && parsed.error.trim()) return true;
      if (parsed.ok === false) return true;
    }
  } catch {
    return /error|failed|rate limit|unknown tool/i.test(content);
  }
  return /rate limit/i.test(content);
}
