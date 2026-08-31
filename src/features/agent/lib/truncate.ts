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

export function stringifyBounded(value: unknown, max = 16384): string {
  let json = JSON.stringify(value);
  if (json.length <= max) return json;

  if (Array.isArray(value)) {
    const next = [...value];
    while (next.length > 1 && JSON.stringify(next).length > max) {
      next.shift();
    }
    json = JSON.stringify(next);
    if (json.length <= max) return json;
    if (next.length === 1) {
      const item = next[0];
      if (item && typeof item === "object") {
        const compact = {
          ...item,
          content: typeof (item as { content?: unknown }).content === "string"
            ? truncateString((item as { content: string }).content, 400)
            : (item as { content?: unknown }).content,
          detail: typeof (item as { detail?: unknown }).detail === "string"
            ? truncateString((item as { detail: string }).detail, 400)
            : (item as { detail?: unknown }).detail,
          payload: undefined,
        };
        json = JSON.stringify([compact]);
        if (json.length <= max) return json;
      }
    }
  }

  return json.slice(0, max);
}
