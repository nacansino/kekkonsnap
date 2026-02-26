import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, guests, photos } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { getAdminFromCookie } from "@/lib/admin-auth";

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

  // Get all guests with photo counts using left join and group by
  const guestList = await db
    .select({
      id: guests.id,
      name: guests.name,
      tableNumber: guests.tableNumber,
      photoCount: count(photos.id),
    })
    .from(guests)
    .leftJoin(photos, eq(guests.id, photos.guestId))
    .where(eq(guests.eventId, event.id))
    .groupBy(guests.id)
    .all();

  return NextResponse.json({ guests: guestList });
}

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
  let body: { guests?: Array<{ name: string; tableNumber?: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  if (!body.guests || !Array.isArray(body.guests) || body.guests.length === 0) {
    return NextResponse.json(
      { error: "guests array is required and must not be empty." },
      { status: 400 }
    );
  }

  // Validate each guest has a name
  for (const g of body.guests) {
    if (!g.name || typeof g.name !== "string" || g.name.trim().length === 0) {
      return NextResponse.json(
        { error: "Each guest must have a non-empty name." },
        { status: 400 }
      );
    }
  }

  // Insert guests with normalized names
  const now = new Date();
  const guestValues = body.guests.map((g) => ({
    eventId: event.id,
    name: g.name.trim(),
    normalizedName: g.name.trim().toLowerCase(),
    tableNumber: g.tableNumber?.trim() || null,
    createdAt: now,
  }));

  await db.insert(guests).values(guestValues).run();

  return NextResponse.json({
    success: true,
    imported: body.guests.length,
  });
}
