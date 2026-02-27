import { readFileSync } from "fs";
import { resolve } from "path";
import type { FullConfig } from "@playwright/test";

// Load .env file since Playwright global setup doesn't auto-load it
function loadEnv() {
  try {
    const envPath = resolve(__dirname, "../.env");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex);
      const value = trimmed.slice(eqIndex + 1);
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file may not exist, that's fine
  }
}

loadEnv();

const BASE_URL = "http://localhost:3000";
const ADMIN_PASSWORD = process.env.ADMIN_MASTER_PASSWORD ?? "kekkonsnap-admin";
const EVENT_PASSWORD = "e2e-test-password";

export const TEST_EVENT = {
  name: "E2E Test Wedding",
  slug: "e2e-test",
  password: EVENT_PASSWORD,
  shotLimit: 5,
};

export const TEST_GUESTS = [
  { name: "Alice Johnson" },
  { name: "Bob Smith" },
  { name: "Charlie Brown" },
  { name: "Diana Prince" },
  { name: "Edward Norton" },
];

async function globalSetup(_config: FullConfig) {
  // 1. Clean up any existing test event
  await fetch(`${BASE_URL}/api/admin/events`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": ADMIN_PASSWORD,
    },
    body: JSON.stringify({ slug: TEST_EVENT.slug }),
  });

  // 2. Create the test event
  const createRes = await fetch(`${BASE_URL}/api/admin/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": ADMIN_PASSWORD,
    },
    body: JSON.stringify(TEST_EVENT),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create test event: ${err}`);
  }

  // 3. Log in as admin to get cookie for guest seeding
  const loginRes = await fetch(
    `${BASE_URL}/api/admin/${TEST_EVENT.slug}/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: EVENT_PASSWORD }),
    }
  );

  if (!loginRes.ok) {
    const err = await loginRes.text();
    throw new Error(`Failed to admin login: ${err}`);
  }

  const adminCookie = loginRes.headers
    .getSetCookie()
    .find((c) => c.startsWith("kekkonsnap-admin="));

  if (!adminCookie) {
    throw new Error("No admin cookie returned from login");
  }

  // 4. Seed test guests
  const guestsRes = await fetch(
    `${BASE_URL}/api/admin/${TEST_EVENT.slug}/guests`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie.split(";")[0],
      },
      body: JSON.stringify({ guests: TEST_GUESTS }),
    }
  );

  if (!guestsRes.ok) {
    const err = await guestsRes.text();
    throw new Error(`Failed to seed guests: ${err}`);
  }

  console.log(
    `[e2e] Test event "${TEST_EVENT.slug}" created with ${TEST_GUESTS.length} guests`
  );
}

export default globalSetup;
