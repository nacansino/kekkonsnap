import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, photos } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getSessionFromCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { processUploadedPhoto } from "@/lib/image-processing";
import { savePhoto } from "@/lib/storage";
import { RATE_LIMITS } from "@/lib/constants";
import createLogger from "@/lib/logger";

const log = createLogger("photos");
import { emitEventChange } from "@/lib/event-emitter";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;

  // Auth check
  const session = await getSessionFromCookie(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Look up event and check status
  const event = await db
    .select()
    .from(events)
    .where(eq(events.id, session.eventId))
    .get();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status !== "active") {
    return NextResponse.json(
      { error: "Event is not accepting photos" },
      { status: 403 }
    );
  }

  // Check photo quota
  const photoCountResult = await db
    .select({ count: count() })
    .from(photos)
    .where(
      and(
        eq(photos.eventId, session.eventId),
        eq(photos.guestId, session.guestId)
      )
    )
    .get();

  const currentCount = photoCountResult?.count ?? 0;
  if (currentCount >= event.shotLimit) {
    return NextResponse.json(
      { error: "Photo quota exceeded. You have reached your limit." },
      { status: 429 }
    );
  }

  // Rate limit per session
  const { allowed, resetAt } = rateLimit(
    `photo-upload:${session.sessionId}`,
    RATE_LIMITS.PHOTO_UPLOAD.limit,
    RATE_LIMITS.PHOTO_UPLOAD.windowMs
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Please wait before uploading another photo." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) },
      }
    );
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("photo") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  }

  // Convert File to Buffer
  const buffer = Buffer.from(await file.arrayBuffer());

  // Process image
  let processed;
  try {
    processed = await processUploadedPhoto(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image processing failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Save to storage
  const fileId = uuidv4();
  const { storagePath, thumbnailPath } = await savePhoto(
    event.id,
    fileId,
    processed.full,
    processed.thumb
  );

  // Insert photo record
  const now = new Date();
  const photoRecord = await db
    .insert(photos)
    .values({
      eventId: event.id,
      guestId: session.guestId,
      sessionId: session.sessionId,
      originalFilename: file.name ?? null,
      storagePath,
      thumbnailPath,
      mimeType: processed.mimeType,
      fileSize: processed.full.length,
      width: processed.width,
      height: processed.height,
      isWinner: false,
      capturedAt: now,
      createdAt: now,
    })
    .returning()
    .get();

  // Emit event for SSE clients
  const totalPhotosResult = await db
    .select({ count: count() })
    .from(photos)
    .where(eq(photos.eventId, event.id))
    .get();

  log.info("Photo uploaded", {
    photoId: photoRecord.id,
    guestId: session.guestId,
    event: slug,
    size: `${(processed.full.length / 1024).toFixed(0)}KB`,
  });

  emitEventChange({
    slug,
    type: "photo_uploaded",
    status: event.status as "active" | "locked" | "announced",
    photoCount: totalPhotosResult?.count ?? 0,
  });

  return NextResponse.json(
    {
      id: photoRecord.id,
      thumbnailUrl: `/api/photos/${photoRecord.id}/thumb`,
    },
    { status: 201 }
  );
}
