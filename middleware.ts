import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to auth-related pages
  const authPaths = [
    "/sign-in",
    "/sign-up",
    "/verify-email",
    "/verify-email-sent",
    "/forgot-password",
    "/reset-password",
    "/api/auth"
  ];

  // Check if the current path is an auth path
  const isAuthPath = authPaths.some(path => pathname.startsWith(path));

  // Allow static files and API routes to pass through
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    isAuthPath
  ) {
    return NextResponse.next();
  }

  // For now, let the application handle authentication
  // The actual verification will be done in the app components
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};