import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — set up before importing route handlers
// ---------------------------------------------------------------------------

// Mock database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
  execute: vi.fn(),
};

vi.mock("@/db", () => ({
  db: mockDb,
}));

vi.mock("@/db/schema", () => ({
  events: { id: "events.id", slug: "events.slug", status: "events.status", name: "events.name", adminPasswordHash: "events.adminPasswordHash", winnerPhotoId: "events.winnerPhotoId", lockedAt: "events.lockedAt", announcedAt: "events.announcedAt" },
  guests: { id: "guests.id", eventId: "guests.eventId", name: "guests.name", normalizedName: "guests.normalizedName", tableNumber: "guests.tableNumber", createdAt: "guests.createdAt" },
  photos: { id: "photos.id", eventId: "photos.eventId", guestId: "photos.guestId", storagePath: "photos.storagePath", thumbnailPath: "photos.thumbnailPath", mimeType: "photos.mimeType", fileSize: "photos.fileSize", width: "photos.width", height: "photos.height", isWinner: "photos.isWinner", capturedAt: "photos.capturedAt", createdAt: "photos.createdAt" },
  sessions: { id: "sessions.id" },
}));

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  desc: vi.fn((col: unknown) => ({ type: "desc", col })),
  count: vi.fn((col?: unknown) => ({ type: "count", col })),
  sql: vi.fn(),
}));

// Mock admin auth
const mockVerifyPassword = vi.fn();
const mockSignAdminToken = vi.fn();
const mockGetAdminFromCookie = vi.fn();
const mockSetAdminCookie = vi.fn();

vi.mock("@/lib/admin-auth", () => ({
  verifyPassword: (...args: unknown[]) => mockVerifyPassword(...args),
  signAdminToken: (...args: unknown[]) => mockSignAdminToken(...args),
  getAdminFromCookie: (...args: unknown[]) => mockGetAdminFromCookie(...args),
  setAdminCookie: (...args: unknown[]) => mockSetAdminCookie(...args),
}));

// Mock rate-limit
const mockRateLimitByIP = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  rateLimitByIP: (...args: unknown[]) => mockRateLimitByIP(...args),
}));

// Mock event-emitter
const mockEmitEventChange = vi.fn();

vi.mock("@/lib/event-emitter", () => ({
  emitEventChange: (...args: unknown[]) => mockEmitEventChange(...args),
}));

// Mock storage
const mockGetPhotoBuffer = vi.fn();

vi.mock("@/lib/storage", () => ({
  getPhotoBuffer: (...args: unknown[]) => mockGetPhotoBuffer(...args),
  getUploadDir: () => "/tmp/test-uploads",
}));

