import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock modules BEFORE importing route handlers
// ---------------------------------------------------------------------------

// Mock database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  get: vi.fn(),
  all: vi.fn(),
  execute: vi.fn(),
};

vi.mock("@/db", () => ({
  db: mockDb,
}));

vi.mock("@/db/schema", () => ({
  events: { id: "events.id", slug: "events.slug", status: "events.status" },
  guests: { id: "guests.id", eventId: "guests.eventId" },
  sessions: {
    id: "sessions.id",
    eventId: "sessions.eventId",
    guestId: "sessions.guestId",
    agreedToTerms: "sessions.agreedToTerms",
  },
  photos: {
    id: "photos.id",
    eventId: "photos.eventId",
    guestId: "photos.guestId",
    sessionId: "photos.sessionId",
    isWinner: "photos.isWinner",
  },
}));

// Mock drizzle-orm eq/and operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ _type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ _type: "and", args })),
  count: vi.fn(() => ({ _type: "count" })),
  sql: vi.fn(),
}));

// Mock auth
const mockSignSessionToken = vi.fn().mockResolvedValue("mock-jwt-token");
const mockGetSessionFromCookie = vi.fn().mockResolvedValue(null);
const mockSetSessionCookie = vi.fn();

vi.mock("@/lib/auth", () => ({
  signSessionToken: mockSignSessionToken,
  verifySessionToken: vi.fn(),
  getSessionFromCookie: mockGetSessionFromCookie,
  setSessionCookie: mockSetSessionCookie,
}));

// Mock rate limit
const mockRateLimitByIP = vi.fn().mockReturnValue({
  allowed: true,
  remaining: 9,
  resetAt: Date.now() + 60000,
});
const mockRateLimit = vi.fn().mockReturnValue({
  allowed: true,
  remaining: 0,
  resetAt: Date.now() + 2000,
});

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
  rateLimitByIP: mockRateLimitByIP,
  _resetRateLimitStore: vi.fn(),
}));

// Mock image processing
const mockProcessUploadedPhoto = vi.fn().mockResolvedValue({
  full: Buffer.from("full-image"),
  thumb: Buffer.from("thumb-image"),
  width: 1920,
  height: 1080,
  mimeType: "image/webp",
});

vi.mock("@/lib/image-processing", () => ({
  processUploadedPhoto: mockProcessUploadedPhoto,
}));

// Mock storage
const mockSavePhoto = vi.fn().mockResolvedValue({
  storagePath: "evt-1/full/test-uuid.webp",
  thumbnailPath: "evt-1/thumb/test-uuid.webp",
});
const mockGetPhotoBuffer = vi.fn().mockResolvedValue(Buffer.from("photo-data"));
const mockEnsureEventDirs = vi.fn();

vi.mock("@/lib/storage", () => ({
  savePhoto: mockSavePhoto,
  getPhotoBuffer: mockGetPhotoBuffer,
  ensureEventDirs: mockEnsureEventDirs,
}));

// Mock uuid
vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid-1234"),
}));

