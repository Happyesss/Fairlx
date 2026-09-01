export function parseJson<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function truncateString(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

/** Prefer a paragraph/sentence/word break so user-visible prose is not cut mid-word. */
export function truncateAtBoundary(value: string, max: number): string {
  if (value.length <= max) return value;
  const ellipsis = "…";
  const budget = Math.max(0, max - ellipsis.length);
  if (budget < 32) return truncateString(value, max);
  const slice = value.slice(0, budget);
  const markers = ["\n\n", "\n", ". ", "? ", "! ", " "];
  for (const marker of markers) {
    const idx = slice.lastIndexOf(marker);
    if (idx >= Math.floor(budget * 0.55)) {
      const end = idx + (marker === ". " || marker === "? " || marker === "! " ? 1 : 0);
      return `${slice.slice(0, end).trimEnd()}${ellipsis}`;
    }
  }
  return `${slice.trimEnd()}${ellipsis}`;
}

const FALLBACK_JSON = '{"truncated":true}';
const TOOL_CONTENT_SOFT = 1200;
const TOOL_CONTENT_HARD = 400;
const EVENT_PAYLOAD_MAX = 600;
const DETAIL_MAX = 400;

export function compactJsonString(raw: string, max: number): string {
  if (!raw || raw.length <= max) return raw;
  try {
    const compacted = compactUnknown(JSON.parse(raw) as unknown, max);
    const json = JSON.stringify(compacted);
    if (json.length <= max) return json;
    return JSON.stringify({
      truncated: true,
      preview: truncateString(json, Math.max(32, max - 40)),
    });
  } catch {
    // Prose / markdown is not JSON. Truncate in place so chat bubbles stay readable.
    return truncateString(raw, max);
  }
}

function compactUnknown(value: unknown, budget: number): unknown {
  if (typeof value === "string") {
    return truncateString(value, Math.min(value.length, Math.max(80, Math.floor(budget / 2))));
  }
  if (Array.isArray(value)) {
    const next: unknown[] = [];
    for (const item of value) {
      next.push(compactUnknown(item, Math.max(80, Math.floor(budget / Math.max(2, next.length + 1)))));
      if (JSON.stringify(next).length > budget) {
        next.pop();
        break;
      }
    }
    return next;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(record)) {
      if (key === "payload") {
        try {
          if (JSON.stringify(nested).length > EVENT_PAYLOAD_MAX) continue;
        } catch {
          continue;
        }
      }
      next[key] = compactUnknown(nested, budget);
      if (JSON.stringify(next).length > budget) {
        if (typeof next[key] === "string") {
          next[key] = truncateString(next[key] as string, 120);
        } else {
          delete next[key];
        }
        break;
      }
    }
    return next;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compactArrayItems(items: unknown[]): unknown[] {
  return items.map((item) => {
    if (!isRecord(item)) return item;
    const next: Record<string, unknown> = { ...item };
    const isToolMessage = next.role === "tool";
    if (isToolMessage && typeof next.content === "string" && next.content.length > TOOL_CONTENT_SOFT) {
      next.content = compactJsonString(next.content, TOOL_CONTENT_SOFT);
    }
    if (typeof next.detail === "string" && next.detail.length > DETAIL_MAX) {
      next.detail = truncateString(next.detail, DETAIL_MAX);
    }
    if (next.payload !== undefined) {
      try {
        if (JSON.stringify(next.payload).length > EVENT_PAYLOAD_MAX) next.payload = undefined;
      } catch {
        next.payload = undefined;
      }
    }
    return next;
  });
}

function isFinalVisibleMessage(item: unknown): boolean {
  if (!isRecord(item)) return false;
  if (item.role !== "user" && item.role !== "assistant") return false;
  if (item.role === "assistant" && Array.isArray(item.toolCalls) && item.toolCalls.length > 0) {
    return false;
  }
  return true;
}

/** Keep the latest user prompt + final assistant answer out of compaction. */
function splitPinnedTail(items: unknown[]): { rest: unknown[]; pinned: unknown[] } {
  if (!items.length) return { rest: items, pinned: [] };
  const pinned: unknown[] = [];
  let i = items.length - 1;
  if (isFinalVisibleMessage(items[i])) {
    pinned.unshift(items[i]);
    i -= 1;
    if (i >= 0) {
      const prev = items[i];
      if (isRecord(prev) && prev.role === "user") {
        pinned.unshift(prev);
        i -= 1;
      }
    }
  }
  return { rest: items.slice(0, i + 1), pinned };
}

function shrinkPinned(pinned: unknown[], max: number): unknown[] {
  if (!pinned.length) return pinned;
  if (JSON.stringify(pinned).length <= max) return pinned;
  const last = pinned[pinned.length - 1];
  if (!isRecord(last) || typeof last.content !== "string") return pinned;
  const overhead = JSON.stringify(pinned).length - last.content.length;
  const budget = Math.max(80, max - overhead - 8);
  const next = [...pinned];
  next[next.length - 1] = {
    ...last,
    content: truncateAtBoundary(last.content, budget),
    payload: undefined,
    toolCalls: undefined,
  };
  return next;
}

function dropDispensable(items: unknown[], max: number): unknown[] {
  const next = [...items];
  const predicates: Array<(item: unknown) => boolean> = [
    (item) => isRecord(item) && item.type === "thought",
    (item) => isRecord(item) && item.role === "tool",
    (item) =>
      isRecord(item) &&
      item.role === "assistant" &&
      Array.isArray(item.toolCalls) &&
      item.toolCalls.length > 0,
    (item) =>
      isRecord(item) &&
      typeof item.type === "string" &&
      item.role == null &&
      item.type !== "confirmation" &&
      item.type !== "confirmation_resolved",
  ];
  for (const pred of predicates) {
    while (JSON.stringify(next).length > max && next.length > 1) {
      const index = next.findIndex(pred);
      if (index === -1) break;
      next.splice(index, 1);
    }
  }
  return next;
}

function keepNewestThatFit(items: unknown[], max: number): unknown[] {
  const kept: unknown[] = [];
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const candidate = [items[i], ...kept];
    if (JSON.stringify(candidate).length <= max) kept.unshift(items[i]);
  }
  if (kept.length) return kept;
  const last = items[items.length - 1];
  if (!isRecord(last)) return [];
  const compact: Record<string, unknown> = {
    ...last,
    payload: undefined,
    toolCalls: undefined,
  };
  const originalContent = typeof compact.content === "string" ? compact.content : null;
  const originalDetail = typeof compact.detail === "string" ? compact.detail : null;
  const isTool = compact.role === "tool";
  const contentBudget = isTool ? TOOL_CONTENT_HARD : Math.max(TOOL_CONTENT_HARD, max - 256);
  const cutContent = (text: string, budget: number) =>
    isTool ? truncateString(text, budget) : truncateAtBoundary(text, budget);
  if (originalContent != null) {
    compact.content = cutContent(originalContent, contentBudget);
  }
  if (originalDetail != null) {
    compact.detail = truncateString(originalDetail, TOOL_CONTENT_HARD);
  }
  let json = JSON.stringify([compact]);
  if (json.length <= max) return [compact];
  if (originalContent != null) {
    let budget = Math.floor(contentBudget / 2);
    while (budget >= 80) {
      compact.content = cutContent(originalContent, budget);
      json = JSON.stringify([compact]);
      if (json.length <= max) return [compact];
      budget = Math.floor(budget / 2);
    }
  }
  return [];
}

export function stringifyBounded(value: unknown, max = 16384): string {
  let json = JSON.stringify(value);
  if (json.length <= max) return json;

  if (Array.isArray(value)) {
    const { rest, pinned } = splitPinnedTail(value);
    const attach = (head: unknown[]) => (pinned.length ? [...head, ...pinned] : head);

    const compacted = compactArrayItems(rest);
    json = JSON.stringify(attach(compacted));
    if (json.length <= max) return json;

    const pinnedLen = pinned.length ? JSON.stringify(pinned).length : 0;
    const restMax = Math.max(2, max - pinnedLen);
    const pruned = dropDispensable(compacted, restMax);
    json = JSON.stringify(attach(pruned));
    if (json.length <= max) return json;

    const kept = keepNewestThatFit(pruned, restMax);
    json = JSON.stringify(attach(kept));
    if (json.length <= max) return json;

    if (pinned.length) {
      json = JSON.stringify(shrinkPinned(pinned, max));
      if (json.length <= max) return json;
    }
  } else if (value && typeof value === "object") {
    json = JSON.stringify(compactUnknown(value, max));
    if (json.length <= max) return json;
  }

  return FALLBACK_JSON;
}
