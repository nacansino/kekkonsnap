import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Import will be done dynamically to allow fresh state per test
let rateLimit: typeof import("@/lib/rate-limit").rateLimit;
let _resetRateLimitStore: typeof import("@/lib/rate-limit")._resetRateLimitStore;

describe("Rate limiter (src/lib/rate-limit.ts)", () => {
  beforeEach(async () => {
    const mod = await import("@/lib/rate-limit");
    rateLimit = mod.rateLimit;
    _resetRateLimitStore = mod._resetRateLimitStore;
    // Clear state between tests
    _resetRateLimitStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests within the limit", () => {
    const limit = 5;
    const windowMs = 60_000;

    for (let i = 0; i < limit; i++) {
      const result = rateLimit("test-key", limit, windowMs);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(limit - i - 1);
    }
  });

  it("blocks requests that exceed the limit", () => {
    const limit = 3;
    const windowMs = 60_000;

    // Use up all allowed requests
    for (let i = 0; i < limit; i++) {
      const result = rateLimit("block-key", limit, windowMs);
      expect(result.allowed).toBe(true);
    }

    // Next request should be blocked
    const blocked = rateLimit("block-key", limit, windowMs);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("returns correct remaining count", () => {
    const limit = 5;
    const windowMs = 60_000;

    const r1 = rateLimit("remain-key", limit, windowMs);
    expect(r1.remaining).toBe(4);

    const r2 = rateLimit("remain-key", limit, windowMs);
    expect(r2.remaining).toBe(3);

    const r3 = rateLimit("remain-key", limit, windowMs);
    expect(r3.remaining).toBe(2);
  });

  it("provides a resetAt timestamp in the future", () => {
    const windowMs = 60_000;
    const now = Date.now();
    const result = rateLimit("reset-key", 5, windowMs);

    expect(result.resetAt).toBeGreaterThanOrEqual(now);
    expect(result.resetAt).toBeLessThanOrEqual(now + windowMs + 100);
  });

  it("resets after the window expires", () => {
    vi.useFakeTimers();
    const limit = 2;
    const windowMs = 10_000; // 10 seconds

    // Exhaust the limit
    rateLimit("expire-key", limit, windowMs);
    rateLimit("expire-key", limit, windowMs);

    const blocked = rateLimit("expire-key", limit, windowMs);
    expect(blocked.allowed).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(windowMs + 1);

    // Should be allowed again
    const afterReset = rateLimit("expire-key", limit, windowMs);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(limit - 1);
  });

  it("tracks different keys independently", () => {
    const limit = 1;
    const windowMs = 60_000;

    const r1 = rateLimit("key-a", limit, windowMs);
    expect(r1.allowed).toBe(true);

    const r2 = rateLimit("key-b", limit, windowMs);
    expect(r2.allowed).toBe(true);

    // key-a is now exhausted
    const r3 = rateLimit("key-a", limit, windowMs);
    expect(r3.allowed).toBe(false);

    // key-b is also exhausted
    const r4 = rateLimit("key-b", limit, windowMs);
    expect(r4.allowed).toBe(false);

    // key-c is fresh and should be allowed
    const r5 = rateLimit("key-c", limit, windowMs);
    expect(r5.allowed).toBe(true);
  });

  it("uses sliding window - old entries expire individually", () => {
    vi.useFakeTimers();
    const limit = 3;
    const windowMs = 10_000;

    // Make request at t=0
    rateLimit("slide-key", limit, windowMs);

    // Make request at t=3s
    vi.advanceTimersByTime(3_000);
    rateLimit("slide-key", limit, windowMs);

    // Make request at t=6s
    vi.advanceTimersByTime(3_000);
    rateLimit("slide-key", limit, windowMs);

    // At t=6s, all 3 used, should be blocked
    const blocked = rateLimit("slide-key", limit, windowMs);
    expect(blocked.allowed).toBe(false);

    // Advance to t=10.001s - the first request (t=0) should have expired
    vi.advanceTimersByTime(4_001);
    const afterPartialExpiry = rateLimit("slide-key", limit, windowMs);
    expect(afterPartialExpiry.allowed).toBe(true);
  });

  it("blocked request returns remaining as 0", () => {
    const limit = 1;
    const windowMs = 60_000;

    rateLimit("zero-key", limit, windowMs);
    const blocked = rateLimit("zero-key", limit, windowMs);

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });
});