// Mock event-emitter
vi.mock("@/lib/event-emitter", () => ({
  eventEmitter: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    setMaxListeners: vi.fn(),
  },
  emitEventChange: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
): NextRequest {
  const init: Record<string, unknown> = {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  };
  if (options?.body) {
    init.body = JSON.stringify(options.body);
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function makeParams(slug: string): { params: Promise<{ slug: string }> } {
  return { params: Promise.resolve({ slug }) };
}

function makePhotoParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

// Mock event data
const mockEvent = {
  id: 1,
  name: "Test Wedding",
  slug: "test-wedding",
  status: "active" as const,
  shotLimit: 5,
  termsText: "Please agree to our terms.",
  winnerPhotoId: null,
  adminPasswordHash: "hashed",
  createdAt: new Date(),
  lockedAt: null,
  announcedAt: null,
};

const mockGuest = {
  id: 10,
  eventId: 1,
  name: "John Smith",
  normalizedName: "john smith",
  tableNumber: "5",
  createdAt: new Date(),
};

const mockSession = {
  id: "session-uuid-1",
  eventId: 1,
  guestId: 10,
  agreedToTerms: false,
  userAgent: "test-agent",
  createdAt: new Date(),
  lastActiveAt: new Date(),
};

const mockPhoto = {
  id: 1,
  eventId: 1,
  guestId: 10,
  sessionId: "session-uuid-1",
  originalFilename: "photo.jpg",
  storagePath: "evt-1/full/abc.webp",
  thumbnailPath: "evt-1/thumb/abc.webp",
  mimeType: "image/webp",
  fileSize: 50000,
  width: 1920,
  height: 1080,
  isWinner: false,
  capturedAt: new Date(),
  createdAt: new Date(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/events/[slug]", () => {
  let GET: typeof import("../events/[slug]/route").GET;

  beforeEach(async () => {
    vi.resetModules();
    // Re-apply mocks after resetModules
    vi.doMock("@/db", () => ({ db: mockDb }));
    vi.doMock("@/db/schema", () => ({
      events: { id: "events.id", slug: "events.slug", status: "events.status" },
      guests: { id: "guests.id", eventId: "guests.eventId" },
      sessions: {
        id: "sessions.id",
        eventId: "sessions.eventId",
        guestId: "sessions.guestId",
        agreedToTerms: "sessions.agreedToTerms",
      },
      photos: {
        id: "photos.id",
        eventId: "photos.eventId",
        guestId: "photos.guestId",
        sessionId: "photos.sessionId",
        isWinner: "photos.isWinner",
      },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...args: unknown[]) => ({ _type: "eq", args })),
      and: vi.fn((...args: unknown[]) => ({ _type: "and", args })),
      count: vi.fn(() => ({ _type: "count" })),
      sql: vi.fn(),
    }));
    vi.doMock("@/lib/auth", () => ({
      signSessionToken: mockSignSessionToken,
      verifySessionToken: vi.fn(),
      getSessionFromCookie: mockGetSessionFromCookie,
      setSessionCookie: mockSetSessionCookie,
    }));
    vi.doMock("@/lib/rate-limit", () => ({
      rateLimit: mockRateLimit,
      rateLimitByIP: mockRateLimitByIP,
      _resetRateLimitStore: vi.fn(),
    }));
    vi.doMock("@/lib/image-processing", () => ({
      processUploadedPhoto: mockProcessUploadedPhoto,
    }));
    vi.doMock("@/lib/storage", () => ({
      savePhoto: mockSavePhoto,
      getPhotoBuffer: mockGetPhotoBuffer,
      ensureEventDirs: mockEnsureEventDirs,
    }));
    vi.doMock("uuid", () => ({
      v4: vi.fn(() => "test-uuid-1234"),
    }));
    vi.doMock("@/lib/event-emitter", () => ({
      eventEmitter: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), setMaxListeners: vi.fn() },
      emitEventChange: vi.fn(),
    }));

    vi.clearAllMocks();

    const mod = await import("../events/[slug]/route");
    GET = mod.GET;
  });

  it("returns event public info for valid slug", async () => {
    mockDb.get.mockResolvedValueOnce(mockEvent);

    const req = makeRequest("http://localhost:3000/api/events/test-wedding");
    const res = await GET(req, makeParams("test-wedding"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      name: "Test Wedding",
      slug: "test-wedding",
      status: "active",
      shotLimit: 5,
      termsText: "Please agree to our terms.",
    });
  });

  it("returns 404 for unknown slug", async () => {
    mockDb.get.mockResolvedValueOnce(undefined);

    const req = makeRequest("http://localhost:3000/api/events/nonexistent");
    const res = await GET(req, makeParams("nonexistent"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe("GET /api/events/[slug]/guests", () => {
  let GET: typeof import("../events/[slug]/guests/route").GET;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("@/db", () => ({ db: mockDb }));
    vi.doMock("@/db/schema", () => ({
      events: { id: "events.id", slug: "events.slug", status: "events.status" },
      guests: { id: "guests.id", eventId: "guests.eventId" },
      sessions: {
        id: "sessions.id",
        eventId: "sessions.eventId",
        guestId: "sessions.guestId",
        agreedToTerms: "sessions.agreedToTerms",
      },
      photos: {
        id: "photos.id",
        eventId: "photos.eventId",
        guestId: "photos.guestId",
        sessionId: "photos.sessionId",
        isWinner: "photos.isWinner",
      },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...args: unknown[]) => ({ _type: "eq", args })),
      and: vi.fn((...args: unknown[]) => ({ _type: "and", args })),
      count: vi.fn(() => ({ _type: "count" })),
      sql: vi.fn(),
    }));
    vi.doMock("@/lib/auth", () => ({
      signSessionToken: mockSignSessionToken,
      verifySessionToken: vi.fn(),
      getSessionFromCookie: mockGetSessionFromCookie,
      setSessionCookie: mockSetSessionCookie,
    }));
    vi.doMock("@/lib/rate-limit", () => ({
      rateLimit: mockRateLimit,
      rateLimitByIP: mockRateLimitByIP,
      _resetRateLimitStore: vi.fn(),
    }));

    vi.clearAllMocks();

    const mod = await import("../events/[slug]/guests/route");
    GET = mod.GET;
  });

  it("returns guest list for valid event slug", async () => {
    mockDb.get.mockResolvedValueOnce(mockEvent);
    mockDb.all.mockResolvedValueOnce([
      { id: 10, name: "John Smith", tableNumber: "5" },
      { id: 11, name: "Jane Doe", tableNumber: "3" },
    ]);

    const req = makeRequest("http://localhost:3000/api/events/test-wedding/guests");
    const res = await GET(req, makeParams("test-wedding"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual({ id: 10, name: "John Smith", tableNumber: "5" });
  });

  it("returns 404 if event not found", async () => {
    mockDb.get.mockResolvedValueOnce(undefined);

    const req = makeRequest("http://localhost:3000/api/events/nonexistent/guests");
    const res = await GET(req, makeParams("nonexistent"));

    expect(res.status).toBe(404);
  });
});

describe("POST /api/events/[slug]/identify", () => {
  let POST: typeof import("../events/[slug]/identify/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("@/db", () => ({ db: mockDb }));
    vi.doMock("@/db/schema", () => ({
      events: { id: "events.id", slug: "events.slug", status: "events.status" },
      guests: { id: "guests.id", eventId: "guests.eventId" },
      sessions: {
        id: "sessions.id",
        eventId: "sessions.eventId",
        guestId: "sessions.guestId",
        agreedToTerms: "sessions.agreedToTerms",
      },
      photos: {
        id: "photos.id",
        eventId: "photos.eventId",
        guestId: "photos.guestId",
        sessionId: "photos.sessionId",
        isWinner: "photos.isWinner",
      },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...args: unknown[]) => ({ _type: "eq", args })),
      and: vi.fn((...args: unknown[]) => ({ _type: "and", args })),
      count: vi.fn(() => ({ _type: "count" })),
      sql: vi.fn(),
    }));
    vi.doMock("@/lib/auth", () => ({
      signSessionToken: mockSignSessionToken,
      verifySessionToken: vi.fn(),
      getSessionFromCookie: mockGetSessionFromCookie,
      setSessionCookie: mockSetSessionCookie,
    }));
    vi.doMock("@/lib/rate-limit", () => ({
      rateLimit: mockRateLimit,
      rateLimitByIP: mockRateLimitByIP,
      _resetRateLimitStore: vi.fn(),
    }));
    vi.doMock("uuid", () => ({
      v4: vi.fn(() => "test-uuid-1234"),
    }));

    vi.clearAllMocks();

    const mod = await import("../events/[slug]/identify/route");
    POST = mod.POST;
  });

  it("creates session for valid guest in event", async () => {
    mockDb.get
      .mockResolvedValueOnce(mockEvent) // event lookup
      .mockResolvedValueOnce(mockGuest); // guest lookup
    mockDb.execute.mockResolvedValueOnce(undefined); // insert session

    const req = makeRequest("http://localhost:3000/api/events/test-wedding/identify", {
      method: "POST",
      body: { guestId: 10 },
    });
    const res = await POST(req, makeParams("test-wedding"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sessionId).toBe("test-uuid-1234");
    expect(body.guestName).toBe("John Smith");
    expect(body.shotLimit).toBe(5);
    expect(mockSignSessionToken).toHaveBeenCalledWith({
      sessionId: "test-uuid-1234",
      guestId: 10,
      eventId: 1,
    });
    expect(mockSetSessionCookie).toHaveBeenCalled();
  });

  it("returns 404 when event not found", async () => {
    mockDb.get.mockResolvedValueOnce(undefined);

    const req = makeRequest("http://localhost:3000/api/events/nonexistent/identify", {
      method: "POST",
      body: { guestId: 10 },
    });
    const res = await POST(req, makeParams("nonexistent"));

    expect(res.status).toBe(404);
  });

  it("returns 400 when guestId is missing", async () => {
    mockDb.get.mockResolvedValueOnce(mockEvent);

    const req = makeRequest("http://localhost:3000/api/events/test-wedding/identify", {
      method: "POST",
      body: {},
    });
    const res = await POST(req, makeParams("test-wedding"));

    expect(res.status).toBe(400);
  });

  it("returns 404 when guest does not belong to event", async () => {
    mockDb.get
      .mockResolvedValueOnce(mockEvent) // event found
      .mockResolvedValueOnce(undefined); // guest not found for this event

    const req = makeRequest("http://localhost:3000/api/events/test-wedding/identify", {
      method: "POST",
      body: { guestId: 999 },
    });
    const res = await POST(req, makeParams("test-wedding"));

    expect(res.status).toBe(404);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimitByIP.mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
    });

    const req = makeRequest("http://localhost:3000/api/events/test-wedding/identify", {
      method: "POST",
      body: { guestId: 10 },
    });
    const res = await POST(req, makeParams("test-wedding"));

    expect(res.status).toBe(429);
  });
});