// Mock archiver
vi.mock("archiver", () => ({
  default: vi.fn(() => ({
    pipe: vi.fn(),
    append: vi.fn(),
    finalize: vi.fn(),
    on: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Helper to create mock NextRequest
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
    "x-forwarded-for": "127.0.0.1",
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

describe("Admin API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limit allows
    mockRateLimitByIP.mockReturnValue({ allowed: true, remaining: 4, resetAt: Date.now() + 60000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Login Route
  // -------------------------------------------------------------------------
  describe("POST /api/admin/[slug]/login", () => {
    it("should return 401 if event not found", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/login/route");

      // Event not found
      mockDb.get.mockResolvedValueOnce(undefined);

      const req = createRequest("/api/admin/test-event/login", {
        method: "POST",
        body: { password: "secret123" },
      });

      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it("should return 401 if password is wrong", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/login/route");

      // Event found
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        name: "Test Wedding",
        slug: "test-event",
        adminPasswordHash: "$2a$10$hashedpassword",
        status: "active",
      });

      mockVerifyPassword.mockResolvedValue(false);

      const req = createRequest("/api/admin/test-event/login", {
        method: "POST",
        body: { password: "wrongpassword" },
      });

      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it("should return 200 and set cookie on correct password", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/login/route");

      mockDb.get.mockResolvedValueOnce({
        id: 1,
        name: "Test Wedding",
        slug: "test-event",
        adminPasswordHash: "$2a$10$hashedpassword",
        status: "active",
      });

      mockVerifyPassword.mockResolvedValue(true);
      mockSignAdminToken.mockResolvedValue("jwt-token-123");

      const req = createRequest("/api/admin/test-event/login", {
        method: "POST",
        body: { password: "correctpassword" },
      });

      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.eventName).toBe("Test Wedding");

      expect(mockSignAdminToken).toHaveBeenCalledWith({ eventId: 1 });
      expect(mockSetAdminCookie).toHaveBeenCalled();
    });

    it("should return 429 when rate limited", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/login/route");

      mockRateLimitByIP.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 30000 });

      const req = createRequest("/api/admin/test-event/login", {
        method: "POST",
        body: { password: "any" },
      });

      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(429);
    });

    it("should return 400 if password missing from body", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/login/route");

      const req = createRequest("/api/admin/test-event/login", {
        method: "POST",
        body: {},
      });

      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Photos Route
  // -------------------------------------------------------------------------
  describe("GET /api/admin/[slug]/photos", () => {
    it("should return 401 if not authenticated", async () => {
      const { GET } = await import("@/app/api/admin/[slug]/photos/route");

      mockGetAdminFromCookie.mockResolvedValue(null);

      const req = createRequest("/api/admin/test-event/photos");
      const res = await GET(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(401);
    });

    it("should return photos with guest attribution", async () => {
      const { GET } = await import("@/app/api/admin/[slug]/photos/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      // Event lookup
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        slug: "test-event",
        status: "active",
      });

      // Photos query
      mockDb.all.mockResolvedValueOnce([
        {
          photo: {
            id: 10,
            thumbnailPath: "evt-1/thumb/10.webp",
            storagePath: "evt-1/full/10.webp",
            isWinner: false,
            capturedAt: new Date("2025-06-01T12:00:00Z"),
            fileSize: 50000,
            guestId: 2,
          },
          guest: {
            name: "Alice",
            id: 2,
          },
        },
      ]);

      const req = createRequest("/api/admin/test-event/photos");
      const res = await GET(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.photos).toHaveLength(1);
      expect(data.photos[0].guestName).toBe("Alice");
      expect(data.photos[0].id).toBe(10);
    });

    it("should return 404 if event not found or wrong event", async () => {
      const { GET } = await import("@/app/api/admin/[slug]/photos/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      // Event not found
      mockDb.get.mockResolvedValueOnce(undefined);

      const req = createRequest("/api/admin/other-event/photos");
      const res = await GET(req, { params: Promise.resolve({ slug: "other-event" }) });
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Lock Event Route
  // -------------------------------------------------------------------------
  describe("POST /api/admin/[slug]/lock", () => {
    it("should return 401 if not authenticated", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/lock/route");

      mockGetAdminFromCookie.mockResolvedValue(null);

      const req = createRequest("/api/admin/test-event/lock", { method: "POST" });
      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(401);
    });

    it("should lock an active event", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/lock/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      // Event lookup
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        slug: "test-event",
        status: "active",
      });

      // Update succeeds
      mockDb.run.mockResolvedValueOnce(undefined);

      const req = createRequest("/api/admin/test-event/lock", { method: "POST" });
      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);

      expect(mockEmitEventChange).toHaveBeenCalledWith({
        slug: "test-event",
        type: "status_change",
        status: "locked",
      });
    });

    it("should return 409 if event is not active", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/lock/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      mockDb.get.mockResolvedValueOnce({
        id: 1,
        slug: "test-event",
        status: "locked", // Already locked
      });

      const req = createRequest("/api/admin/test-event/lock", { method: "POST" });
      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(409);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Pick Winner Route
  // -------------------------------------------------------------------------
  describe("POST /api/admin/[slug]/pick-winner", () => {
    it("should return 401 if not authenticated", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/pick-winner/route");

      mockGetAdminFromCookie.mockResolvedValue(null);

      const req = createRequest("/api/admin/test-event/pick-winner", {
        method: "POST",
        body: { photoId: 5 },
      });

      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(401);
    });

    it("should pick a winner when event is locked", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/pick-winner/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      // Event lookup
      mockDb.get
        .mockResolvedValueOnce({
          id: 1,
          slug: "test-event",
          status: "locked",
        })
        // Photo lookup
        .mockResolvedValueOnce({
          id: 5,
          eventId: 1,
          guestId: 2,
        });

      // Clear previous winners
      mockDb.run.mockResolvedValueOnce(undefined);
      // Set new winner
      mockDb.run.mockResolvedValueOnce(undefined);
      // Update event winnerPhotoId
      mockDb.run.mockResolvedValueOnce(undefined);

      const req = createRequest("/api/admin/test-event/pick-winner", {
        method: "POST",
        body: { photoId: 5 },
      });

      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.photoId).toBe(5);
    });

    it("should return 409 if event is not locked", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/pick-winner/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      mockDb.get.mockResolvedValueOnce({
        id: 1,
        slug: "test-event",
        status: "active", // Not locked
      });

      const req = createRequest("/api/admin/test-event/pick-winner", {
        method: "POST",
        body: { photoId: 5 },
      });

      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(409);
    });

    it("should return 404 if photo does not belong to event", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/pick-winner/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      // Event found
      mockDb.get
        .mockResolvedValueOnce({
          id: 1,
          slug: "test-event",
          status: "locked",
        })
        // Photo not found
        .mockResolvedValueOnce(undefined);

      const req = createRequest("/api/admin/test-event/pick-winner", {
        method: "POST",
        body: { photoId: 999 },
      });

      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(404);
    });

    it("should return 400 if photoId missing", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/pick-winner/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      const req = createRequest("/api/admin/test-event/pick-winner", {
        method: "POST",
        body: {},
      });

      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Announce Winner Route
  // -------------------------------------------------------------------------
  describe("POST /api/admin/[slug]/announce", () => {
    it("should return 401 if not authenticated", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/announce/route");

      mockGetAdminFromCookie.mockResolvedValue(null);

      const req = createRequest("/api/admin/test-event/announce", { method: "POST" });
      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(401);
    });

    it("should announce winner when event is locked with winner", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/announce/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      // Event lookup
      mockDb.get
        .mockResolvedValueOnce({
          id: 1,
          slug: "test-event",
          status: "locked",
          winnerPhotoId: 5,
        })
        // Winner photo + guest lookup
        .mockResolvedValueOnce({
          photo: {
            id: 5,
            storagePath: "evt-1/full/5.webp",
          },
          guest: {
            name: "Alice",
          },
        });

      // Update event status
      mockDb.run.mockResolvedValueOnce(undefined);

      const req = createRequest("/api/admin/test-event/announce", { method: "POST" });
      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);

      expect(mockEmitEventChange).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "test-event",
          type: "winner_announced",
          status: "announced",
          winnerPhotoId: 5,
          winnerGuestName: "Alice",
        })
      );
    });

    it("should return 409 if event is not locked", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/announce/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      mockDb.get.mockResolvedValueOnce({
        id: 1,
        slug: "test-event",
        status: "active",
        winnerPhotoId: null,
      });

      const req = createRequest("/api/admin/test-event/announce", { method: "POST" });
      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(409);
    });

    it("should return 409 if no winner selected", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/announce/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      mockDb.get.mockResolvedValueOnce({
        id: 1,
        slug: "test-event",
        status: "locked",
        winnerPhotoId: null, // No winner
      });

      const req = createRequest("/api/admin/test-event/announce", { method: "POST" });
      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(409);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Download Single Photo Route
  // -------------------------------------------------------------------------
  describe("GET /api/admin/[slug]/download/[photoId]", () => {
    it("should return 401 if not authenticated", async () => {
      const { GET } = await import("@/app/api/admin/[slug]/download/[photoId]/route");

      mockGetAdminFromCookie.mockResolvedValue(null);

      const req = createRequest("/api/admin/test-event/download/10");
      const res = await GET(req, {
        params: Promise.resolve({ slug: "test-event", photoId: "10" }),
      });
      expect(res.status).toBe(401);
    });

    it("should return photo as downloadable file", async () => {
      const { GET } = await import("@/app/api/admin/[slug]/download/[photoId]/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      // Event lookup
      mockDb.get
        .mockResolvedValueOnce({
          id: 1,
          slug: "test-event",
        })
        // Photo lookup
        .mockResolvedValueOnce({
          id: 10,
          eventId: 1,
          storagePath: "evt-1/full/10.webp",
          mimeType: "image/webp",
          originalFilename: "photo.jpg",
        });

      const fakeBuffer = Buffer.from("fake-photo-data");
      mockGetPhotoBuffer.mockResolvedValue(fakeBuffer);

      const req = createRequest("/api/admin/test-event/download/10");
      const res = await GET(req, {
        params: Promise.resolve({ slug: "test-event", photoId: "10" }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Disposition")).toContain("attachment");
      expect(res.headers.get("Content-Type")).toBe("image/webp");
    });

    it("should return 404 if photo not found or wrong event", async () => {
      const { GET } = await import("@/app/api/admin/[slug]/download/[photoId]/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      // Event found
      mockDb.get
        .mockResolvedValueOnce({
          id: 1,
          slug: "test-event",
        })
        // Photo not found
        .mockResolvedValueOnce(undefined);

      const req = createRequest("/api/admin/test-event/download/999");
      const res = await GET(req, {
        params: Promise.resolve({ slug: "test-event", photoId: "999" }),
      });
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Download All (ZIP) Route
  // -------------------------------------------------------------------------
  describe("GET /api/admin/[slug]/download (ZIP)", () => {
    it("should return 401 if not authenticated", async () => {
      const { GET } = await import("@/app/api/admin/[slug]/download/route");

      mockGetAdminFromCookie.mockResolvedValue(null);

      const req = createRequest("/api/admin/test-event/download");
      const res = await GET(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(401);
    });

    it("should return ZIP content type with correct headers", async () => {
      const { GET } = await import("@/app/api/admin/[slug]/download/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      // Event lookup
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        slug: "test-event",
        name: "Test Wedding",
      });

      // Photos query
      mockDb.all.mockResolvedValueOnce([]);

      const req = createRequest("/api/admin/test-event/download");
      const res = await GET(req, { params: Promise.resolve({ slug: "test-event" }) });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/zip");
      expect(res.headers.get("Content-Disposition")).toContain("attachment");
    });
  });

  // -------------------------------------------------------------------------
  // 8. Guests Route
  // -------------------------------------------------------------------------
  describe("GET /api/admin/[slug]/guests", () => {
    it("should return 401 if not authenticated", async () => {
      const { GET } = await import("@/app/api/admin/[slug]/guests/route");

      mockGetAdminFromCookie.mockResolvedValue(null);

      const req = createRequest("/api/admin/test-event/guests");
      const res = await GET(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(401);
    });

    it("should return list of guests with photo counts", async () => {
      const { GET } = await import("@/app/api/admin/[slug]/guests/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      // Event lookup
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        slug: "test-event",
      });

      // Guests query
      mockDb.all.mockResolvedValueOnce([
        { id: 1, name: "Alice", tableNumber: "1", photoCount: 3 },
        { id: 2, name: "Bob", tableNumber: "2", photoCount: 0 },
      ]);

      const req = createRequest("/api/admin/test-event/guests");
      const res = await GET(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.guests).toHaveLength(2);
    });
  });

  describe("POST /api/admin/[slug]/guests", () => {
    it("should return 401 if not authenticated", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/guests/route");

      mockGetAdminFromCookie.mockResolvedValue(null);

      const req = createRequest("/api/admin/test-event/guests", {
        method: "POST",
        body: { guests: [{ name: "Alice" }] },
      });

      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(401);
    });

    it("should import guests and return count", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/guests/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      // Event lookup
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        slug: "test-event",
      });

      // Insert succeeds
      mockDb.run.mockResolvedValue(undefined);

      const req = createRequest("/api/admin/test-event/guests", {
        method: "POST",
        body: {
          guests: [
            { name: "Alice", tableNumber: "1" },
            { name: "Bob" },
          ],
        },
      });

      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.imported).toBe(2);
    });

    it("should return 400 if guests array is missing", async () => {
      const { POST } = await import("@/app/api/admin/[slug]/guests/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      // Event lookup
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        slug: "test-event",
      });

      const req = createRequest("/api/admin/test-event/guests", {
        method: "POST",
        body: {},
      });

      const res = await POST(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // 9. Stats Route
  // -------------------------------------------------------------------------
  describe("GET /api/admin/[slug]/stats", () => {
    it("should return 401 if not authenticated", async () => {
      const { GET } = await import("@/app/api/admin/[slug]/stats/route");

      mockGetAdminFromCookie.mockResolvedValue(null);

      const req = createRequest("/api/admin/test-event/stats");
      const res = await GET(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(401);
    });

    it("should return event statistics", async () => {
      const { GET } = await import("@/app/api/admin/[slug]/stats/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      // Event lookup
      mockDb.get
        .mockResolvedValueOnce({
          id: 1,
          slug: "test-event",
          status: "active",
        })
        // Total photos count
        .mockResolvedValueOnce({ count: 15 })
        // Total guests count
        .mockResolvedValueOnce({ count: 10 })
        // Participating guests count (with at least 1 photo)
        .mockResolvedValueOnce({ count: 5 });

      const req = createRequest("/api/admin/test-event/stats");
      const res = await GET(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.totalPhotos).toBe(15);
      expect(data.totalGuests).toBe(10);
      expect(data.participatingGuests).toBe(5);
      expect(data.photosPerGuest).toBeCloseTo(3); // 15 / 5
      expect(data.eventStatus).toBe("active");
    });

    it("should handle zero participating guests for avg calculation", async () => {
      const { GET } = await import("@/app/api/admin/[slug]/stats/route");

      mockGetAdminFromCookie.mockResolvedValue({ eventId: 1 });

      mockDb.get
        .mockResolvedValueOnce({
          id: 1,
          slug: "test-event",
          status: "active",
        })
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 5 })
        .mockResolvedValueOnce({ count: 0 });

      const req = createRequest("/api/admin/test-event/stats");
      const res = await GET(req, { params: Promise.resolve({ slug: "test-event" }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.photosPerGuest).toBe(0);
    });
  });
});
