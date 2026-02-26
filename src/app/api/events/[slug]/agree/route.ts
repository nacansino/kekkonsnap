import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionFromCookie } from "@/lib/auth";

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  const session = await getSessionFromCookie(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .update(sessions)
    .set({ agreedToTerms: true })
    .where(eq(sessions.id, session.sessionId))
    .execute();

  return NextResponse.json({ success: true });
}
