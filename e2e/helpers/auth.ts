import { type Browser, type BrowserContext } from "@playwright/test";
import { TEST_EVENT, TEST_GUESTS } from "../global-setup";

const BASE_URL = "http://localhost:3000";

/** Cache session cookies to avoid hitting rate limits */
const sessionCache = new Map<string, string>();

/**
 * Fetch the guest list and return the first guest matching `name`.
 */
async function getGuestId(slug: string, name: string): Promise<number> {
  const res = await fetch(`${BASE_URL}/api/events/${slug}/guests`);
  if (!res.ok) throw new Error(`Failed to fetch guests: ${res.status}`);
  const guests: Array<{ id: number; name: string }> = await res.json();
  const guest = guests.find((g) => g.name === name);
  if (!guest) throw new Error(`Guest "${name}" not found`);
  return guest.id;
}

/**
 * Get or create a session cookie for a guest (identified only, terms not agreed).
 */
async function getIdentifiedCookie(guestName: string): Promise<string> {
  const cacheKey = `identified:${guestName}`;
  const cached = sessionCache.get(cacheKey);
  if (cached) return cached;

  const slug = TEST_EVENT.slug;
  const guestId = await getGuestId(slug, guestName);

  const identifyRes = await fetch(
    `${BASE_URL}/api/events/${slug}/identify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId }),
    }
  );

  if (!identifyRes.ok) {
    throw new Error(`Identify failed: ${await identifyRes.text()}`);
  }

  const setCookieHeader = identifyRes.headers
    .getSetCookie()
    .find((c) => c.startsWith("kekkonsnap-session="));

  if (!setCookieHeader) {
    throw new Error("No session cookie returned from identify");
  }

  const cookieValue = setCookieHeader.split("=")[1].split(";")[0];
  sessionCache.set(cacheKey, cookieValue);
  return cookieValue;
}

/**
 * Get or create a session cookie for a guest (identified + terms agreed).
 */
async function getAuthedCookie(guestName: string): Promise<string> {
  const cacheKey = `authed:${guestName}`;
  const cached = sessionCache.get(cacheKey);
  if (cached) return cached;

  const slug = TEST_EVENT.slug;
  const guestId = await getGuestId(slug, guestName);

  // Step 1: Identify
  const identifyRes = await fetch(
    `${BASE_URL}/api/events/${slug}/identify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId }),
    }
  );

  if (!identifyRes.ok) {
    throw new Error(`Identify failed: ${await identifyRes.text()}`);
  }

  const setCookieHeader = identifyRes.headers
    .getSetCookie()
    .find((c) => c.startsWith("kekkonsnap-session="));

  if (!setCookieHeader) {
    throw new Error("No session cookie returned from identify");
  }

  const rawCookie = setCookieHeader.split(";")[0]; // "kekkonsnap-session=<token>"
  const cookieValue = rawCookie.split("=")[1];

  // Step 2: Agree to terms
  const agreeRes = await fetch(`${BASE_URL}/api/events/${slug}/agree`, {
    method: "POST",
    headers: { Cookie: rawCookie },
  });

  if (!agreeRes.ok) {
    throw new Error(`Agree failed: ${await agreeRes.text()}`);
  }

  sessionCache.set(cacheKey, cookieValue);
  return cookieValue;
}

/**
 * Create an authenticated browser context for a guest who has identified
 * but NOT yet agreed to terms.
 */
export async function createIdentifiedContext(
  browser: Browser,
  guestName: string = TEST_GUESTS[0].name
): Promise<BrowserContext> {
  const cookieValue = await getIdentifiedCookie(guestName);

  const context = await browser.newContext();
  await context.addCookies([
    {
      name: "kekkonsnap-session",
      value: cookieValue,
      domain: "localhost",
      path: "/",
    },
  ]);

  return context;
}

/**
 * Create an authenticated browser context for a guest who has identified
 * AND agreed to terms (ready for camera/photos/winner pages).
 */
export async function createAuthedContext(
  browser: Browser,
  guestName: string = TEST_GUESTS[0].name
): Promise<BrowserContext> {
  const cookieValue = await getAuthedCookie(guestName);

  const context = await browser.newContext();
  await context.addCookies([
    {
      name: "kekkonsnap-session",
      value: cookieValue,
      domain: "localhost",
      path: "/",
    },
  ]);

  return context;
}