describe("POST /api/events/[slug]/agree", () => {
  let POST: typeof import("../events/[slug]/agree/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("@/db", () => ({ db: mockDb }));
    vi.doMock("@/db/schema", () => ({
      events: { id: "events.id", slug: "events.slug", status: "events.status" },
      guests: { id: "guests.id", eventId: "guests.eventId" },
      sessions: {
        id: "sessions.id",
        eventId: "sessions.eventId",
        guestId: "sessions.guestId",
        agreedToTerms: "sessions.agreedToTerms",
      },
      photos: {
        id: "photos.id",
        eventId: "photos.eventId",
        guestId: "photos.guestId",
        sessionId: "photos.sessionId",
        isWinner: "photos.isWinner",
      },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...args: unknown[]) => ({ _type: "eq", args })),
      and: vi.fn((...args: unknown[]) => ({ _type: "and", args })),
      count: vi.fn(() => ({ _type: "count" })),
      sql: vi.fn(),
    }));
    vi.doMock("@/lib/auth", () => ({
      signSessionToken: mockSignSessionToken,
      verifySessionToken: vi.fn(),
      getSessionFromCookie: mockGetSessionFromCookie,
      setSessionCookie: mockSetSessionCookie,
    }));
    vi.doMock("@/lib/rate-limit", () => ({
      rateLimit: mockRateLimit,
      rateLimitByIP: mockRateLimitByIP,
      _resetRateLimitStore: vi.fn(),
    }));

    vi.clearAllMocks();

    const mod = await import("../events/[slug]/agree/route");
    POST = mod.POST;
  });

  it("sets agreedToTerms for authenticated session", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce({
      sessionId: "session-uuid-1",
      guestId: 10,
      eventId: 1,
    });
    mockDb.execute.mockResolvedValueOnce(undefined);

    const req = makeRequest("http://localhost:3000/api/events/test-wedding/agree", {
      method: "POST",
    });
    const res = await POST(req, makeParams("test-wedding"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 401 without session", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce(null);

    const req = makeRequest("http://localhost:3000/api/events/test-wedding/agree", {
      method: "POST",
    });
    const res = await POST(req, makeParams("test-wedding"));

    expect(res.status).toBe(401);
  });
});

