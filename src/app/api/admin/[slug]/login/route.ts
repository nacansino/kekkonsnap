import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, signAdminToken, setAdminCookie } from "@/lib/admin-auth";
import { rateLimitByIP } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;

  // Rate limit: 5 attempts per minute per IP
  const { allowed } = rateLimitByIP(
    request,
    "admin-login",
    RATE_LIMITS.ADMIN_LOGIN.limit,
    RATE_LIMITS.ADMIN_LOGIN.windowMs
  );

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429 }
    );
  }

  // Parse request body
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { password } = body;
  if (!password || typeof password !== "string") {
    return NextResponse.json(
      { error: "Password is required." },
      { status: 400 }
    );
  }

  // Look up event by slug
  const event = await db
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .get();

  if (!event) {
    return NextResponse.json(
      { error: "Invalid event or password." },
      { status: 401 }
    );
  }

  // Verify password
  const isValid = await verifyPassword(password, event.adminPasswordHash);
  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid event or password." },
      { status: 401 }
    );
  }

  // Sign token and set cookie
  const token = await signAdminToken({ eventId: event.id });
  const response = NextResponse.json({
    success: true,
    eventName: event.name,
  });

  setAdminCookie(response, token);

  return response;
}
