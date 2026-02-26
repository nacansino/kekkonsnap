import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

const databaseUrl = process.env.DATABASE_URL ?? "./data/kekkonsnap.db";

// Ensure the directory for the database file exists
const dir = dirname(databaseUrl);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

export const sqlite = new Database(databaseUrl);

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");

// Enable foreign key enforcement (off by default in SQLite)
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