describe("GET /api/events/[slug]/session", () => {
  let GET: typeof import("../events/[slug]/session/route").GET;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("@/db", () => ({ db: mockDb }));
    vi.doMock("@/db/schema", () => ({
      events: { id: "events.id", slug: "events.slug", status: "events.status" },
      guests: { id: "guests.id", eventId: "guests.eventId" },
      sessions: {
        id: "sessions.id",
        eventId: "sessions.eventId",
        guestId: "sessions.guestId",
        agreedToTerms: "sessions.agreedToTerms",
      },
      photos: {
        id: "photos.id",
        eventId: "photos.eventId",
        guestId: "photos.guestId",
        sessionId: "photos.sessionId",
        isWinner: "photos.isWinner",
      },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...args: unknown[]) => ({ _type: "eq", args })),
      and: vi.fn((...args: unknown[]) => ({ _type: "and", args })),
      count: vi.fn(() => ({ _type: "count" })),
      sql: vi.fn(),
    }));
    vi.doMock("@/lib/auth", () => ({
      signSessionToken: mockSignSessionToken,
      verifySessionToken: vi.fn(),
      getSessionFromCookie: mockGetSessionFromCookie,
      setSessionCookie: mockSetSessionCookie,
    }));
    vi.doMock("@/lib/rate-limit", () => ({
      rateLimit: mockRateLimit,
      rateLimitByIP: mockRateLimitByIP,
      _resetRateLimitStore: vi.fn(),
    }));

    vi.clearAllMocks();

    const mod = await import("../events/[slug]/session/route");
    GET = mod.GET;
  });

  it("returns full session state for authenticated user", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce({
      sessionId: "session-uuid-1",
      guestId: 10,
      eventId: 1,
    });
    // Session lookup
    mockDb.get.mockResolvedValueOnce({
      ...mockSession,
      agreedToTerms: true,
    });
    // Guest lookup
    mockDb.get.mockResolvedValueOnce(mockGuest);
    // Event lookup
    mockDb.get.mockResolvedValueOnce(mockEvent);
    // Photo count
    mockDb.get.mockResolvedValueOnce({ count: 2 });

    const req = makeRequest("http://localhost:3000/api/events/test-wedding/session");
    const res = await GET(req, makeParams("test-wedding"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.guestId).toBe(10);
    expect(body.guestName).toBe("John Smith");
    expect(body.eventSlug).toBe("test-wedding");
    expect(body.shotLimit).toBe(5);
    expect(body.photosCount).toBe(2);
    expect(body.agreedToTerms).toBe(true);
    expect(body.eventStatus).toBe("active");
  });

  it("returns 401 without session", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce(null);

    const req = makeRequest("http://localhost:3000/api/events/test-wedding/session");
    const res = await GET(req, makeParams("test-wedding"));

    expect(res.status).toBe(401);
  });
});

