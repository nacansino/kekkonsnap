import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, photos } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAdminFromCookie } from "@/lib/admin-auth";
import createLogger from "@/lib/logger";
import { emitEventChange } from "@/lib/event-emitter";

const log = createLogger("admin");

const VALID_STATUSES = ["active", "locked", "announced"] as const;
type EventStatus = (typeof VALID_STATUSES)[number];

const VALID_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
    active: ["locked"],
    locked: ["active", "announced"],
    announced: ["locked"],
};

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

    // Parse body
    let body: { status?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const newStatus = body.status as EventStatus;
    if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
        return NextResponse.json(
            { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
            { status: 400 }
        );
    }

    const currentStatus = event.status as EventStatus;

    // Check valid transitions
    if (!VALID_TRANSITIONS[currentStatus]?.includes(newStatus)) {
        return NextResponse.json(
            {
                error: `Cannot transition from "${currentStatus}" to "${newStatus}". Valid transitions: ${VALID_TRANSITIONS[currentStatus]?.join(", ") ?? "none"}.`,
            },
            { status: 409 }
        );
    }

    // If going back to active: clear the winner on both the event and all photos
    if (newStatus === "active") {
        await db
            .update(events)
            .set({ status: "active", winnerPhotoId: null })
            .where(eq(events.id, event.id))
            .run();

        // Clear isWinner flag on all photos for this event
        await db
            .update(photos)
            .set({ isWinner: false })
            .where(eq(photos.eventId, event.id))
            .run();
    } else {
        await db
            .update(events)
            .set({ status: newStatus })
            .where(eq(events.id, event.id))
            .run();
    }

    log.info("Event status changed", {
        event: slug,
        from: currentStatus,
        to: newStatus,
    });

    // Emit event change for SSE clients
    emitEventChange({
        slug,
        type: "status_change",
        status: newStatus,
    });

    return NextResponse.json({
        success: true,
        previousStatus: currentStatus,
        newStatus,
    });
}
