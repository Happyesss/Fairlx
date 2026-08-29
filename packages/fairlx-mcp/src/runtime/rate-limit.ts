import type { RateClass } from "../protocol/types";
import type { AuthContext } from "../auth/context";
import type { McpRuntime } from "./types";

const LIMITS: Record<RateClass, number> = {
  read: 120,
  write: 60,
  destructive: 20,
};

export async function checkMcpRateLimit(
  runtime: McpRuntime,
  auth: AuthContext,
  rateClass: RateClass
): Promise<{ allowed: boolean; remaining: number }> {
  if (!runtime.redis) {
    return { allowed: true, remaining: LIMITS[rateClass] };
  }

  const tokenId = auth.tokenId ?? auth.actorUserId;
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const key = `mcp:rl:${tokenId}:${rateClass}:${minuteBucket}`;

  try {
    const count = await runtime.redis.incr(key);
    if (count === 1) {
      await runtime.redis.expire(key, 120);
    }
    const limit = LIMITS[rateClass];
    if (count > limit) {
      return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: Math.max(0, limit - count) };
  } catch {
    return { allowed: true, remaining: LIMITS[rateClass] };
  }
}
