import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// events
// ---------------------------------------------------------------------------
export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    adminPasswordHash: text("admin_password_hash").notNull(),
    shotLimit: integer("shot_limit").notNull().default(5),
    status: text("status", { enum: ["active", "locked", "announced"] })
      .notNull()
      .default("active"),
    winnerPhotoId: integer("winner_photo_id"),
    termsText: text("terms_text").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    lockedAt: integer("locked_at", { mode: "timestamp" }),
    announcedAt: integer("announced_at", { mode: "timestamp" }),
    scheduledLockAt: integer("scheduled_lock_at", { mode: "timestamp" }),
  },
  (table) => [
    uniqueIndex("events_slug_idx").on(table.slug),
  ],
);

// ---------------------------------------------------------------------------
// guests
// ---------------------------------------------------------------------------
export const guests = sqliteTable(
  "guests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    tableNumber: text("table_number"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("guests_event_id_idx").on(table.eventId),
  ],
);

// ---------------------------------------------------------------------------
// sessions
// ---------------------------------------------------------------------------
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // UUID
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id),
  guestId: integer("guest_id")
    .notNull()
    .references(() => guests.id),
  agreedToTerms: integer("agreed_to_terms", { mode: "boolean" })
    .notNull()
    .default(false),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  lastActiveAt: integer("last_active_at", { mode: "timestamp" }).notNull(),
});

// ---------------------------------------------------------------------------
// photos
// ---------------------------------------------------------------------------
export const photos = sqliteTable(
  "photos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id),
    guestId: integer("guest_id")
      .notNull()
      .references(() => guests.id),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    originalFilename: text("original_filename"),
    storagePath: text("storage_path").notNull(),
    thumbnailPath: text("thumbnail_path").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    isWinner: integer("is_winner", { mode: "boolean" }).notNull().default(false),
    capturedAt: integer("captured_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("photos_event_guest_idx").on(table.eventId, table.guestId),
    index("photos_event_id_idx").on(table.eventId),
    index("photos_event_winner_idx").on(table.eventId, table.isWinner),
  ],
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type Guest = typeof guests.$inferSelect;
export type NewGuest = typeof guests.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
