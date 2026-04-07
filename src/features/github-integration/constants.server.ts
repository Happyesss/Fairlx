// Server-only configuration for GitHub integration and AI API.
// Do NOT import this file from client code; it reads server-side environment variables.

export const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || "";
export const GITHUB_TOKEN = process.env.GH_PERSONAL_TOKEN || process.env.GH_TOKEN || "";

// OLLAMA_API_KEY validation is handled by assertServerConfig()

/**
 * Helper to assert at runtime that required server secrets are available.
 * Use in API routes before calling AI or GitHub endpoints.
 */
export function assertServerConfig() {
  if (!OLLAMA_API_KEY) throw new Error("OLLAMA_API_KEY is required on the server");
}

export function getGitHubAuthHeader() {
  return GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {};
}
