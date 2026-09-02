export function nowIso(clock: () => number = Date.now): string {
  return new Date(clock()).toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}

export function slugify(value: string, fallback = "task"): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || fallback;
}

export function emptyUsage(modelId: string) {
  return { inputTokens: 0, outputTokens: 0, modelId, costUsd: 0 };
}

export function addUsage<T extends { inputTokens: number; outputTokens: number; costUsd: number }>(
  a: T,
  b: { inputTokens: number; outputTokens: number; costUsd: number },
): T {
  a.inputTokens += b.inputTokens;
  a.outputTokens += b.outputTokens;
  a.costUsd += b.costUsd;
  return a;
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

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

export function parseObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return { raw };
    }
  }
  return {};
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function titleFromPrompt(prompt: string): string {
  return truncate(prompt.replace(/\s+/g, " ").trim(), 80) || "Autonomous run";
}
