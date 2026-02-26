import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events } from "@/db/schema";
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

  // Event must be "active" to lock
  if (event.status !== "active") {
    return NextResponse.json(
      { error: "Event can only be locked when it is active." },
      { status: 409 }
    );
  }

  // Update event status to "locked"
  await db
    .update(events)
    .set({
      status: "locked",
      lockedAt: new Date(),
    })
    .where(eq(events.id, event.id))
    .run();

  log.info("Event locked", { event: slug });

  // Emit event change
  emitEventChange({
    slug,
    type: "status_change",
    status: "locked",
  });

  return NextResponse.json({ success: true });
}
