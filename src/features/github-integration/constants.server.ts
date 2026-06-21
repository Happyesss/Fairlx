// Server-only configuration for GitHub integration and AI API.
// Do NOT import this file from client code; it reads server-side environment variables.

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
export const GITHUB_TOKEN = process.env.GH_PERSONAL_TOKEN || process.env.GH_TOKEN || "";

// OAuth 2.0 App credentials (for project-scoped GitHub connections)
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || process.env.GH_CLIENT_ID || "";
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || process.env.GH_CLIENT_SECRET || "";

// Encryption key for OAuth tokens at rest
export const INTEGRATION_ENCRYPTION_SECRET = process.env.INTEGRATION_ENCRYPTION_SECRET || "";

// GEMINI_API_KEY validation is handled by assertServerConfig()

/**
 * Helper to assert at runtime that required server secrets are available.
 * Use in API routes before calling AI or GitHub endpoints.
 */
export function assertServerConfig() {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required on the server");
}

export function getGitHubAuthHeader() {
  return GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {};
}

/**
 * Check if GitHub OAuth is configured (client ID + secret both present).
 */
export function isGitHubOAuthConfigured(): boolean {
  return !!GITHUB_CLIENT_ID && !!GITHUB_CLIENT_SECRET;
}

