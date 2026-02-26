import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import createLogger from "@/lib/logger";

const log = createLogger("admin");

// Require a master admin password for creating events
// Set via ADMIN_MASTER_PASSWORD env var, defaults to "kekkonsnap-admin" in dev
function getMasterPassword(): string {
    return process.env.ADMIN_MASTER_PASSWORD ?? "kekkonsnap-admin";
}

/**
 * GET /api/admin/events — List all events (requires master password via header)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
    const authHeader = request.headers.get("x-admin-password");
    if (!authHeader || authHeader !== getMasterPassword()) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const allEvents = await db
        .select({
            id: events.id,
            name: events.name,
            slug: events.slug,
            status: events.status,
            shotLimit: events.shotLimit,
            createdAt: events.createdAt,
        })
        .from(events)
        .all();

    return NextResponse.json({ events: allEvents });
}

/**
 * POST /api/admin/events — Create a new event
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    const authHeader = request.headers.get("x-admin-password");
    if (!authHeader || authHeader !== getMasterPassword()) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    let body: {
        name?: string;
        slug?: string;
        password?: string;
        shotLimit?: number;
        termsText?: string;
    };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (!body.name || !body.slug || !body.password) {
        return NextResponse.json(
            { error: "name, slug, and password are required." },
            { status: 400 }
        );
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(body.slug)) {
        return NextResponse.json(
            { error: "Slug must be lowercase alphanumeric with hyphens only." },
            { status: 400 }
        );
    }

    // Check for duplicate slug
    const existing = await db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.slug, body.slug))
        .get();

    if (existing) {
        return NextResponse.json(
            { error: `An event with slug "${body.slug}" already exists.` },
            { status: 409 }
        );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 10);

    const now = new Date();
    const defaultTerms = `By participating in this photo contest, you agree to:
1. Grant the event organizers a non-exclusive right to display your photos.
2. Photos you take will be visible to other guests after the event.
3. Photos cannot be deleted once submitted.`;

    const inserted = await db
        .insert(events)
        .values({
            name: body.name,
            slug: body.slug,
            adminPasswordHash: passwordHash,
            shotLimit: body.shotLimit ?? 5,
            termsText: body.termsText ?? defaultTerms,
            status: "active",
            createdAt: now,
        })
        .returning()
        .get();

    log.info("Event created", { event: inserted.slug, id: inserted.id });

    return NextResponse.json(
        {
            id: inserted.id,
            name: inserted.name,
            slug: inserted.slug,
            status: inserted.status,
            shotLimit: inserted.shotLimit,
        },
        { status: 201 }
    );
}

/**
 * DELETE /api/admin/events — Delete an event by slug
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
    const authHeader = request.headers.get("x-admin-password");
    if (!authHeader || authHeader !== getMasterPassword()) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    let body: { slug?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (!body.slug) {
        return NextResponse.json({ error: "slug is required." }, { status: 400 });
    }

    const event = await db
        .select({ id: events.id, name: events.name })
        .from(events)
        .where(eq(events.slug, body.slug))
        .get();

    if (!event) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    // Delete event (cascading deletes will handle guests, sessions, photos)
    await db.delete(events).where(eq(events.id, event.id)).run();

    log.info("Event deleted", { event: body.slug, id: event.id });

    return NextResponse.json({
        success: true,
        deleted: { id: event.id, name: event.name, slug: body.slug },
    });
}
