#!/usr/bin/env tsx
/**
 * CLI script to seed the guest list for a kekkonsnap event.
 *
 * Usage:
 *   npx tsx scripts/seed.ts --slug "smith-2026" --file guests.json
 *   npx tsx scripts/seed.ts --slug "smith-2026" --file guests.csv
 *   npx tsx scripts/seed.ts --demo
 *
 * JSON format: [{"name": "John Smith", "table": "1"}, ...]
 * CSV format:  name,table (first row is header)
 *
 * Options:
 *   --slug   Event slug (required unless --demo)
 *   --file   Path to JSON or CSV file with guest data
 *   --demo   Create a sample event with demo guests
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { db } from "../src/db";
import { events, guests } from "../src/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value && !value.startsWith("--")) {
        args[key] = value;
        i++;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Guest data types
// ---------------------------------------------------------------------------
interface GuestInput {
  name: string;
  table?: string | null;
}

// ---------------------------------------------------------------------------
// Name normalization: lowercase, collapse whitespace, trim
// ---------------------------------------------------------------------------
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// File parsers
// ---------------------------------------------------------------------------
function parseJsonFile(filePath: string): GuestInput[] {
  const raw = readFileSync(resolve(filePath), "utf-8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data)) {
    throw new Error("JSON file must contain an array of guest objects.");
  }

  return data.map((item: Record<string, unknown>, idx: number) => {
    if (typeof item.name !== "string" || !item.name.trim()) {
      throw new Error(`Guest at index ${idx} is missing a valid "name" field.`);
    }
    return {
      name: item.name.trim(),
      table: typeof item.table === "string" || typeof item.table === "number"
        ? String(item.table)
        : null,
    };
  });
}

function parseCsvFile(filePath: string): GuestInput[] {
  const raw = readFileSync(resolve(filePath), "utf-8");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error("CSV file must have a header row and at least one data row.");
  }

  // Skip header
  const dataLines = lines.slice(1);
  return dataLines.map((line, idx) => {
    // Simple CSV: split on first comma
    const commaIdx = line.indexOf(",");
    if (commaIdx === -1) {
      // No comma — entire line is the name
      return { name: line.trim(), table: null };
    }
    const name = line.slice(0, commaIdx).trim();
    const table = line.slice(commaIdx + 1).trim() || null;
    if (!name) {
      throw new Error(`CSV row ${idx + 2} has an empty name.`);
    }
    return { name, table };
  });
}

function parseFile(filePath: string): GuestInput[] {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".json")) {
    return parseJsonFile(filePath);
  }
  if (lower.endsWith(".csv")) {
    return parseCsvFile(filePath);
  }
  throw new Error(`Unsupported file type. Use .json or .csv. Got: ${filePath}`);
}

// ---------------------------------------------------------------------------
// Seed guests for an existing event
// ---------------------------------------------------------------------------
function seedGuests(eventId: number, guestInputs: GuestInput[]): number {
  const values = guestInputs.map((g) => ({
    eventId,
    name: g.name,
    normalizedName: normalizeName(g.name),
    tableNumber: g.table ?? null,
    createdAt: new Date(),
  }));

  db.insert(guests).values(values).run();

  return values.length;
}

// ---------------------------------------------------------------------------
// Demo mode: create sample event + guests
// ---------------------------------------------------------------------------
const DEMO_GUESTS: GuestInput[] = [
  { name: "Emma Johnson", table: "1" },
  { name: "Liam Williams", table: "1" },
  { name: "Olivia Brown", table: "2" },
  { name: "Noah Davis", table: "2" },
  { name: "Ava Martinez", table: "3" },
  { name: "Sophia Garcia", table: "3" },
  { name: "Mason Wilson", table: "4" },
  { name: "Isabella Anderson", table: "4" },
  { name: "Ethan Taylor", table: "5" },
  { name: "Mia Thomas", table: "5" },
];

async function seedDemo() {
  const demoSlug = "demo-wedding";
  const demoPassword = "demo123";

  // Check if demo event already exists
  const existing = db
    .select()
    .from(events)
    .where(eq(events.slug, demoSlug))
    .get();

  if (existing) {
    console.log(`Demo event "${demoSlug}" already exists (id=${existing.id}). Skipping event creation.`);

    // Still insert guests
    const count = seedGuests(existing.id, DEMO_GUESTS);
    console.log(`Inserted ${count} demo guests into existing event.`);
    return;
  }

  const adminPasswordHash = await bcrypt.hash(demoPassword, 10);

  const event = db
    .insert(events)
    .values({
      name: "Demo Wedding",
      slug: demoSlug,
      adminPasswordHash,
      shotLimit: 5,
      status: "active",
      termsText:
        "This is a demo event. By participating you agree to keep content appropriate and respectful.",
      createdAt: new Date(),
    })
    .returning()
    .get();

  console.log(`Created demo event: "${event.name}" (slug: ${event.slug}, id: ${event.id})`);
  console.log(`  Admin password: ${demoPassword}`);

  const count = seedGuests(event.id, DEMO_GUESTS);
  console.log(`Inserted ${count} demo guests.`);
  console.log("");
  console.log(`  Event URL:  /event/${event.slug}`);
  console.log(`  Admin URL:  /event/${event.slug}/admin`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv);

  // Demo mode
  if (args["demo"] === "true") {
    await seedDemo();
    return;
  }

  const slug = args["slug"];
  const filePath = args["file"];

  if (!slug || !filePath) {
    console.error("Usage: npx tsx scripts/seed.ts --slug <event-slug> --file <guests.json|guests.csv>");
    console.error("       npx tsx scripts/seed.ts --demo");
    console.error("");
    console.error("Options:");
    console.error("  --slug   Event slug (required)");
    console.error("  --file   Path to JSON or CSV file");
    console.error("  --demo   Create a demo event with sample guests");
    process.exit(1);
  }

  // Look up the event
  const event = db
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .get();

  if (!event) {
    console.error(`Error: No event found with slug "${slug}".`);
    console.error("Create the event first with: npx tsx scripts/create-event.ts");
    process.exit(1);
  }

  // Parse the guest file
  const guestInputs = parseFile(filePath);

  if (guestInputs.length === 0) {
    console.error("Error: No guests found in the file.");
    process.exit(1);
  }

  // Insert guests
  const count = seedGuests(event.id, guestInputs);
  console.log(`Successfully inserted ${count} guests into event "${event.name}" (slug: ${event.slug}).`);
}

main();
