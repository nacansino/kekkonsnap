#!/usr/bin/env tsx
/**
 * CLI script to create a new event in the kekkonsnap database.
 *
 * Usage:
 *   npx tsx scripts/create-event.ts --name "Smith Wedding" --slug "smith-2026" --password "secret123"
 *
 * Options:
 *   --name        Event name (required)
 *   --slug        URL slug (required, must be unique)
 *   --password    Admin password (required, will be hashed with bcrypt)
 *   --shot-limit  Max photos per guest (default: 5)
 *   --terms       Custom terms text (default: standard text)
 */

import { db } from "../src/db";
import { events } from "../src/db/schema";
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

const DEFAULT_TERMS = `By participating in this photo contest, you agree to:
1. Grant the event organizers a non-exclusive license to display submitted photos.
2. Only upload photos you have taken yourself.
3. Respect the privacy of other guests.
4. Keep content family-friendly and appropriate.`;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv);

  const name = args["name"];
  const slug = args["slug"];
  const password = args["password"];
  const shotLimit = parseInt(args["shot-limit"] ?? "5", 10);
  const termsText = args["terms"] ?? DEFAULT_TERMS;

  if (!name || !slug || !password) {
    console.error("Usage: npx tsx scripts/create-event.ts --name <name> --slug <slug> --password <password>");
    console.error("");
    console.error("Required:");
    console.error("  --name        Event name");
    console.error("  --slug        URL slug (must be unique)");
    console.error("  --password    Admin password");
    console.error("");
    console.error("Optional:");
    console.error("  --shot-limit  Max photos per guest (default: 5)");
    console.error("  --terms       Custom terms text");
    process.exit(1);
  }

  // Validate slug format
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    console.error(`Error: slug "${slug}" is invalid. Use lowercase letters, numbers, and hyphens (e.g. "smith-2026").`);
    process.exit(1);
  }

  // Hash the password
  const adminPasswordHash = await bcrypt.hash(password, 10);

  try {
    const inserted = db
      .insert(events)
      .values({
        name,
        slug,
        adminPasswordHash,
        shotLimit,
        status: "active",
        termsText,
        createdAt: new Date(),
      })
      .returning()
      .get();

    console.log("");
    console.log("Event created successfully!");
    console.log("---------------------------");
    console.log(`  Name:       ${inserted.name}`);
    console.log(`  Slug:       ${inserted.slug}`);
    console.log(`  ID:         ${inserted.id}`);
    console.log(`  Shot limit: ${inserted.shotLimit}`);
    console.log(`  Status:     ${inserted.status}`);
    console.log("");
    console.log(`  Event URL:  /${inserted.slug}`);
    console.log(`  Admin URL:  /admin/${inserted.slug}`);
    console.log("");
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
      console.error(`Error: An event with slug "${slug}" already exists.`);
      process.exit(1);
    }
    throw error;
  }
}

main();
