import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, guests, photos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionFromCookie } from "@/lib/auth";

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  const session = await getSessionFromCookie(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check event status
  const event = await db
    .select()
    .from(events)
    .where(eq(events.id, session.eventId))
    .get();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status !== "announced") {
    return NextResponse.json(
      { error: "Photos are not yet available for viewing" },
      { status: 403 }
    );
  }

  // Get all photos with guest name attribution
  const allPhotos = await db
    .select({
      id: photos.id,
      thumbnailPath: photos.thumbnailPath,
      isWinner: photos.isWinner,
      createdAt: photos.createdAt,
      guestName: guests.name,
    })
    .from(photos)
    .innerJoin(guests, eq(photos.guestId, guests.id))
    .where(eq(photos.eventId, session.eventId))
    .all();

  const result = allPhotos.map((p) => ({
    id: p.id,
    thumbnailUrl: `/api/photos/${p.id}/thumb`,
    fullUrl: `/api/photos/${p.id}/full`,
    guestName: p.guestName,
    isWinner: p.isWinner,
    capturedAt: p.createdAt,
  }));

  return NextResponse.json({ photos: result });
}
