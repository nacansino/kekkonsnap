import { NextRequest } from "next/server";

/**
 * In-memory sliding window rate limiter.
 *
 * Each key maps to an array of timestamps representing when requests were made.
 * On each call, timestamps outside the current window are pruned first.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup interval reference (kept for cleanup)
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

const CLEANUP_INTERVAL_MS = 60_000;

function startCleanupIfNeeded(): void {
  if (cleanupInterval !== null) return;
  // Only start in non-test environments to avoid open handles
  if (typeof globalThis !== "undefined" && process.env.NODE_ENV === "test") return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      // Remove entries where all timestamps are expired
      // Use the largest possible window (we don't know it, so keep entries
      // that have any timestamp in the last 5 minutes as a conservative bound)
      const recentThreshold = now - 5 * 60 * 1000;
      entry.timestamps = entry.timestamps.filter((t) => t > recentThreshold);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  // Allow the process to exit even if the interval is running
  if (cleanupInterval && typeof cleanupInterval === "object" && "unref" in cleanupInterval) {
    cleanupInterval.unref();
  }
}

/**
 * Sliding window rate limiter.
 *
 * @param key - Unique identifier for the rate limit bucket (e.g., IP + route)
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Window duration in milliseconds
 * @returns Object with allowed, remaining count, and resetAt timestamp
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  startCleanupIfNeeded();

  const now = Date.now();
  const windowStart = now - windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Prune timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  const currentCount = entry.timestamps.length;

  if (currentCount >= limit) {
    // Blocked: find when the oldest timestamp in the window will expire
    const oldestInWindow = entry.timestamps[0];
    const resetAt = oldestInWindow + windowMs;
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  // Allowed: record this request
  entry.timestamps.push(now);

  const remaining = limit - entry.timestamps.length;
  // resetAt is when the earliest current timestamp will expire
  const resetAt = entry.timestamps[0] + windowMs;

  return {
    allowed: true,
    remaining,
    resetAt,
  };
}

/**
 * Convenience helper to rate limit by the request's IP address.
 *
 * @param request - NextRequest object
 * @param name - A name for this rate limit bucket (e.g., "photo-upload")
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Window duration in milliseconds
 */
export function rateLimitByIP(
  request: NextRequest,
  name: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() ?? realIp ?? "unknown";
  const key = `${name}:${ip}`;
  return rateLimit(key, limit, windowMs);
}

/**
 * Reset the rate limit store. Exposed for testing only.
 */
export function _resetRateLimitStore(): void {
  store.clear();
}
