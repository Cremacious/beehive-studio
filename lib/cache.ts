import { Redis } from '@upstash/redis'

// Cross-request cache backed by Upstash Redis. Issue #37 (performance).
//
// This is the cross-request sibling to React `cache()` (which only dedupes
// within a single request). Use it to cache heavy READ aggregators whose
// inputs are stable for a short window and where a few seconds of staleness
// is invisible to correctness (community dashboard, profile stats, studio
// stats, trending). Do NOT use it for anything that must be real-time:
// editor saves, notifications, like/bookmark counts, the friends-desk cursor
// feed.
//
// Mirrors lib/rate-limit.ts: when Upstash isn't configured the wrapper is a
// transparent no-op that just calls fn(). Any Redis read/write error also
// falls through to fn() so the cache can never break a request.
//
// SERIALIZATION: @upstash/redis JSON-serializes values. Only cache JSON-safe
// payloads (string / number / boolean / null + nested arrays/objects). Do NOT
// cache values containing Date, Map, or Set instances. A Date round-trips to a
// string on a cache hit, which would silently change behavior for any consumer
// that calls Date methods. Cache at a boundary where the payload is already
// plain data (pre-formatted strings, raw counts), not raw row objects.

const upstashConfigured =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN

const redis = upstashConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

/**
 * Cache the result of `fn()` in Upstash Redis under `key` for `ttlSeconds`.
 *
 * No-ops to `fn()` when Upstash is unconfigured or on any Redis error.
 *
 * Note: a cached value of `null`/`undefined` is treated as a miss and
 * recomputed on the next call. Cache at the object level so legitimately-empty
 * results still cache (return `{ ... }`, not bare `null`).
 */
export async function cachedAction<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number,
): Promise<T> {
  if (!redis) return fn()

  try {
    const hit = await redis.get<T>(key)
    if (hit !== null && hit !== undefined) return hit
  } catch (e) {
    console.error(`[cache] get failed for ${key}:`, e)
    return fn()
  }

  const fresh = await fn()

  try {
    await redis.set(key, fresh, { ex: ttlSeconds })
  } catch (e) {
    console.error(`[cache] set failed for ${key}:`, e)
  }

  return fresh
}

/**
 * Best-effort cache busting. Call after a mutation that must immediately
 * reflect on a cached read. No-op when Upstash is unconfigured.
 *
 * The #37 first pass relies on short TTLs rather than write-path invalidation
 * (the cached surfaces are feeds/overviews where sub-minute staleness is
 * acceptable). This helper exists for surfaces that later need precise busting.
 */
export async function invalidateCache(key: string): Promise<void> {
  if (!redis) return
  try {
    await redis.del(key)
  } catch (e) {
    console.error(`[cache] del failed for ${key}:`, e)
  }
}
