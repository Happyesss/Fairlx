// src/lib/server/oauth.js
// Reference: https://appwrite.io/docs/tutorials/nextjs-ssr-auth/step-7
"use server";

import { createAdminClient } from "@/lib/appwrite";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { OAuthProvider } from "node-appwrite";

/**
 * Get the app origin URL
 * Uses origin header with fallback to NEXT_PUBLIC_APP_URL env variable.
 * Sanitizes "0.0.0.0" which is a server bind address but not a valid client destination.
 */
async function getOrigin(): Promise<string> {
  const origin = (await headers()).get("origin");

  // Only use the request origin if it's not the catch-all bind address 0.0.0.0
  // or the numeric local loopback 127.0.0.1 (which can also be problematic)
  if (origin && !origin.includes("0.0.0.0") && !origin.includes("127.0.0.1")) {
    return origin.replace(/\/$/, ""); // Remove trailing slash
  }

  // Fallback to env variable (required for server actions and reliable local dev)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) return appUrl.replace(/\/$/, ""); // Remove trailing slash

  throw new Error("Unable to determine app origin. Set NEXT_PUBLIC_APP_URL.");
}

/**
 * OAuth with GitHub
 * 
 * WHY redirect to /oauth first, then to /auth/callback:
 * - /oauth handles the token exchange (creates session from OAuth token)
 * - /auth/callback handles routing logic (user state-based routing)
 * - This separation allows the same callback logic for all auth methods
 */
export async function signUpWithGithub(returnUrl?: string) {
  const { account } = await createAdminClient();

  const origin = await getOrigin();

  // Encode returnUrl in the failure redirect URL so it can be preserved
  const failureUrl = returnUrl
    ? `${origin}/sign-up?returnUrl=${encodeURIComponent(returnUrl)}`
    : `${origin}/sign-up`;

  // OAuth token exchange happens at /oauth, which then redirects to /auth/callback
  const successUrl = `${origin}/oauth`;

  const redirectUrl = await account.createOAuth2Token(
    OAuthProvider.Github,
    successUrl,
    failureUrl
  );

  return redirect(redirectUrl);
}

export async function signUpWithGoogle(returnUrl?: string) {
  const { account } = await createAdminClient();

  const origin = await getOrigin();

  // Encode returnUrl in the failure redirect URL so it can be preserved
  const failureUrl = returnUrl
    ? `${origin}/sign-up?returnUrl=${encodeURIComponent(returnUrl)}`
    : `${origin}/sign-up`;

  // OAuth token exchange happens at /oauth, which then redirects to /auth/callback
  const successUrl = `${origin}/oauth`;

  const redirectUrl = await account.createOAuth2Token(
    OAuthProvider.Google,
    successUrl,
    failureUrl
  );

  return redirect(redirectUrl);
}
