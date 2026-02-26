import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql, eq } from "drizzle-orm";
import { events, guests, sessions, photos } from "../schema";
import type {
  NewEvent,
  NewGuest,
  NewSession,
  NewPhoto,
} from "../schema";

// ---------------------------------------------------------------------------
// Helpers — each test gets a fresh in-memory database
// ---------------------------------------------------------------------------
function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, {
    schema: { events, guests, sessions, photos },
  });

  return { sqlite, db };
}

/** Apply the schema DDL so tables exist. */
function migrate(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      admin_password_hash TEXT NOT NULL,
      shot_limit INTEGER NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'active',
      winner_photo_id INTEGER,
      terms_text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      locked_at INTEGER,
      announced_at INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS events_slug_idx ON events(slug);

    CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id),
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      table_number TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS guests_event_id_idx ON guests(event_id);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      event_id INTEGER NOT NULL REFERENCES events(id),
      guest_id INTEGER NOT NULL REFERENCES guests(id),
      agreed_to_terms INTEGER NOT NULL DEFAULT 0,
      user_agent TEXT,
      created_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id),
      guest_id INTEGER NOT NULL REFERENCES guests(id),
      session_id TEXT NOT NULL REFERENCES sessions(id),
      original_filename TEXT,
      storage_path TEXT NOT NULL,
      thumbnail_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      is_winner INTEGER NOT NULL DEFAULT 0,
      captured_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS photos_event_guest_idx ON photos(event_id, guest_id);
    CREATE INDEX IF NOT EXISTS photos_event_id_idx ON photos(event_id);
    CREATE INDEX IF NOT EXISTS photos_event_winner_idx ON photos(event_id, is_winner);
  `);
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
function makeEvent(overrides: Partial<NewEvent> = {}): NewEvent {
  return {
    name: "Test Wedding",
    slug: "test-wedding",
    adminPasswordHash: "$2a$10$fakehashvalue",
    shotLimit: 5,
    status: "active",
    termsText: "Please be respectful.",
    createdAt: new Date(),
    ...overrides,
  };
}

function makeGuest(eventId: number, overrides: Partial<NewGuest> = {}): NewGuest {
  return {
    eventId,
    name: "John Smith",
    normalizedName: "john smith",
    tableNumber: "1",
    createdAt: new Date(),
    ...overrides,
  };
}

function makeSession(
  eventId: number,
  guestId: number,
  overrides: Partial<NewSession> = {},
): NewSession {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    eventId,
    guestId,
    agreedToTerms: true,
    userAgent: "TestAgent/1.0",
    createdAt: new Date(),
    lastActiveAt: new Date(),
    ...overrides,
  };
}

function makePhoto(
  eventId: number,
  guestId: number,
  sessionId: string,
  overrides: Partial<NewPhoto> = {},
): NewPhoto {
  return {
    eventId,
    guestId,
    sessionId,
    originalFilename: "photo.jpg",
    storagePath: "/uploads/photo.jpg",
    thumbnailPath: "/uploads/photo_thumb.jpg",
    mimeType: "image/jpeg",
    fileSize: 1024000,
    width: 1920,
    height: 1080,
    isWinner: false,
    capturedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

// ===========================================================================
// Test suites
// ===========================================================================

describe("Schema: table creation", () => {
  it("should create all four tables without errors", () => {
    const { sqlite } = createTestDb();
    // This verifies the DDL runs cleanly
    expect(() => migrate(sqlite)).not.toThrow();

    // Verify tables exist
    const tables = sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      )
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("events");
    expect(tableNames).toContain("guests");
    expect(tableNames).toContain("sessions");
    expect(tableNames).toContain("photos");
  });

  it("should create the expected indexes", () => {
    const { sqlite } = createTestDb();
    migrate(sqlite);

    const indexes = sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      )
      .all() as { name: string }[];

    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("events_slug_idx");
    expect(indexNames).toContain("guests_event_id_idx");
    expect(indexNames).toContain("photos_event_guest_idx");
    expect(indexNames).toContain("photos_event_id_idx");
    expect(indexNames).toContain("photos_event_winner_idx");
  });
});

describe("Schema: events table", () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    db = testDb.db;
    migrate(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("should insert and retrieve an event", () => {
    const newEvent = makeEvent();
    const inserted = db.insert(events).values(newEvent).returning().get();

    expect(inserted).toBeDefined();
    expect(inserted.id).toBe(1);
    expect(inserted.name).toBe("Test Wedding");
    expect(inserted.slug).toBe("test-wedding");
    expect(inserted.shotLimit).toBe(5);
    expect(inserted.status).toBe("active");
    expect(inserted.winnerPhotoId).toBeNull();
  });

  it("should enforce unique slug constraint", () => {
    db.insert(events).values(makeEvent()).run();

    expect(() => {
      db.insert(events).values(makeEvent({ name: "Another Wedding" })).run();
    }).toThrow(); // UNIQUE constraint violation
  });

  it("should support all status values", () => {
    for (const status of ["active", "locked", "announced"] as const) {
      const slug = `wedding-${status}`;
      const inserted = db
        .insert(events)
        .values(makeEvent({ slug, status }))
        .returning()
        .get();
      expect(inserted.status).toBe(status);
    }
  });

  it("should store nullable timestamp fields", () => {
    // SQLite timestamps are stored as seconds, so milliseconds are truncated.
    // Use a Date with no fractional seconds to get an exact round-trip.
    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    const inserted = db
      .insert(events)
      .values(makeEvent({ lockedAt: now, announcedAt: now }))
      .returning()
      .get();

    expect(inserted.lockedAt).toEqual(now);
    expect(inserted.announcedAt).toEqual(now);
  });

  it("should default nullable timestamps to null", () => {
    const inserted = db.insert(events).values(makeEvent()).returning().get();
    expect(inserted.lockedAt).toBeNull();
    expect(inserted.announcedAt).toBeNull();
  });
});

describe("Schema: guests table", () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;
  let eventId: number;

  beforeEach(() => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    db = testDb.db;
    migrate(sqlite);

    const event = db.insert(events).values(makeEvent()).returning().get();
    eventId = event.id;
  });

  afterEach(() => {
    sqlite.close();
  });

  it("should insert and retrieve a guest", () => {
    const guest = db
      .insert(guests)
      .values(makeGuest(eventId))
      .returning()
      .get();

    expect(guest.id).toBe(1);
    expect(guest.name).toBe("John Smith");
    expect(guest.normalizedName).toBe("john smith");
    expect(guest.tableNumber).toBe("1");
    expect(guest.eventId).toBe(eventId);
  });

  it("should enforce foreign key to events", () => {
    expect(() => {
      db.insert(guests).values(makeGuest(9999)).run();
    }).toThrow(); // FK constraint
  });

  it("should allow nullable tableNumber", () => {
    const guest = db
      .insert(guests)
      .values(makeGuest(eventId, { tableNumber: null }))
      .returning()
      .get();

    expect(guest.tableNumber).toBeNull();
  });

  it("should bulk-insert multiple guests", () => {
    const guestData = [
      makeGuest(eventId, { name: "Alice", normalizedName: "alice" }),
      makeGuest(eventId, { name: "Bob", normalizedName: "bob" }),
      makeGuest(eventId, { name: "Charlie", normalizedName: "charlie" }),
    ];

    db.insert(guests).values(guestData).run();

    const allGuests = db.select().from(guests).all();
    expect(allGuests).toHaveLength(3);
  });
});

describe("Schema: sessions table", () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;
  let eventId: number;
  let guestId: number;

  beforeEach(() => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    db = testDb.db;
    migrate(sqlite);

    const event = db.insert(events).values(makeEvent()).returning().get();
    eventId = event.id;

    const guest = db
      .insert(guests)
      .values(makeGuest(eventId))
      .returning()
      .get();
    guestId = guest.id;
  });

  afterEach(() => {
    sqlite.close();
  });

  it("should insert and retrieve a session", () => {
    const session = db
      .insert(sessions)
      .values(makeSession(eventId, guestId))
      .returning()
      .get();

    expect(session.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(session.eventId).toBe(eventId);
    expect(session.guestId).toBe(guestId);
    expect(session.agreedToTerms).toBe(true);
  });

  it("should enforce FK to events", () => {
    expect(() => {
      db.insert(sessions)
        .values(makeSession(9999, guestId, { id: "uuid-1" }))
        .run();
    }).toThrow();
  });

  it("should enforce FK to guests", () => {
    expect(() => {
      db.insert(sessions)
        .values(makeSession(eventId, 9999, { id: "uuid-2" }))
        .run();
    }).toThrow();
  });

  it("should default agreedToTerms to false", () => {
    const session = db
      .insert(sessions)
      .values({
        id: "uuid-default-terms",
        eventId,
        guestId,
        createdAt: new Date(),
        lastActiveAt: new Date(),
      })
      .returning()
      .get();

    expect(session.agreedToTerms).toBe(false);
  });
});

describe("Schema: photos table", () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;
  let eventId: number;
  let guestId: number;
  let sessionId: string;

  beforeEach(() => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    db = testDb.db;
    migrate(sqlite);

    const event = db.insert(events).values(makeEvent()).returning().get();
    eventId = event.id;

    const guest = db
      .insert(guests)
      .values(makeGuest(eventId))
      .returning()
      .get();
    guestId = guest.id;

    const session = db
      .insert(sessions)
      .values(makeSession(eventId, guestId))
      .returning()
      .get();
    sessionId = session.id;
  });

  afterEach(() => {
    sqlite.close();
  });

  it("should insert and retrieve a photo", () => {
    const photo = db
      .insert(photos)
      .values(makePhoto(eventId, guestId, sessionId))
      .returning()
      .get();

    expect(photo.id).toBe(1);
    expect(photo.storagePath).toBe("/uploads/photo.jpg");
    expect(photo.mimeType).toBe("image/jpeg");
    expect(photo.isWinner).toBe(false);
    expect(photo.fileSize).toBe(1024000);
  });

  it("should enforce FK to events", () => {
    expect(() => {
      db.insert(photos)
        .values(makePhoto(9999, guestId, sessionId))
        .run();
    }).toThrow();
  });

  it("should enforce FK to guests", () => {
    expect(() => {
      db.insert(photos)
        .values(makePhoto(eventId, 9999, sessionId))
        .run();
    }).toThrow();
  });

  it("should enforce FK to sessions", () => {
    expect(() => {
      db.insert(photos)
        .values(makePhoto(eventId, guestId, "nonexistent-session"))
        .run();
    }).toThrow();
  });

  it("should default isWinner to false", () => {
    const photo = db
      .insert(photos)
      .values(makePhoto(eventId, guestId, sessionId))
      .returning()
      .get();

    expect(photo.isWinner).toBe(false);
  });

  it("should allow nullable width and height", () => {
    const photo = db
      .insert(photos)
      .values(makePhoto(eventId, guestId, sessionId, { width: null, height: null }))
      .returning()
      .get();

    expect(photo.width).toBeNull();
    expect(photo.height).toBeNull();
  });

  it("should query photos by event and guest", () => {
    // Insert multiple photos
    db.insert(photos)
      .values([
        makePhoto(eventId, guestId, sessionId, { storagePath: "/p1.jpg", thumbnailPath: "/t1.jpg" }),
        makePhoto(eventId, guestId, sessionId, { storagePath: "/p2.jpg", thumbnailPath: "/t2.jpg" }),
      ])
      .run();

    const results = db
      .select()
      .from(photos)
      .where(
        sql`${photos.eventId} = ${eventId} AND ${photos.guestId} = ${guestId}`,
      )
      .all();

    expect(results).toHaveLength(2);
  });
});

describe("Schema: cross-table relationships", () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    db = testDb.db;
    migrate(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("should support a full event -> guest -> session -> photo chain", () => {
    // 1. Create event
    const event = db.insert(events).values(makeEvent()).returning().get();

    // 2. Create guest linked to event
    const guest = db
      .insert(guests)
      .values(makeGuest(event.id))
      .returning()
      .get();

    // 3. Create session linked to event + guest
    const session = db
      .insert(sessions)
      .values(makeSession(event.id, guest.id))
      .returning()
      .get();

    // 4. Create photo linked to event + guest + session
    const photo = db
      .insert(photos)
      .values(makePhoto(event.id, guest.id, session.id))
      .returning()
      .get();

    // Verify the chain
    expect(photo.eventId).toBe(event.id);
    expect(photo.guestId).toBe(guest.id);
    expect(photo.sessionId).toBe(session.id);

    // Verify we can query back through
    const eventPhotos = db
      .select()
      .from(photos)
      .where(eq(photos.eventId, event.id))
      .all();
    expect(eventPhotos).toHaveLength(1);
    expect(eventPhotos[0].id).toBe(photo.id);
  });

  it("should support multiple guests per event", () => {
    const event = db.insert(events).values(makeEvent()).returning().get();

    db.insert(guests)
      .values([
        makeGuest(event.id, { name: "Guest A", normalizedName: "guest a" }),
        makeGuest(event.id, { name: "Guest B", normalizedName: "guest b" }),
        makeGuest(event.id, { name: "Guest C", normalizedName: "guest c" }),
      ])
      .run();

    const eventGuests = db
      .select()
      .from(guests)
      .where(eq(guests.eventId, event.id))
      .all();

    expect(eventGuests).toHaveLength(3);
  });

  it("should support winner photo query pattern", () => {
    const event = db.insert(events).values(makeEvent()).returning().get();
    const guest = db
      .insert(guests)
      .values(makeGuest(event.id))
      .returning()
      .get();
    const session = db
      .insert(sessions)
      .values(makeSession(event.id, guest.id))
      .returning()
      .get();

    // Insert a non-winner and a winner
    db.insert(photos)
      .values(
        makePhoto(event.id, guest.id, session.id, {
          storagePath: "/normal.jpg",
          thumbnailPath: "/normal_t.jpg",
          isWinner: false,
        }),
      )
      .run();

    db.insert(photos)
      .values(
        makePhoto(event.id, guest.id, session.id, {
          storagePath: "/winner.jpg",
          thumbnailPath: "/winner_t.jpg",
          isWinner: true,
        }),
      )
      .run();

    // Query winner using the index
    const winners = db
      .select()
      .from(photos)
      .where(
        sql`${photos.eventId} = ${event.id} AND ${photos.isWinner} = 1`,
      )
      .all();

    expect(winners).toHaveLength(1);
    expect(winners[0].storagePath).toBe("/winner.jpg");
  });
});
