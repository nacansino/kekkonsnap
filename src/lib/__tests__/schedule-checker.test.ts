import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  all: vi.fn(),
  run: vi.fn(),
};

vi.mock("@/db", () => ({
  db: mockDb,
}));

vi.mock("@/db/schema", () => ({
  events: {
    id: "events.id",
    slug: "events.slug",
    status: "events.status",
    scheduledLockAt: "events.scheduledLockAt",
    lockedAt: "events.lockedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  lte: vi.fn((...args: unknown[]) => ({ type: "lte", args })),
  isNotNull: vi.fn((col: unknown) => ({ type: "isNotNull", col })),
}));

const mockEmitEventChange = vi.fn();
vi.mock("@/lib/event-emitter", () => ({
  emitEventChange: (...args: unknown[]) => mockEmitEventChange(...args),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("schedule-checker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset module to clear lastChecked state
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should auto-lock events past their scheduled time", async () => {
    // Set initial time
    vi.setSystemTime(new Date("2026-03-01T21:31:00Z"));

    // Event is due for locking
    mockDb.all.mockResolvedValueOnce([
      { id: 1, slug: "test-wedding" },
    ]);

    // Import fresh to get clean lastChecked
    const { checkScheduledLocks } = await import("../schedule-checker");

    await checkScheduledLocks();

    // Should have queried for due events
    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.all).toHaveBeenCalled();

    // Should have updated the event
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "locked",
        scheduledLockAt: null,
      })
    );

    // Should have emitted event change
    expect(mockEmitEventChange).toHaveBeenCalledWith({
      slug: "test-wedding",
      type: "status_change",
      status: "locked",
    });
  });

  it("should not run again within 30s debounce window", async () => {
    vi.setSystemTime(new Date("2026-03-01T21:31:00Z"));

    mockDb.all.mockResolvedValue([]);

    const { checkScheduledLocks } = await import("../schedule-checker");

    // First call
    await checkScheduledLocks();
    expect(mockDb.select).toHaveBeenCalledTimes(1);

    // Second call immediately — should be debounced
    await checkScheduledLocks();
    expect(mockDb.select).toHaveBeenCalledTimes(1);

    // Advance past debounce window
    vi.setSystemTime(new Date("2026-03-01T21:31:31Z"));

    await checkScheduledLocks();
    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });

  it("should handle no due events gracefully", async () => {
    vi.setSystemTime(new Date("2026-03-01T21:31:00Z"));

    mockDb.all.mockResolvedValueOnce([]);

    const { checkScheduledLocks } = await import("../schedule-checker");

    await checkScheduledLocks();

    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockEmitEventChange).not.toHaveBeenCalled();
  });

  it("should lock multiple due events", async () => {
    vi.setSystemTime(new Date("2026-03-01T22:00:00Z"));

    mockDb.all.mockResolvedValueOnce([
      { id: 1, slug: "wedding-a" },
      { id: 2, slug: "wedding-b" },
    ]);

    const { checkScheduledLocks } = await import("../schedule-checker");

    await checkScheduledLocks();

    expect(mockDb.update).toHaveBeenCalledTimes(2);
    expect(mockEmitEventChange).toHaveBeenCalledTimes(2);
    expect(mockEmitEventChange).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "wedding-a" })
    );
    expect(mockEmitEventChange).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "wedding-b" })
    );
  });
});
