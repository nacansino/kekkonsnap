import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, guests, photos } from "@/db/schema";
import { eq, and, count, sql } from "drizzle-orm";
import { getAdminFromCookie } from "@/lib/admin-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;

  // Auth check
  const admin = await getAdminFromCookie(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Verify event exists and belongs to this admin
  const event = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), eq(events.id, admin.eventId)))
    .get();

  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  // Total photos for this event
  const totalPhotosResult = await db
    .select({ count: count(photos.id) })
    .from(photos)
    .where(eq(photos.eventId, event.id))
    .get();
  const totalPhotos = totalPhotosResult?.count ?? 0;

  // Total guests for this event
  const totalGuestsResult = await db
    .select({ count: count(guests.id) })
    .from(guests)
    .where(eq(guests.eventId, event.id))
    .get();
  const totalGuests = totalGuestsResult?.count ?? 0;

  // Participating guests (with at least 1 photo)
  const participatingResult = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${photos.guestId})` })
    .from(photos)
    .where(eq(photos.eventId, event.id))
    .get();
  const participatingGuests = participatingResult?.count ?? 0;

  // Average photos per participating guest
  const photosPerGuest =
    participatingGuests > 0
      ? Math.round((totalPhotos / participatingGuests) * 100) / 100
      : 0;

  return NextResponse.json({
    totalPhotos,
    totalGuests,
    participatingGuests,
    photosPerGuest,
    eventStatus: event.status,
  });
}
