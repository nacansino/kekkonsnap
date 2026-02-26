import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { verifyAdminToken } from "@/lib/admin-auth";
import {
  SESSION_COOKIE_NAME,
  ADMIN_COOKIE_NAME,
} from "@/lib/constants";

/**
 * Next.js middleware for route protection.
 *
 * - Admin dashboard/guests routes: require valid admin cookie, redirect to admin login if invalid.
 * - Guest protected routes (camera, photos, winner, gallery): require session cookie, redirect to guest landing.
 * - API routes: pass through (route handlers check auth themselves).
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // --- Admin protected routes ---
  // Matches: /admin/[slug]/dashboard, /admin/[slug]/guests (and sub-paths)
  const adminProtectedMatch = pathname.match(
    /^\/admin\/([^/]+)\/(dashboard|guests)(\/.*)?$/
  );
  if (adminProtectedMatch) {
    const slug = adminProtectedMatch[1];
    const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!adminToken) {
      return NextResponse.redirect(new URL(`/admin/${slug}`, request.url));
    }
    const adminPayload = await verifyAdminToken(adminToken);
    if (!adminPayload) {
      return NextResponse.redirect(new URL(`/admin/${slug}`, request.url));
    }
    return NextResponse.next();
  }

  // --- Guest protected routes ---
  // Matches paths containing /camera, /photos, /winner, or /gallery
  // These live under /(guest)/[slug]/... but the route group "(guest)" is not in the URL
  const guestProtectedMatch = pathname.match(
    /^\/([^/]+)\/(camera|photos|winner|gallery)(\/.*)?$/
  );
  if (guestProtectedMatch) {
    const slug = guestProtectedMatch[1];
    // Skip if this looks like an admin route
    if (slug === "admin") {
      return NextResponse.next();
    }
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.redirect(new URL(`/${slug}`, request.url));
    }
    const sessionPayload = await verifySessionToken(sessionToken);
    if (!sessionPayload) {
      return NextResponse.redirect(new URL(`/${slug}`, request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next (Next.js internals)
     * - api (API routes handle their own auth)
     * - Static files (images, favicon, etc.)
     */
    "/((?!_next|api|favicon\\.ico|.*\\..*).*)",
  ],
};
