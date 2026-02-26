import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, photos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionFromCookie } from "@/lib/auth";
import { getAdminFromCookie } from "@/lib/admin-auth";
import { getPhotoBuffer } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const photoId = parseInt(id, 10);
  if (isNaN(photoId)) {
    return NextResponse.json({ error: "Invalid photo ID" }, { status: 400 });
  }

  // Check for guest session OR admin cookie
  const session = await getSessionFromCookie(request);
  const admin = await getAdminFromCookie(request);

  if (!session && !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Look up photo
  const photo = await db
    .select()
    .from(photos)
    .where(eq(photos.id, photoId))
    .get();

  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  // Admin can see all photos for their event
  if (admin) {
    if (photo.eventId !== admin.eventId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  } else if (session) {
    // Guest access control: own photo always OK; all photos if event is "announced"
    const event = await db
      .select()
      .from(events)
      .where(eq(events.id, photo.eventId))
      .get();

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const isOwnPhoto = photo.guestId === session.guestId;
    const isAnnounced = event.status === "announced";

    if (!isOwnPhoto && !isAnnounced) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  // Read file from storage
  const buffer = await getPhotoBuffer(photo.storagePath);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": photo.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(buffer.length),
    },
  });
}

