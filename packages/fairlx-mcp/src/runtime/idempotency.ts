import type { McpRuntime } from "./types";

export async function withIdempotency<T>(
  runtime: McpRuntime,
  idempotencyKey: string | undefined,
  tool: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!idempotencyKey) {
    return fn();
  }
  const eventKey = `mcp:${tool}:${idempotencyKey}`;
  const existing = await runtime.getIdempotencyResult(eventKey);
  if (existing !== null && existing !== undefined) {
    return existing as T;
  }
  const locked = await runtime.acquireIdempotencyLock(eventKey, { tool });
  if (!locked) {
    const again = await runtime.getIdempotencyResult(eventKey);
    if (again !== null && again !== undefined) {
      return again as T;
    }
    throw new Error("Idempotency lock held for this key; retry shortly");
  }
  const result = await fn();
  await runtime.recordIdempotency(eventKey, result);
  return result;
}
