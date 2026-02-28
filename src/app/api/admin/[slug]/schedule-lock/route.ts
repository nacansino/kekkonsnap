import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAdminFromCookie } from "@/lib/admin-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;

  const admin = await getAdminFromCookie(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const event = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), eq(events.id, admin.eventId)))
    .get();

  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const body = await request.json();
  const { lockAt } = body as { lockAt: string | null };

  // Clear schedule
  if (lockAt === null) {
    await db
      .update(events)
      .set({ scheduledLockAt: null })
      .where(eq(events.id, event.id));

    return NextResponse.json({ scheduledLockAt: null });
  }

  // Validate event is active
  if (event.status !== "active") {
    return NextResponse.json(
      { error: "Can only schedule lock for active events." },
      { status: 400 }
    );
  }

  // Validate timestamp
  const lockDate = new Date(lockAt);
  if (isNaN(lockDate.getTime())) {
    return NextResponse.json(
      { error: "Invalid date format." },
      { status: 400 }
    );
  }

  if (lockDate.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Scheduled time must be in the future." },
      { status: 400 }
    );
  }

  await db
    .update(events)
    .set({ scheduledLockAt: lockDate })
    .where(eq(events.id, event.id));

  return NextResponse.json({ scheduledLockAt: lockDate.toISOString() });
}
