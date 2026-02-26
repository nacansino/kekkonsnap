import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, guests } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;

  const event = await db
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .get();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const guestList = await db
    .select({
      id: guests.id,
      name: guests.name,
      tableNumber: guests.tableNumber,
    })
    .from(guests)
    .where(eq(guests.eventId, event.id))
    .all();

  return NextResponse.json(guestList);
}
