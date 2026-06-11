import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { ID, Query } from "node-appwrite";

import { DATABASE_ID, GITHUB_REPOS_ID, PROJECTS_ID } from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";

import { oauthAuthorizeSchema, oauthCallbackSchema } from "../schemas";
import { GitHubRepository, GitHubOAuthState } from "../types";
import {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  isGitHubOAuthConfigured,
} from "../constants.server";
import { encryptToken, isEncryptionConfigured } from "../lib/encryption";
import { githubAPI } from "../lib/github-api";

const GITHUB_OAUTH_BASE = "https://github.com/login/oauth";
const OAUTH_SCOPES = "repo,read:org,admin:repo_hook";

/**
 * Encode the OAuth state parameter.
 * Uses base64 encoding of JSON — NOT encrypted, but signed via the OAuth flow itself.
 * The state is validated on callback by checking projectId + userId match.
 */
function encodeOAuthState(state: GitHubOAuthState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

function decodeOAuthState(encoded: string): GitHubOAuthState {
  try {
    const json = Buffer.from(encoded, "base64url").toString("utf8");
    return JSON.parse(json) as GitHubOAuthState;
  } catch {
    throw new Error("Invalid OAuth state parameter");
  }
}

const app = new Hono()
  /**
   * GET /authorize — Start the OAuth 2.0 flow.
   * Redirects the user to GitHub's authorization page.
   */
  .get(
    "/authorize",
    sessionMiddleware,
    zValidator("query", oauthAuthorizeSchema),
    async (c) => {
      const user = c.get("user");
      const { projectId, githubUrl, branch } = c.req.valid("query");

      // Check OAuth is configured
      if (!isGitHubOAuthConfigured()) {
        return c.json(
          { error: "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET." },
          501
        );
      }

      // Verify project exists and user has admin access
      const databases = c.get("databases");

      const project = await databases.getDocument(
        DATABASE_ID,
        PROJECTS_ID,
        projectId
      );

      if (!project) {
        return c.json({ error: "Project not found" }, 404);
      }

      const { resolveUserProjectAccess } = await import(
        "@/lib/permissions/resolveUserProjectAccess"
      );
      const access = await resolveUserProjectAccess(databases, user.$id, projectId);
      if (!access.isAdmin) {
        return c.json(
          { error: "Only project admins can connect GitHub via OAuth" },
          403
        );
      }

      // Build state parameter
      const state = encodeOAuthState({
        projectId,
        userId: user.$id,
        timestamp: Date.now(),
        githubUrl,
        branch,
      });

      // Build GitHub OAuth URL
      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/github/oauth/callback`;
      const githubAuthUrl = new URL(`${GITHUB_OAUTH_BASE}/authorize`);
      githubAuthUrl.searchParams.set("client_id", GITHUB_CLIENT_ID);
      githubAuthUrl.searchParams.set("redirect_uri", redirectUri);
      githubAuthUrl.searchParams.set("scope", OAUTH_SCOPES);
      githubAuthUrl.searchParams.set("state", state);

      return c.redirect(githubAuthUrl.toString());
    }
  )

  /**
   * GET /callback — Handle the OAuth 2.0 callback from GitHub.
   * Exchanges the code for an access token, encrypts it, and stores it.
   */
  .get(
    "/callback",
    sessionMiddleware,
    zValidator("query", oauthCallbackSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { code, state } = c.req.valid("query");

      // Decode and validate state
      let oauthState: GitHubOAuthState;
      try {
        oauthState = decodeOAuthState(state);
      } catch {
        return c.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL}?error=invalid_oauth_state`
        );
      }

      // Validate state integrity
      if (oauthState.userId !== user.$id) {
        return c.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL}?error=oauth_user_mismatch`
        );
      }

      // Check timestamp (10 minutes max)
      if (Date.now() - oauthState.timestamp > 10 * 60 * 1000) {
        return c.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL}?error=oauth_state_expired`
        );
      }

      const { projectId, githubUrl, branch } = oauthState;

      // Exchange code for access token
      const tokenResponse = await fetch(`${GITHUB_OAUTH_BASE}/access_token`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      if (!tokenResponse.ok) {
        console.error("[GitHub OAuth] Token exchange failed:", tokenResponse.statusText);
        return c.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL}?error=oauth_token_exchange_failed`
        );
      }

      const tokenData = await tokenResponse.json() as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };

      if (tokenData.error || !tokenData.access_token) {
        console.error("[GitHub OAuth] Token error:", tokenData.error, tokenData.error_description);
        return c.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL}?error=oauth_token_error`
        );
      }

      const accessToken = tokenData.access_token;

      // Encrypt the token before storing
      let tokenToStore = accessToken;
      if (isEncryptionConfigured()) {
        tokenToStore = encryptToken(accessToken);
      } else {
        console.warn("[GitHub OAuth] INTEGRATION_ENCRYPTION_SECRET not set — storing token unencrypted");
      }

      // Get GitHub user info
      const ghUserResponse = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      let githubUsername = "unknown";
      if (ghUserResponse.ok) {
        const ghUser = await ghUserResponse.json() as { login: string };
        githubUsername = ghUser.login;
      }

      // Check if repo connection already exists for this project
      const existing = await databases.listDocuments<GitHubRepository>(
        DATABASE_ID,
        GITHUB_REPOS_ID,
        [Query.equal("projectId", projectId)]
      );

      // Get the project to find the workspace for redirect
      const project = await databases.getDocument(
        DATABASE_ID,
        PROJECTS_ID,
        projectId
      );

      if (existing.total > 0) {
        // Update existing connection with new OAuth token
        const existingDoc = existing.documents[0];
        const updatedStatus = existingDoc.status === "connected" && existingDoc.githubUrl !== "pending"
          ? "connected"
          : "authenticating";

        await databases.updateDocument(
          DATABASE_ID,
          GITHUB_REPOS_ID,
          existingDoc.$id,
          {
            accessToken: tokenToStore,
            status: updatedStatus,
            lastSyncedAt: new Date().toISOString(),
            lastModifiedBy: user.$id,
            ...(githubUrl ? {
              githubUrl: githubUrl.toLowerCase(),
              branch: branch || "main",
              repositoryName: githubAPI.parseGitHubUrl(githubUrl).repo,
              owner: githubAPI.parseGitHubUrl(githubUrl).owner,
              status: "connected",
            } : {}),
          }
        );
      } else {
        // Create new pending connection
        await databases.createDocument(
          DATABASE_ID,
          GITHUB_REPOS_ID,
          ID.unique(),
          {
            projectId,
            workspaceId: project.workspaceId,
            githubUrl: githubUrl ? githubUrl.toLowerCase() : "pending",
            repositoryName: githubUrl ? githubAPI.parseGitHubUrl(githubUrl).repo : "pending",
            owner: githubUrl ? githubAPI.parseGitHubUrl(githubUrl).owner : "pending",
            branch: branch || (githubUrl ? "main" : "pending"),
            accessToken: tokenToStore,
            status: githubUrl ? "connected" : "authenticating",
            lastSyncedAt: new Date().toISOString(),
            createdBy: user.$id,
            lastModifiedBy: user.$id,
            autoFetchCommits: true,
            linkCommitsToTasks: true,
            syncComments: true,
            allowPrMerge: true,
            createTasksFromIssues: false,
          }
        );
      }

      // Redirect to the GitHub settings tab on the project settings page
      const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/workspaces/${project.workspaceId}/projects/${projectId}/settings?tab=integrations&oauth=success&github_user=${githubUsername}`;
      return c.redirect(redirectUrl);
    }
  )

  /**
   * GET /status — Check if GitHub OAuth is configured.
   * Used by the frontend to decide whether to show the OAuth button.
   */
  .get("/status", async (c) => {
    return c.json({
      oauthConfigured: isGitHubOAuthConfigured(),
      encryptionConfigured: isEncryptionConfigured(),
    });
  });

export default app;
