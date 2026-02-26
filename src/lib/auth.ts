import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_EXPIRY_HOURS,
} from "@/lib/constants";

const DEV_SECRET = "kekkonsnap-dev-secret-do-not-use-in-prod";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "JWT_SECRET environment variable is required in production"
      );
    }
    return new TextEncoder().encode(DEV_SECRET);
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sessionId: string;
  guestId: number;
  eventId: number;
}

/**
 * Sign a guest session JWT with the given payload.
 * Token expires after SESSION_EXPIRY_HOURS (24h).
 */
export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_EXPIRY_HOURS}h`)
    .sign(secret);
}

/**
 * Verify a guest session JWT and return the payload, or null if invalid/expired.
 */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    const { sessionId, guestId, eventId } = payload as Record<string, unknown>;
    if (
      typeof sessionId !== "string" ||
      typeof guestId !== "number" ||
      typeof eventId !== "number"
    ) {
      return null;
    }
    return { sessionId, guestId, eventId };
  } catch {
    return null;
  }
}

/**
 * Set the guest session cookie on a NextResponse.
 * HttpOnly, Secure, SameSite=Lax, 24hr max-age.
 */
export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_EXPIRY_HOURS * 60 * 60,
    path: "/",
  });
}

/**
 * Extract and verify the guest session JWT from the request cookie.
 * Returns the payload or null.
 */
export async function getSessionFromCookie(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