describe("POST /api/events/[slug]/photos (upload)", () => {
  let POST: typeof import("../events/[slug]/photos/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("@/db", () => ({ db: mockDb }));
    vi.doMock("@/db/schema", () => ({
      events: { id: "events.id", slug: "events.slug", status: "events.status" },
      guests: { id: "guests.id", eventId: "guests.eventId" },
      sessions: {
        id: "sessions.id",
        eventId: "sessions.eventId",
        guestId: "sessions.guestId",
        agreedToTerms: "sessions.agreedToTerms",
      },
      photos: {
        id: "photos.id",
        eventId: "photos.eventId",
        guestId: "photos.guestId",
        sessionId: "photos.sessionId",
        isWinner: "photos.isWinner",
      },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...args: unknown[]) => ({ _type: "eq", args })),
      and: vi.fn((...args: unknown[]) => ({ _type: "and", args })),
      count: vi.fn(() => ({ _type: "count" })),
      sql: vi.fn(),
    }));
    vi.doMock("@/lib/auth", () => ({
      signSessionToken: mockSignSessionToken,
      verifySessionToken: vi.fn(),
      getSessionFromCookie: mockGetSessionFromCookie,
      setSessionCookie: mockSetSessionCookie,
    }));
    vi.doMock("@/lib/rate-limit", () => ({
      rateLimit: mockRateLimit,
      rateLimitByIP: mockRateLimitByIP,
      _resetRateLimitStore: vi.fn(),
    }));
    vi.doMock("@/lib/image-processing", () => ({
      processUploadedPhoto: mockProcessUploadedPhoto,
    }));
    vi.doMock("@/lib/storage", () => ({
      savePhoto: mockSavePhoto,
      getPhotoBuffer: mockGetPhotoBuffer,
      ensureEventDirs: mockEnsureEventDirs,
    }));
    vi.doMock("uuid", () => ({
      v4: vi.fn(() => "test-uuid-1234"),
    }));
    vi.doMock("@/lib/event-emitter", () => ({
      eventEmitter: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), setMaxListeners: vi.fn() },
      emitEventChange: vi.fn(),
    }));

    vi.clearAllMocks();

    const mod = await import("../events/[slug]/photos/route");
    POST = mod.POST;
  });

  it("returns 401 without session", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce(null);

    const formData = new FormData();
    formData.append("photo", new Blob(["fake-image"], { type: "image/jpeg" }), "test.jpg");

    const req = new NextRequest("http://localhost:3000/api/events/test-wedding/photos", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req, makeParams("test-wedding"));

    expect(res.status).toBe(401);
  });

  it("returns 403 when event is locked", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce({
      sessionId: "session-uuid-1",
      guestId: 10,
      eventId: 1,
    });
    mockDb.get.mockResolvedValueOnce({ ...mockEvent, status: "locked" });

    const formData = new FormData();
    formData.append("photo", new Blob(["fake-image"], { type: "image/jpeg" }), "test.jpg");

    const req = new NextRequest("http://localhost:3000/api/events/test-wedding/photos", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req, makeParams("test-wedding"));

    expect(res.status).toBe(403);
  });

  it("returns 429 when photo quota exceeded", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce({
      sessionId: "session-uuid-1",
      guestId: 10,
      eventId: 1,
    });
    mockDb.get
      .mockResolvedValueOnce(mockEvent) // event lookup (status active, shotLimit 5)
      .mockResolvedValueOnce({ count: 5 }); // photo count = 5 (at limit)

    const formData = new FormData();
    formData.append("photo", new Blob(["fake-image"], { type: "image/jpeg" }), "test.jpg");

    const req = new NextRequest("http://localhost:3000/api/events/test-wedding/photos", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req, makeParams("test-wedding"));

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/quota|limit/i);
  });

  it("returns 429 when rate limited", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce({
      sessionId: "session-uuid-1",
      guestId: 10,
      eventId: 1,
    });
    mockDb.get
      .mockResolvedValueOnce(mockEvent) // event lookup
      .mockResolvedValueOnce({ count: 0 }); // photo count
    mockRateLimit.mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 2000,
    });

    const formData = new FormData();
    formData.append("photo", new Blob(["fake-image"], { type: "image/jpeg" }), "test.jpg");

    const req = new NextRequest("http://localhost:3000/api/events/test-wedding/photos", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req, makeParams("test-wedding"));

    expect(res.status).toBe(429);
  });

  it("uploads photo successfully", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce({
      sessionId: "session-uuid-1",
      guestId: 10,
      eventId: 1,
    });
    mockDb.get
      .mockResolvedValueOnce(mockEvent) // event lookup
      .mockResolvedValueOnce({ count: 0 }); // photo count
    mockRateLimit.mockReturnValueOnce({
      allowed: true,
      remaining: 0,
      resetAt: Date.now() + 2000,
    });
    // Insert photo returning
    mockDb.get.mockResolvedValueOnce({ id: 42 });

    const formData = new FormData();
    formData.append(
      "photo",
      new Blob(["fake-image-data"], { type: "image/jpeg" }),
      "test.jpg"
    );

    const req = new NextRequest("http://localhost:3000/api/events/test-wedding/photos", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req, makeParams("test-wedding"));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe(42);
    expect(body.thumbnailUrl).toBe("/api/photos/42/thumb");
    expect(mockProcessUploadedPhoto).toHaveBeenCalled();
    expect(mockSavePhoto).toHaveBeenCalled();
  });
});

