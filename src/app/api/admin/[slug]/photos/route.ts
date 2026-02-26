import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, photos, guests } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
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

  // Join photos with guests and return sorted by createdAt desc
  const results = await db
    .select({
      photo: {
        id: photos.id,
        thumbnailPath: photos.thumbnailPath,
        storagePath: photos.storagePath,
        isWinner: photos.isWinner,
        capturedAt: photos.capturedAt,
        fileSize: photos.fileSize,
        guestId: photos.guestId,
      },
      guest: {
        name: guests.name,
        id: guests.id,
      },
    })
    .from(photos)
    .innerJoin(guests, eq(photos.guestId, guests.id))
    .where(eq(photos.eventId, event.id))
    .orderBy(desc(photos.createdAt))
    .all();

  const photoList = results.map((row) => ({
    id: row.photo.id,
    thumbnailUrl: `/api/photos/${row.photo.id}/thumb`,
    fullUrl: `/api/photos/${row.photo.id}/full`,
    guestName: row.guest.name,
    guestId: row.guest.id,
    isWinner: row.photo.isWinner,
    capturedAt: row.photo.capturedAt,
    fileSize: row.photo.fileSize,
  }));

  return NextResponse.json({ photos: photoList });
}
