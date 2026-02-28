import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import * as schema from "@/db/schema";

/**
 * Verifies that applying all migrations produces a database whose columns
 * match what the Drizzle schema expects.  This catches the case where
 * `drizzle-kit generate` was run but `drizzle-kit migrate` was not.
 */
describe("Drizzle migrations match schema", () => {
  it("all migration columns should match the Drizzle schema definitions", () => {
    // 1. Create a fresh in-memory DB
    const sqlite = new Database(":memory:");
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");

    // 2. Apply every migration file in order
    const migrationsDir = resolve(process.cwd(), "drizzle");
    const sqlFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort(); // lexicographic sort matches drizzle-kit ordering (0000_, 0001_, …)

    expect(sqlFiles.length).toBeGreaterThan(0);

    for (const file of sqlFiles) {
      const sql = readFileSync(resolve(migrationsDir, file), "utf-8");
      sqlite.exec(sql);
    }

    // 3. For each table in the Drizzle schema, verify every column exists
    const tables: Record<string, Record<string, unknown>> = {
      events: schema.events,
      guests: schema.guests,
      sessions: schema.sessions,
      photos: schema.photos,
    };

    for (const [tableName, tableSchema] of Object.entries(tables)) {
      const dbColumns = sqlite
        .prepare(`PRAGMA table_info(${tableName})`)
        .all() as Array<{ name: string }>;

      const dbColumnNames = new Set(dbColumns.map((c) => c.name));

      // Get the columns Drizzle expects from the schema object.
      // Drizzle table objects store column configs keyed by their DB name
      // in a Symbol-keyed internal structure, but we can read the
      // snake_case column names from the SQL column property.
      const schemaColumns = Object.values(tableSchema)
        .filter(
          (v): v is { name: string } =>
            typeof v === "object" && v !== null && "name" in v && typeof (v as Record<string, unknown>).name === "string"
        )
        .map((col) => col.name);

      for (const expectedCol of schemaColumns) {
        expect(
          dbColumnNames.has(expectedCol),
          `Table "${tableName}" is missing column "${expectedCol}". ` +
            `Run: npx drizzle-kit migrate`
        ).toBe(true);
      }
    }

    sqlite.close();
  });
});
