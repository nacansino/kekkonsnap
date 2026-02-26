import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, photos, guests } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAdminFromCookie } from "@/lib/admin-auth";
import { getPhotoBuffer } from "@/lib/storage";
import archiver from "archiver";
import { Readable, PassThrough } from "stream";

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

  // Get all photos with guest names
  const results = await db
    .select({
      photo: {
        id: photos.id,
        storagePath: photos.storagePath,
        guestId: photos.guestId,
      },
      guest: {
        name: guests.name,
      },
    })
    .from(photos)
    .innerJoin(guests, eq(photos.guestId, guests.id))
    .where(eq(photos.eventId, event.id))
    .all();

  // Create ZIP archive streamed directly to response
  const archive = archiver("zip", { zlib: { level: 5 } });
  const passThrough = new PassThrough();

  archive.pipe(passThrough);

  // Add each photo to the archive organized as {guestName}/{photoId}.webp
  for (const row of results) {
    try {
      const buffer = await getPhotoBuffer(row.photo.storagePath);
      const safeName = row.guest.name.replace(/[^a-zA-Z0-9_\-\s]/g, "_");
      const filePath = `${safeName}/${row.photo.id}.webp`;
      archive.append(buffer, { name: filePath });
    } catch {
      // Skip photos that can't be read
      continue;
    }
  }

  // Finalize the archive (no more files will be added)
  archive.finalize();

  // Convert the PassThrough stream to a ReadableStream for the Response
  const readableStream = Readable.toWeb(passThrough) as ReadableStream;

  const safeName = event.name.replace(/[^a-zA-Z0-9_\-\s]/g, "_");
  const filename = `${safeName}-photos.zip`;

  return new NextResponse(readableStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Transfer-Encoding": "chunked",
    },
  });
}
