import "server-only";
import { getRedisClient } from "./client";

/**
 * Cache-Aside Layer with Stampede Protection
 * 
 * PATTERN: Check Redis → if HIT, return. If MISS, call fetcher → store → return.
 * SAFETY: If Redis is down, falls through to fetcher silently. App never breaks.
 * STAMPEDE: In-flight map prevents duplicate concurrent fetches for same key.
 */

// In-flight request deduplication (prevents cache stampede within same process)
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Cache-aside with stampede protection.
 * 
 * 1. Check Redis → return if HIT
 * 2. Check in-flight map → return existing promise if another request is already fetching
 * 3. MISS → call fetcher, store in Redis, return
 * 
 * If Redis is down, falls through to fetcher silently. App never breaks.
 */
export async function cached<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 300
): Promise<T> {
    const redis = getRedisClient();

    // No Redis → just call fetcher directly
    if (!redis) return fetcher();

    // 1. Try Redis cache
    try {
        const hit = await redis.get(key);
        if (hit !== null) {
            return JSON.parse(hit) as T;
        }
    } catch {
        // Redis down — fall through to fetcher
    }

    // 2. Stampede protection: if another request is already fetching this key, wait for it
    const existing = inFlight.get(key);
    if (existing) {
        return existing as Promise<T>;
    }

    // 3. Cache miss — fetch from source
    const promise = fetcher().then(async (data) => {
        // Store in Redis (fire-and-forget with jitter to prevent synchronized expiry)
        const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(ttlSeconds * 0.1)));
        try {
            await redis.setex(key, ttlSeconds + jitter, JSON.stringify(data));
        } catch {
            // Redis down — ignore, data still returned
        }
        return data;
    }).finally(() => {
        inFlight.delete(key);
    });

    inFlight.set(key, promise);
    return promise;
}

/**
 * Cache a simple counter (number) using Redis GET/SET.
 * More efficient than cached() for single integer values.
 */
export async function cachedCounter(
    key: string,
    fetcher: () => Promise<number>,
    ttlSeconds: number = 120
): Promise<number> {
    const redis = getRedisClient();
    if (!redis) return fetcher();
    try {
        const val = await redis.get(key);
        if (val !== null) return parseInt(val, 10);
    } catch { /* fall through */ }

    const count = await fetcher();
    try {
        const pipeline = redis.pipeline();
        pipeline.set(key, count.toString());
        pipeline.expire(key, ttlSeconds);
        await pipeline.exec();
    } catch { /* ignore */ }

    return count;
}

/**
 * Increment a cached counter (e.g., after adding a comment)
 * Returns new count or -1 if key doesn't exist in cache
 */
export async function incrementCounter(key: string, by: number = 1): Promise<number> {
    const redis = getRedisClient();
    if (!redis) return -1;
    try {
        const exists = await redis.exists(key);
        if (exists) {
            return redis.incrby(key, by);
        }
    } catch { /* ignore */ }
    return -1;
}

/**
 * Decrement a cached counter (e.g., after deleting a comment)
 * Returns new count or -1 if key doesn't exist in cache
 */
export async function decrementCounter(key: string, by: number = 1): Promise<number> {
    const redis = getRedisClient();
    if (!redis) return -1;
    try {
        const exists = await redis.exists(key);
        if (exists) {
            return redis.decrby(key, by);
        }
    } catch { /* ignore */ }
    return -1;
}

/**
 * Invalidate exact cache keys
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const redis = getRedisClient();
    if (!redis) return;
    try {
        await redis.del(...keys);
    } catch { /* Redis down — TTL will handle it */ }
}

/**
 * Invalidate all keys matching a pattern (e.g., "perm:project:abc123:*")
 * Uses SCAN (non-blocking) — safe for production
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;
    try {
        let cursor = "0";
        do {
            const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 200);
            cursor = nextCursor;
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } while (cursor !== "0");
    } catch { /* Redis down — ignore */ }
}

/**
 * Store a value only if it doesn't already exist (for idempotency)
 * Returns true if set, false if already exists
 */
export async function setIfNotExists(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const redis = getRedisClient();
    // When Redis is unavailable, return true (allow the write through).
    // The DB-level idempotency check (findByIdempotencyKey) in usage-ledger.ts
    // will catch true duplicates. Returning false here incorrectly blocks ALL events.
    if (!redis) return true;
    try {
        const result = await redis.set(key, value, "EX", ttlSeconds, "NX");
        return result === "OK";
    } catch {
        // Redis error — fail open (allow write, rely on DB check)
        return true;
    }
}

/**
 * Get cache stats for monitoring
 */
export async function getCacheStats(): Promise<{
    hitRate: string;
    totalKeys: number;
    memoryUsed: string;
    uptimeSeconds: number;
}> {
    const redis = getRedisClient();
    if (!redis) {
        return { hitRate: "N/A (Redis not configured)", totalKeys: 0, memoryUsed: "N/A", uptimeSeconds: 0 };
    }
    try {
        const [stats, memory, keyCount, server] = await Promise.all([
            redis.info("stats"),
            redis.info("memory"),
            redis.dbsize(),
            redis.info("server"),
        ]);

        const hits = parseInt(stats.match(/keyspace_hits:(\d+)/)?.[1] || "0");
        const misses = parseInt(stats.match(/keyspace_misses:(\d+)/)?.[1] || "0");
        const hitRate = hits + misses > 0 
            ? `${(hits / (hits + misses) * 100).toFixed(1)}%` 
            : "N/A";
        const memoryUsed = memory.match(/used_memory_human:(.*)/)?.[1]?.trim() || "unknown";
        const uptimeSeconds = parseInt(server.match(/uptime_in_seconds:(\d+)/)?.[1] || "0");

        return { hitRate, totalKeys: keyCount, memoryUsed, uptimeSeconds };
    } catch {
        return { hitRate: "N/A (Redis unavailable)", totalKeys: 0, memoryUsed: "N/A", uptimeSeconds: 0 };
    }
}
