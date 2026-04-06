// src/app/oauth/route.js
// Reference: https://appwrite.io/docs/tutorials/nextjs-ssr-auth/step-7
// Updated: Redirects to /auth/callback for unified post-auth routing

import { AUTH_COOKIE } from "@/features/auth/constants";

import { createAdminClient } from "@/lib/appwrite";

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * OAuth Token Exchange Route
 * 
 * This route receives the OAuth callback from Appwrite with userId and secret.
 * It creates a session from the OAuth token and redirects to /auth/callback
 * for unified post-auth routing logic.
 * 
 * WHY separate from /auth/callback:
 * - This route handles the technical OAuth token → session exchange
 * - /auth/callback handles the user-facing routing logic
 * - Same routing logic works for all auth methods (OAuth, email/password)
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const secret = request.nextUrl.searchParams.get("secret");

  if (!userId || !secret) {
    return new NextResponse("Missing fields", { status: 400 });
  }

  const { account } = await createAdminClient();
  const session = await account.createSession(userId, secret);

  (await cookies()).set(AUTH_COOKIE, session.secret, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  // Redirect to unified callback for post-auth routing
  // Use sanitized origin to avoid browser issues with 0.0.0.0 or 127.0.0.1
  const origin = request.nextUrl.origin;
  const redirectBase = (origin.includes("0.0.0.0") || origin.includes("127.0.0.1"))
    ? (process.env.NEXT_PUBLIC_APP_URL || origin).replace(/\/$/, "")
    : origin.replace(/\/$/, "");

  return NextResponse.redirect(`${redirectBase}/auth/callback`);
}

