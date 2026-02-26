import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events } from "@/db/schema";
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

  return NextResponse.json({
    name: event.name,
    slug: event.slug,
    status: event.status,
    shotLimit: event.shotLimit,
    termsText: event.termsText,
  });
}
