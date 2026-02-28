import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  get: vi.fn(),
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
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
}));

const mockGetAdminFromCookie = vi.fn();

vi.mock("@/lib/admin-auth", () => ({
  getAdminFromCookie: (...args: unknown[]) => mockGetAdminFromCookie(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createRequest(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
): NextRequest {
  const fullUrl = `http://localhost:3000${url}`;
  const headers = new Headers({
    "Content-Type": "application/json",
    ...(options?.headers ?? {}),
  });
  const init: { method: string; headers: Headers; body?: string } = {
    method: options?.method ?? "GET",
    headers,
  };
  if (options?.body) {
    init.body = JSON.stringify(options.body);
  }
  return new NextRequest(fullUrl, init);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/admin/[slug]/schedule-lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T20:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should return 401 if not authenticated", async () => {
    const { POST } = await import("@/app/api/admin/[slug]/schedule-lock/route");

    mockGetAdminFromCookie.mockResolvedValueOnce(null);

    const req = createRequest("/api/admin/test-event/schedule-lock", {
      method: "POST",
      body: { lockAt: "2026-03-01T21:00:00Z" },
    });

    const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
    expect(res.status).toBe(401);
  });

  it("should return 404 if event not found", async () => {
    const { POST } = await import("@/app/api/admin/[slug]/schedule-lock/route");

    mockGetAdminFromCookie.mockResolvedValueOnce({ eventId: 1, role: "admin" });
    mockDb.get.mockResolvedValueOnce(undefined);

    const req = createRequest("/api/admin/test-event/schedule-lock", {
      method: "POST",
      body: { lockAt: "2026-03-01T21:00:00Z" },
    });

    const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
    expect(res.status).toBe(404);
  });

  it("should schedule a lock time for an active event", async () => {
    const { POST } = await import("@/app/api/admin/[slug]/schedule-lock/route");

    mockGetAdminFromCookie.mockResolvedValueOnce({ eventId: 1, role: "admin" });
    mockDb.get.mockResolvedValueOnce({
      id: 1,
      slug: "test-event",
      status: "active",
    });

    const futureTime = "2026-03-01T21:30:00Z";
    const req = createRequest("/api/admin/test-event/schedule-lock", {
      method: "POST",
      body: { lockAt: futureTime },
    });

    const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.scheduledLockAt).toBe(new Date(futureTime).toISOString());

    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledLockAt: new Date(futureTime),
      })
    );
  });

  it("should reject scheduling for non-active events", async () => {
    const { POST } = await import("@/app/api/admin/[slug]/schedule-lock/route");

    mockGetAdminFromCookie.mockResolvedValueOnce({ eventId: 1, role: "admin" });
    mockDb.get.mockResolvedValueOnce({
      id: 1,
      slug: "test-event",
      status: "locked",
    });

    const req = createRequest("/api/admin/test-event/schedule-lock", {
      method: "POST",
      body: { lockAt: "2026-03-01T21:30:00Z" },
    });

    const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("active");
  });

  it("should reject past timestamps", async () => {
    const { POST } = await import("@/app/api/admin/[slug]/schedule-lock/route");

    mockGetAdminFromCookie.mockResolvedValueOnce({ eventId: 1, role: "admin" });
    mockDb.get.mockResolvedValueOnce({
      id: 1,
      slug: "test-event",
      status: "active",
    });

    const req = createRequest("/api/admin/test-event/schedule-lock", {
      method: "POST",
      body: { lockAt: "2026-03-01T19:00:00Z" }, // 1 hour in the past
    });

    const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("future");
  });

  it("should reject invalid date formats", async () => {
    const { POST } = await import("@/app/api/admin/[slug]/schedule-lock/route");

    mockGetAdminFromCookie.mockResolvedValueOnce({ eventId: 1, role: "admin" });
    mockDb.get.mockResolvedValueOnce({
      id: 1,
      slug: "test-event",
      status: "active",
    });

    const req = createRequest("/api/admin/test-event/schedule-lock", {
      method: "POST",
      body: { lockAt: "not-a-date" },
    });

    const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("Invalid");
  });

  it("should clear a scheduled lock when lockAt is null", async () => {
    const { POST } = await import("@/app/api/admin/[slug]/schedule-lock/route");

    mockGetAdminFromCookie.mockResolvedValueOnce({ eventId: 1, role: "admin" });
    mockDb.get.mockResolvedValueOnce({
      id: 1,
      slug: "test-event",
      status: "active",
      scheduledLockAt: new Date("2026-03-01T21:30:00Z"),
    });

    const req = createRequest("/api/admin/test-event/schedule-lock", {
      method: "POST",
      body: { lockAt: null },
    });

    const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.scheduledLockAt).toBeNull();

    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledLockAt: null })
    );
  });
});