describe("GET /api/events/[slug]/photos/mine", () => {
  let GET: typeof import("../events/[slug]/photos/mine/route").GET;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("@/db", () => ({ db: mockDb }));
    vi.doMock("@/db/schema", () => ({
      events: { id: "events.id", slug: "events.slug", status: "events.status" },
      guests: { id: "guests.id", eventId: "guests.eventId" },
      sessions: {
        id: "sessions.id",
        eventId: "sessions.eventId",
        guestId: "sessions.guestId",
        agreedToTerms: "sessions.agreedToTerms",
      },
      photos: {
        id: "photos.id",
        eventId: "photos.eventId",
        guestId: "photos.guestId",
        sessionId: "photos.sessionId",
        isWinner: "photos.isWinner",
      },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...args: unknown[]) => ({ _type: "eq", args })),
      and: vi.fn((...args: unknown[]) => ({ _type: "and", args })),
      count: vi.fn(() => ({ _type: "count" })),
      sql: vi.fn(),
    }));
    vi.doMock("@/lib/auth", () => ({
      signSessionToken: mockSignSessionToken,
      verifySessionToken: vi.fn(),
      getSessionFromCookie: mockGetSessionFromCookie,
      setSessionCookie: mockSetSessionCookie,
    }));

    vi.clearAllMocks();

    const mod = await import("../events/[slug]/photos/mine/route");
    GET = mod.GET;
  });

  it("returns own photos for authenticated guest", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce({
      sessionId: "session-uuid-1",
      guestId: 10,
      eventId: 1,
    });
    // Event lookup for shotLimit
    mockDb.get.mockResolvedValueOnce({ shotLimit: 5 });
    mockDb.all.mockResolvedValueOnce([
      { id: 1, thumbnailPath: "evt-1/thumb/abc.webp", createdAt: new Date("2024-01-01") },
      { id: 2, thumbnailPath: "evt-1/thumb/def.webp", createdAt: new Date("2024-01-02") },
    ]);

    const req = makeRequest("http://localhost:3000/api/events/test-wedding/photos/mine");
    const res = await GET(req, makeParams("test-wedding"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.photos).toHaveLength(2);
    expect(body.count).toBe(2);
    expect(body.shotLimit).toBe(5);
    expect(body.photos[0].thumbnailUrl).toBe("/api/photos/1/thumb");
  });

  it("returns 401 without session", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce(null);

    const req = makeRequest("http://localhost:3000/api/events/test-wedding/photos/mine");
    const res = await GET(req, makeParams("test-wedding"));

    expect(res.status).toBe(401);
  });
});

describe("GET /api/events/[slug]/photos/all", () => {
  let GET: typeof import("../events/[slug]/photos/all/route").GET;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("@/db", () => ({ db: mockDb }));
    vi.doMock("@/db/schema", () => ({
      events: { id: "events.id", slug: "events.slug", status: "events.status" },
      guests: { id: "guests.id", eventId: "guests.eventId", name: "guests.name" },
      sessions: {
        id: "sessions.id",
        eventId: "sessions.eventId",
        guestId: "sessions.guestId",
        agreedToTerms: "sessions.agreedToTerms",
      },
      photos: {
        id: "photos.id",
        eventId: "photos.eventId",
        guestId: "photos.guestId",
        sessionId: "photos.sessionId",
        isWinner: "photos.isWinner",
      },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...args: unknown[]) => ({ _type: "eq", args })),
      and: vi.fn((...args: unknown[]) => ({ _type: "and", args })),
      count: vi.fn(() => ({ _type: "count" })),
      sql: vi.fn(),
    }));
    vi.doMock("@/lib/auth", () => ({
      signSessionToken: mockSignSessionToken,
      verifySessionToken: vi.fn(),
      getSessionFromCookie: mockGetSessionFromCookie,
      setSessionCookie: mockSetSessionCookie,
    }));

    vi.clearAllMocks();

    const mod = await import("../events/[slug]/photos/all/route");
    GET = mod.GET;
  });

  it("returns 403 when event is not announced", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce({
      sessionId: "session-uuid-1",
      guestId: 10,
      eventId: 1,
    });
    mockDb.get.mockResolvedValueOnce({ ...mockEvent, status: "active" });

    const req = makeRequest("http://localhost:3000/api/events/test-wedding/photos/all");
    const res = await GET(req, makeParams("test-wedding"));

    expect(res.status).toBe(403);
  });

  it("returns all photos with guest names when event is announced", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce({
      sessionId: "session-uuid-1",
      guestId: 10,
      eventId: 1,
    });
    mockDb.get.mockResolvedValueOnce({ ...mockEvent, status: "announced" });
    mockDb.all.mockResolvedValueOnce([
      {
        id: 1,
        thumbnailPath: "evt-1/thumb/abc.webp",
        isWinner: false,
        createdAt: new Date("2024-01-01"),
        guestName: "John Smith",
      },
      {
        id: 2,
        thumbnailPath: "evt-1/thumb/def.webp",
        isWinner: true,
        createdAt: new Date("2024-01-02"),
        guestName: "Jane Doe",
      },
    ]);

    const req = makeRequest("http://localhost:3000/api/events/test-wedding/photos/all");
    const res = await GET(req, makeParams("test-wedding"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.photos).toHaveLength(2);
    expect(body.photos[0].guestName).toBe("John Smith");
    expect(body.photos[1].isWinner).toBe(true);
    expect(body.photos[0].thumbnailUrl).toBe("/api/photos/1/thumb");
    expect(body.photos[0].fullUrl).toBe("/api/photos/1/full");
  });
});

