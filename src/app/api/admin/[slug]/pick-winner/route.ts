import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, photos } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAdminFromCookie } from "@/lib/admin-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;

  // Auth check
  const admin = await getAdminFromCookie(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Parse body
  let body: { photoId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { photoId } = body;
  if (!photoId || typeof photoId !== "number") {
    return NextResponse.json(
      { error: "photoId is required and must be a number." },
      { status: 400 }
    );
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

  // Event must be "locked" to pick a winner
  if (event.status !== "locked") {
    return NextResponse.json(
      { error: "Event must be locked before picking a winner." },
      { status: 409 }
    );
  }

  // Verify photo belongs to this event
  const photo = await db
    .select()
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.eventId, event.id)))
    .get();

  if (!photo) {
    return NextResponse.json(
      { error: "Photo not found in this event." },
      { status: 404 }
    );
  }

  // Clear any previous winners (set isWinner = false on all event photos)
  await db
    .update(photos)
    .set({ isWinner: false })
    .where(eq(photos.eventId, event.id))
    .run();

  // Set isWinner = true on selected photo
  await db
    .update(photos)
    .set({ isWinner: true })
    .where(eq(photos.id, photoId))
    .run();

  // Set event.winnerPhotoId
  await db
    .update(events)
    .set({ winnerPhotoId: photoId })
    .where(eq(events.id, event.id))
    .run();

  return NextResponse.json({ success: true, photoId });
}
