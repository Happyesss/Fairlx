// src/app/oauth/route.js
// Reference: https://appwrite.io/docs/tutorials/nextjs-ssr-auth/step-7
// Updated: Redirects to /auth/callback for unified post-auth routing

import { AUTH_COOKIE } from "@/features/auth/constants";

import { createAdminClient } from "@/lib/appwrite";

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";

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
 * 
 * DUPLICATE EMAIL GUARD:
 * Appwrite may create a new user account when the OAuth email matches an
 * existing email/password account instead of linking them. We detect this
 * by checking for multiple users sharing the same email. If found, the
 * newly created OAuth user is deleted and the browser is redirected to
 * sign-in with a clear error so the user can authenticate with their
 * existing credentials.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const secret = request.nextUrl.searchParams.get("secret");

  if (!userId || !secret) {
    return new NextResponse("Missing fields", { status: 400 });
  }

  // Use sanitized origin to avoid browser issues with 0.0.0.0 or 127.0.0.1
  const origin = request.nextUrl.origin;
  const redirectBase = (origin.includes("0.0.0.0") || origin.includes("127.0.0.1"))
    ? (process.env.NEXT_PUBLIC_APP_URL || origin).replace(/\/$/, "")
    : origin.replace(/\/$/, "");

  const { account, users } = await createAdminClient();

  // ── Duplicate email guard ──────────────────────────────────────────────────
  // Appwrite creates a brand-new user during OAuth if the email is already
  // registered via email/password. Detect and clean up the duplicate before
  // issuing a session.
  try {
    const oauthUser = await users.get(userId);
    const usersWithSameEmail = await users.list([
      Query.equal("email", oauthUser.email),
    ]);

    if (usersWithSameEmail.total > 1) {
      const duplicate = usersWithSameEmail.users.find((u) => u.$id !== userId);
      if (duplicate) {
        // Remove the orphaned OAuth account so no stale user record is left
        try {
          await users.delete(userId);
        } catch {
          // Non-fatal — still redirect with the error even if deletion fails
        }
        return NextResponse.redirect(
          `${redirectBase}/sign-in?error=email_exists&email=${encodeURIComponent(oauthUser.email)}`
        );
      }
    }
  } catch {
    // If the admin lookup fails, fall through to normal session creation
  }
  // ──────────────────────────────────────────────────────────────────────────

  const session = await account.createSession(userId, secret);

  (await cookies()).set(AUTH_COOKIE, session.secret, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  // Redirect to unified callback for post-auth routing
  return NextResponse.redirect(`${redirectBase}/auth/callback`);
}

