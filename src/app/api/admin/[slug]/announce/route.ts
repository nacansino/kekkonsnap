import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, photos, guests } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAdminFromCookie } from "@/lib/admin-auth";
import createLogger from "@/lib/logger";

const log = createLogger("admin");
import { emitEventChange } from "@/lib/event-emitter";

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

  // Verify event exists and belongs to this admin
  const event = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), eq(events.id, admin.eventId)))
    .get();

  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  // Event must be "locked" and have a winnerPhotoId
  if (event.status !== "locked") {
    return NextResponse.json(
      { error: "Event must be locked before announcing a winner." },
      { status: 409 }
    );
  }

  if (!event.winnerPhotoId) {
    return NextResponse.json(
      { error: "A winner must be selected before announcing." },
      { status: 409 }
    );
  }

  // Look up winner photo's guest name
  const winnerData = await db
    .select({
      photo: {
        id: photos.id,
        storagePath: photos.storagePath,
      },
      guest: {
        name: guests.name,
      },
    })
    .from(photos)
    .innerJoin(guests, eq(photos.guestId, guests.id))
    .where(eq(photos.id, event.winnerPhotoId))
    .get();

  if (!winnerData) {
    return NextResponse.json(
      { error: "Winner photo data not found." },
      { status: 500 }
    );
  }

  // Update event status to "announced"
  await db
    .update(events)
    .set({
      status: "announced",
      announcedAt: new Date(),
    })
    .where(eq(events.id, event.id))
    .run();

  log.info("Winner announced", { event: slug, winner: winnerData.guest.name, photoId: event.winnerPhotoId });

  // Emit event change
  emitEventChange({
    slug,
    type: "winner_announced",
    status: "announced",
    winnerPhotoId: event.winnerPhotoId,
    winnerGuestName: winnerData.guest.name,
    winnerPhotoUrl: `/api/photos/${event.winnerPhotoId}/full`,
  });

  return NextResponse.json({ success: true });
}
