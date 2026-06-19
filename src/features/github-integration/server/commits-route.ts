import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { GITHUB_REPOS_ID, DATABASE_ID, PROJECTS_ID } from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";
import { getMember } from "@/features/members/utils";
import { GitHubAPI } from "../lib/github-api";
import { GitHubRepository } from "../types";

// Type for GitHub API commit response
interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
  html_url: string;
  files?: GitHubFile[];
  stats?: {
    additions: number;
    deletions: number;
  };
}

interface GitHubFile {
  filename: string;
  status?: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

const app = new Hono()
  // Fetch commits with real-time AI summaries (not stored)
  .post(
    "/fetch",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        projectId: z.string(),
        limit: z.number().min(1).max(500).optional().default(100),
      })
    ),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { projectId, limit } = c.req.valid("json");

      try {
        // 1. Get the linked repository
        const repositories = await databases.listDocuments(
          DATABASE_ID,
          GITHUB_REPOS_ID,
          []
        );

        const repository = repositories.documents.find(
          (r) => (r as unknown as GitHubRepository).projectId === projectId
        ) as unknown as GitHubRepository | undefined;

        if (!repository) {
          return c.json(
            { error: "No GitHub repository linked to this project" },
            404
          );
        }

        // 2. Get the project to verify workspace membership
        const project = await databases.getDocument(
          DATABASE_ID,
          PROJECTS_ID,
          projectId
        );

        // 3. Verify workspace membership
        const member = await getMember({
          databases,
          workspaceId: project.workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 403);
        }

        // 3. Initialize GitHub API client
        let token = repository.accessToken;
        if (token && token.includes(":")) {
          const { decryptToken } = await import("../lib/encryption");
          token = decryptToken(token);
        }
        const githubAPI = new GitHubAPI(token);

        // 4. Fetch commits from GitHub (with file details in single call)
        const commits = await githubAPI.getCommits(
          repository.owner,
          repository.repositoryName,
          repository.branch,
          limit
        );

        // Process commits - NO automatic AI summaries (on-demand only)
        const commitSummaries = commits.map((commit: GitHubCommit) => ({
          hash: commit.sha,
          message: commit.commit.message,
          author: commit.commit.author.name,
          authorAvatar: commit.author?.avatar_url || null,
          date: commit.commit.author.date,
          url: commit.html_url,
          aiSummary: null,
          filesChanged: commit.files?.length || 0,
          additions: commit.stats?.additions || 0,
          deletions: commit.stats?.deletions || 0,
          files: commit.files?.map((file) => ({
            filename: file.filename,
            status: 'status' in file ? (file as GitHubFile).status : 'modified',
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            patch: 'patch' in file ? (file as GitHubFile).patch : undefined,
          })) || [],
        }));

        return c.json({
          data: {
            summaries: commitSummaries,
            repositoryName: repository.repositoryName,
            branch: repository.branch,
          },
        });
      } catch (error: unknown) {
        return c.json(
          {
            error: error instanceof Error
              ? error.message
              : "Failed to fetch commits. Please check your GitHub token and repository access.",
          },
          500
        );
      }
    }
  );

export default app;