describe("GET /api/photos/[id]/full", () => {
  let GET: typeof import("../photos/[id]/full/route").GET;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("@/db", () => ({ db: mockDb }));
    vi.doMock("@/db/schema", () => ({
      events: { id: "events.id", slug: "events.slug", status: "events.status" },
      guests: { id: "guests.id", eventId: "guests.eventId" },
      sessions: {
        id: "sessions.id",
        eventId: "sessions.eventId",
        guestId: "sessions.guestId",
        agreedToTerms: "sessions.agreedToTerms",
      },
      photos: {
        id: "photos.id",
        eventId: "photos.eventId",
        guestId: "photos.guestId",
        sessionId: "photos.sessionId",
        isWinner: "photos.isWinner",
      },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...args: unknown[]) => ({ _type: "eq", args })),
      and: vi.fn((...args: unknown[]) => ({ _type: "and", args })),
      count: vi.fn(() => ({ _type: "count" })),
      sql: vi.fn(),
    }));
    vi.doMock("@/lib/auth", () => ({
      signSessionToken: mockSignSessionToken,
      verifySessionToken: vi.fn(),
      getSessionFromCookie: mockGetSessionFromCookie,
      setSessionCookie: mockSetSessionCookie,
    }));
    vi.doMock("@/lib/storage", () => ({
      savePhoto: mockSavePhoto,
      getPhotoBuffer: mockGetPhotoBuffer,
      ensureEventDirs: mockEnsureEventDirs,
    }));

    vi.clearAllMocks();

    const mod = await import("../photos/[id]/full/route");
    GET = mod.GET;
  });

  it("returns 401 without session", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce(null);

    const req = makeRequest("http://localhost:3000/api/photos/1/full");
    const res = await GET(req, makePhotoParams("1"));

    expect(res.status).toBe(401);
  });

  it("returns 404 for nonexistent photo", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce({
      sessionId: "session-uuid-1",
      guestId: 10,
      eventId: 1,
    });
    mockDb.get.mockResolvedValueOnce(undefined); // photo not found

    const req = makeRequest("http://localhost:3000/api/photos/999/full");
    const res = await GET(req, makePhotoParams("999"));

    expect(res.status).toBe(404);
  });

  it("serves own photo during active event", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce({
      sessionId: "session-uuid-1",
      guestId: 10,
      eventId: 1,
    });
    mockDb.get
      .mockResolvedValueOnce(mockPhoto) // photo found, guestId matches
      .mockResolvedValueOnce(mockEvent); // event lookup
    mockGetPhotoBuffer.mockResolvedValueOnce(Buffer.from("photo-data"));

    const req = makeRequest("http://localhost:3000/api/photos/1/full");
    const res = await GET(req, makePhotoParams("1"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Cache-Control")).toContain("immutable");
  });

  it("returns 403 for other guest photo during active event", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce({
      sessionId: "session-uuid-1",
      guestId: 10, // requesting guest
      eventId: 1,
    });
    const otherGuestPhoto = { ...mockPhoto, guestId: 20 }; // photo belongs to guest 20
    mockDb.get
      .mockResolvedValueOnce(otherGuestPhoto)
      .mockResolvedValueOnce({ ...mockEvent, status: "active" });

    const req = makeRequest("http://localhost:3000/api/photos/1/full");
    const res = await GET(req, makePhotoParams("1"));

    expect(res.status).toBe(403);
  });

  it("serves any photo when event is announced", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce({
      sessionId: "session-uuid-1",
      guestId: 10,
      eventId: 1,
    });
    const otherGuestPhoto = { ...mockPhoto, guestId: 20 };
    mockDb.get
      .mockResolvedValueOnce(otherGuestPhoto)
      .mockResolvedValueOnce({ ...mockEvent, status: "announced" });
    mockGetPhotoBuffer.mockResolvedValueOnce(Buffer.from("photo-data"));

    const req = makeRequest("http://localhost:3000/api/photos/1/full");
    const res = await GET(req, makePhotoParams("1"));

    expect(res.status).toBe(200);
  });
});

