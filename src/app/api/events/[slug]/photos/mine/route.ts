import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, photos } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionFromCookie } from "@/lib/auth";

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  const session = await getSessionFromCookie(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the event's shot limit
  const event = await db
    .select({ shotLimit: events.shotLimit })
    .from(events)
    .where(eq(events.id, session.eventId))
    .get();

  const myPhotos = await db
    .select({
      id: photos.id,
      thumbnailPath: photos.thumbnailPath,
      createdAt: photos.createdAt,
    })
    .from(photos)
    .where(
      and(
        eq(photos.eventId, session.eventId),
        eq(photos.guestId, session.guestId)
      )
    )
    .all();

  const result = myPhotos.map((p) => ({
    id: p.id,
    thumbnailUrl: `/api/photos/${p.id}/thumb`,
    createdAt: p.createdAt,
  }));

  return NextResponse.json({
    photos: result,
    count: result.length,
    shotLimit: event?.shotLimit ?? 5,
  });
}
