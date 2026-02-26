import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, photos } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAdminFromCookie } from "@/lib/admin-auth";
import { getPhotoBuffer } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; photoId: string }> }
): Promise<NextResponse> {
  const { slug, photoId: photoIdStr } = await params;
  const photoId = parseInt(photoIdStr, 10);

  if (isNaN(photoId)) {
    return NextResponse.json(
      { error: "Invalid photo ID." },
      { status: 400 }
    );
  }

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

  // Look up photo
  const photo = await db
    .select()
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.eventId, event.id)))
    .get();

  if (!photo) {
    return NextResponse.json(
      { error: "Photo not found." },
      { status: 404 }
    );
  }

  // Read full-res photo from storage
  let buffer: Buffer;
  try {
    buffer = await getPhotoBuffer(photo.storagePath);
  } catch {
    return NextResponse.json(
      { error: "Photo file not found on disk." },
      { status: 404 }
    );
  }

  const filename = `photo-${photo.id}.webp`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length.toString(),
    },
  });
}
