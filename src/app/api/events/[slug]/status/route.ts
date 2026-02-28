import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, photos, guests } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionFromCookie } from "@/lib/auth";
import { eventEmitter, EventChangePayload } from "@/lib/event-emitter";
import { SSE_HEARTBEAT_INTERVAL_MS } from "@/lib/constants";
import { checkScheduledLocks } from "@/lib/schedule-checker";

export async function GET(
  request: NextRequest,
  _context: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await _context.params;

  const session = await getSessionFromCookie(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Look up event for initial state
  const event = await db
    .select()
    .from(events)
    .where(eq(events.id, session.eventId))
    .get();

  if (!event || event.slug !== slug) {
    return NextResponse.json({ error: "Event not found or session mismatch" }, { status: 404 });
  }

  // Look up winner details if present
  let winnerGuestName: string | undefined;
  let winnerPhotoUrl: string | undefined;

  if (event.winnerPhotoId) {
    const winnerData = await db
      .select({
        guestName: guests.name,
      })
      .from(photos)
      .innerJoin(guests, eq(photos.guestId, guests.id))
      .where(eq(photos.id, event.winnerPhotoId))
      .get();

    if (winnerData) {
      winnerGuestName = winnerData.guestName;
      winnerPhotoUrl = `/api/photos/${event.winnerPhotoId}/full`;
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial state
      const initialData = JSON.stringify({
        type: "initial",
        status: event.status,
        winnerPhotoId: event.winnerPhotoId,
        winnerGuestName,
        winnerPhotoUrl,
      });
      controller.enqueue(encoder.encode(`data: ${initialData}\n\n`));

      // Listen for event changes matching this slug
      const onEventChange = (payload: EventChangePayload) => {
        if (payload.slug !== slug) return;
        try {
          const data = JSON.stringify(payload);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Stream may be closed
        }
      };

      eventEmitter.on("eventChange", onEventChange);

      // Heartbeat to keep connection alive + check scheduled locks
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          checkScheduledLocks().catch(() => {});
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, SSE_HEARTBEAT_INTERVAL_MS);

      // Clean up on client disconnect
      request.signal.addEventListener("abort", () => {
        eventEmitter.off("eventChange", onEventChange);
        clearInterval(heartbeatInterval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
