import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, guests, sessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { signSessionToken, setSessionCookie } from "@/lib/auth";
import { rateLimitByIP } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import createLogger from "@/lib/logger";

const log = createLogger("identify");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;

  // Rate limit by IP
  const { allowed, resetAt } = rateLimitByIP(
    request,
    "guest-identify",
    RATE_LIMITS.GUEST_IDENTIFY.limit,
    RATE_LIMITS.GUEST_IDENTIFY.windowMs
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) },
      }
    );
  }

  // Look up event
  const event = await db
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .get();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Parse body
  let body: { guestId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof body.guestId !== "number") {
    return NextResponse.json({ error: "guestId is required and must be a number" }, { status: 400 });
  }

  // Validate guest belongs to this event
  const guest = await db
    .select()
    .from(guests)
    .where(and(eq(guests.id, body.guestId), eq(guests.eventId, event.id)))
    .get();

  if (!guest) {
    return NextResponse.json({ error: "Guest not found for this event" }, { status: 404 });
  }

  // Create session
  const sessionId = uuidv4();
  const now = new Date();

  await db
    .insert(sessions)
    .values({
      id: sessionId,
      eventId: event.id,
      guestId: guest.id,
      agreedToTerms: false,
      userAgent: request.headers.get("user-agent") ?? null,
      createdAt: now,
      lastActiveAt: now,
    })
    .execute();

  // Sign JWT
  const token = await signSessionToken({
    sessionId,
    guestId: guest.id,
    eventId: event.id,
  });

  log.info("Guest identified", { guest: guest.name, event: slug, sessionId });

  // Build response with cookie
  const response = NextResponse.json({
    sessionId,
    guestName: guest.name,
    shotLimit: event.shotLimit,
  });

  setSessionCookie(response, token);

  return response;
}
