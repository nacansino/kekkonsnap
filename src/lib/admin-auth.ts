import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_EXPIRY_HOURS,
} from "@/lib/constants";

const DEV_SECRET = "kekkonsnap-dev-secret-do-not-use-in-prod";
const BCRYPT_SALT_ROUNDS = 10;

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

export interface AdminPayload {
  eventId: number;
  role: "admin";
}

/**
 * Hash a plaintext password using bcryptjs.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Sign an admin JWT with role:"admin" and the given eventId.
 * Token expires after ADMIN_EXPIRY_HOURS (4h).
 */
export async function signAdminToken(payload: {
  eventId: number;
}): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ eventId: payload.eventId, role: "admin" as const })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_EXPIRY_HOURS}h`)
    .sign(secret);
}

/**
 * Verify an admin JWT and return the payload, or null if invalid/expired.
 * Also validates that the token contains role:"admin".
 */
export async function verifyAdminToken(
  token: string
): Promise<AdminPayload | null> {
  if (!token) return null;
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    const { eventId, role } = payload as Record<string, unknown>;
    if (typeof eventId !== "number" || role !== "admin") {
      return null;
    }
    return { eventId, role: "admin" };
  } catch {
    return null;
  }
}

/**
 * Set the admin session cookie on a NextResponse.
 * HttpOnly, Secure, SameSite=Lax, 4hr max-age.
 */
export function setAdminCookie(response: NextResponse, token: string): void {
  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_EXPIRY_HOURS * 60 * 60,
    path: "/",
  });
}

/**
 * Extract and verify the admin JWT from the request cookie.
 * Returns the payload or null.
 */
export async function getAdminFromCookie(
  request: NextRequest
): Promise<AdminPayload | null> {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}