describe("GET /api/photos/[id]/thumb", () => {
  let GET: typeof import("../photos/[id]/thumb/route").GET;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("@/db", () => ({ db: mockDb }));
    vi.doMock("@/db/schema", () => ({
      events: { id: "events.id", slug: "events.slug", status: "events.status" },
      guests: { id: "guests.id", eventId: "guests.eventId" },
      sessions: {
        id: "sessions.id",
        eventId: "sessions.eventId",
        guestId: "sessions.guestId",
        agreedToTerms: "sessions.agreedToTerms",
      },
      photos: {
        id: "photos.id",
        eventId: "photos.eventId",
        guestId: "photos.guestId",
        sessionId: "photos.sessionId",
        isWinner: "photos.isWinner",
      },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...args: unknown[]) => ({ _type: "eq", args })),
      and: vi.fn((...args: unknown[]) => ({ _type: "and", args })),
      count: vi.fn(() => ({ _type: "count" })),
      sql: vi.fn(),
    }));
    vi.doMock("@/lib/auth", () => ({
      signSessionToken: mockSignSessionToken,
      verifySessionToken: vi.fn(),
      getSessionFromCookie: mockGetSessionFromCookie,
      setSessionCookie: mockSetSessionCookie,
    }));
    vi.doMock("@/lib/storage", () => ({
      savePhoto: mockSavePhoto,
      getPhotoBuffer: mockGetPhotoBuffer,
      ensureEventDirs: mockEnsureEventDirs,
    }));

    vi.clearAllMocks();

    const mod = await import("../photos/[id]/thumb/route");
    GET = mod.GET;
  });

  it("serves thumbnail for own photo", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce({
      sessionId: "session-uuid-1",
      guestId: 10,
      eventId: 1,
    });
    mockDb.get
      .mockResolvedValueOnce(mockPhoto)
      .mockResolvedValueOnce(mockEvent);
    mockGetPhotoBuffer.mockResolvedValueOnce(Buffer.from("thumb-data"));

    const req = makeRequest("http://localhost:3000/api/photos/1/thumb");
    const res = await GET(req, makePhotoParams("1"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
  });

  it("returns 403 for other guest thumbnail during active event", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce({
      sessionId: "session-uuid-1",
      guestId: 10,
      eventId: 1,
    });
    const otherGuestPhoto = { ...mockPhoto, guestId: 20 };
    mockDb.get
      .mockResolvedValueOnce(otherGuestPhoto)
      .mockResolvedValueOnce({ ...mockEvent, status: "active" });

    const req = makeRequest("http://localhost:3000/api/photos/1/thumb");
    const res = await GET(req, makePhotoParams("1"));

    expect(res.status).toBe(403);
  });
});

describe("GET /api/events/[slug]/status (SSE)", () => {
  let GET: typeof import("../events/[slug]/status/route").GET;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("@/db", () => ({ db: mockDb }));
    vi.doMock("@/db/schema", () => ({
      events: { id: "events.id", slug: "events.slug", status: "events.status" },
      guests: { id: "guests.id", eventId: "guests.eventId" },
      sessions: {
        id: "sessions.id",
        eventId: "sessions.eventId",
        guestId: "sessions.guestId",
        agreedToTerms: "sessions.agreedToTerms",
      },
      photos: {
        id: "photos.id",
        eventId: "photos.eventId",
        guestId: "photos.guestId",
        sessionId: "photos.sessionId",
        isWinner: "photos.isWinner",
      },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...args: unknown[]) => ({ _type: "eq", args })),
      and: vi.fn((...args: unknown[]) => ({ _type: "and", args })),
      count: vi.fn(() => ({ _type: "count" })),
      sql: vi.fn(),
    }));
    vi.doMock("@/lib/auth", () => ({
      signSessionToken: mockSignSessionToken,
      verifySessionToken: vi.fn(),
      getSessionFromCookie: mockGetSessionFromCookie,
      setSessionCookie: mockSetSessionCookie,
    }));
    vi.doMock("@/lib/event-emitter", () => ({
      eventEmitter: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), setMaxListeners: vi.fn() },
      emitEventChange: vi.fn(),
    }));

    vi.clearAllMocks();

    const mod = await import("../events/[slug]/status/route");
    GET = mod.GET;
  });

  it("returns 401 without session", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce(null);

    const req = makeRequest("http://localhost:3000/api/events/test-wedding/status");
    const res = await GET(req, makeParams("test-wedding"));

    expect(res.status).toBe(401);
  });

  it("returns SSE stream with correct headers", async () => {
    mockGetSessionFromCookie.mockResolvedValueOnce({
      sessionId: "session-uuid-1",
      guestId: 10,
      eventId: 1,
    });
    mockDb.get.mockResolvedValueOnce(mockEvent);

    const req = makeRequest("http://localhost:3000/api/events/test-wedding/status");
    const res = await GET(req, makeParams("test-wedding"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
    expect(res.headers.get("Connection")).toBe("keep-alive");
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");
    expect(res.body).toBeTruthy();
  });
});
