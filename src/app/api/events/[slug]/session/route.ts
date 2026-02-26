import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, guests, sessions, photos } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { getSessionFromCookie } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  _context: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await _context.params;

  const sessionPayload = await getSessionFromCookie(request);
  if (!sessionPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Look up session record
  const sessionRecord = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionPayload.sessionId))
    .get();

  if (!sessionRecord) {
    return NextResponse.json({ error: "Session not found" }, { status: 401 });
  }

  // Look up guest
  const guest = await db
    .select()
    .from(guests)
    .where(eq(guests.id, sessionPayload.guestId))
    .get();

  if (!guest) {
    return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  }

  // Look up event
  const event = await db
    .select()
    .from(events)
    .where(eq(events.id, sessionPayload.eventId))
    .get();

  if (!event || event.slug !== slug) {
    return NextResponse.json({ error: "Event not found or session mismatch" }, { status: 401 });
  }

  // Count photos for this guest in this event
  const photoCountResult = await db
    .select({ count: count() })
    .from(photos)
    .where(
      and(
        eq(photos.eventId, sessionPayload.eventId),
        eq(photos.guestId, sessionPayload.guestId)
      )
    )
    .get();

  const photosCount = photoCountResult?.count ?? 0;

  return NextResponse.json({
    guestId: guest.id,
    guestName: guest.name,
    eventId: event.id,
    eventSlug: event.slug,
    shotLimit: event.shotLimit,
    photosCount,
    agreedToTerms: sessionRecord.agreedToTerms,
    eventStatus: event.status,
  });
}
