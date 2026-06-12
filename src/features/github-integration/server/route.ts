import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { ID, Query } from "node-appwrite";
import { z } from "zod";

import {
  DATABASE_ID,
  GITHUB_REPOS_ID,
  PROJECTS_ID,
  CODE_DOCS_ID,
  TASKS_ID,
  GITHUB_COMMITS_ID,
  GITHUB_PRS_ID,
  GITHUB_RELEASES_ID,
  GITHUB_ISSUES_ID,
} from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";
import { getMember } from "@/features/members/utils";

import { connectGitHubRepoSchema } from "../schemas";
import { GitHubRepository } from "../types";
import { githubAPI, GitHubAPI } from "../lib/github-api";

const app = new Hono()
  // Link GitHub repository to a project
  .post(
    "/link",
    sessionMiddleware,
    zValidator("json", connectGitHubRepoSchema),
    async (c) => {
      try {
        const databases = c.get("databases");
        const user = c.get("user");
        const { projectId, githubUrl, branch, githubToken } = c.req.valid("json");

        // Get the project to verify workspace membership
        const project = await databases.getDocument(
          DATABASE_ID,
          PROJECTS_ID,
          projectId
        );

        if (!project) {
          return c.json({ error: "Project not found" }, 404);
        }

        // Check if user is a member of the workspace
        const member = await getMember({
          databases,
          workspaceId: project.workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // Check if repo is already linked (determines connect vs. update)
        const existing = await databases.listDocuments<GitHubRepository>(
          DATABASE_ID,
          GITHUB_REPOS_ID,
          [Query.equal("projectId", projectId)]
        );

        // RBAC: Only project admins/owners can create new repository connections.
        // All project members can update/refetch an existing connection.
        if (existing.total === 0) {
          const { resolveUserProjectAccess } = await import(
            "@/lib/permissions/resolveUserProjectAccess"
          );
          const access = await resolveUserProjectAccess(databases, user.$id, projectId);
          if (!access.isAdmin) {
            return c.json(
              { error: "Only project admins and owners can connect repositories" },
              403
            );
          }
        }

        // Parse GitHub URL
        const { owner, repo } = githubAPI.parseGitHubUrl(githubUrl);

        // Verify repository exists and is accessible
        let activeToken: string | undefined = githubToken || undefined;
        if (!activeToken && existing.total > 0 && existing.documents[0].accessToken) {
          let token = existing.documents[0].accessToken;
          if (token.includes(":")) {
            const { decryptToken } = await import("../lib/encryption");
            token = decryptToken(token);
          }
          activeToken = token;
        }

        const api = new GitHubAPI(activeToken);

        try {
          await api.getRepository(owner, repo);
        } catch (error: unknown) {
          return c.json(
            {
              error: "Failed to access repository",
              message: error instanceof Error ? error.message : "Repository not found or inaccessible",
            },
            400
          );
        }

        // Generate webhook secret and register webhook on GitHub
        const webhookSecret = ID.unique();
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/github/webhooks/incoming/${projectId}`;
        let webhookId: number | undefined;

        let repository: GitHubRepository;

        if (existing.total > 0) {
          // Update existing - Clear old documentation when repository is updated
          const oldRepo = existing.documents[0];
          const repoChanged = oldRepo.githubUrl.toLowerCase() !== githubUrl.toLowerCase() || 
                             oldRepo.branch !== branch;
          
          if (repoChanged) {
            // Delete old documentation if repository URL or branch changed
            const oldDocs = await databases.listDocuments(
              DATABASE_ID,
              CODE_DOCS_ID,
              [Query.equal("projectId", projectId)]
            );
            
            for (const doc of oldDocs.documents) {
              await databases.deleteDocument(DATABASE_ID, CODE_DOCS_ID, doc.$id);
            }
          }

          // Delete old webhook if it exists
          if (oldRepo.webhookId) {
            try {
              let oldToken = oldRepo.accessToken;
              if (oldToken && oldToken.includes(":")) {
                const { decryptToken } = await import("../lib/encryption");
                oldToken = decryptToken(oldToken);
              }
              const oldApi = oldToken ? new GitHubAPI(oldToken) : api;
              await oldApi.deleteWebhook(oldRepo.owner, oldRepo.repositoryName, oldRepo.webhookId);
            } catch (err) {
              console.error("[GitHub Webhook] Failed to delete old webhook during update:", err);
            }
          }

          // Register new webhook
          try {
            const hook = await api.registerWebhook(owner, repo, webhookUrl, webhookSecret);
            webhookId = hook.id;
          } catch (err) {
            console.error("[GitHub Webhook] Failed to register new webhook during update:", err);
          }
          
          repository = await databases.updateDocument<GitHubRepository>(
            DATABASE_ID,
            GITHUB_REPOS_ID,
            existing.documents[0].$id,
            {
              githubUrl: githubUrl.toLowerCase(),
              repositoryName: repo,
              owner,
              branch,
              ...(githubToken ? { accessToken: githubToken } : {}),
              status: "connected",
              lastSyncedAt: new Date().toISOString(),
              error: null,
              lastModifiedBy: user.$id,
              webhookId,
              webhookSecret,
            }
          );
        } else {
          // Register webhook for new connection
          try {
            const hook = await api.registerWebhook(owner, repo, webhookUrl, webhookSecret);
            webhookId = hook.id;
          } catch (err) {
            console.error("[GitHub Webhook] Failed to register webhook during link:", err);
          }

          // Create new
          repository = await databases.createDocument<GitHubRepository>(
            DATABASE_ID,
            GITHUB_REPOS_ID,
            ID.unique(),
            {
              projectId,
              workspaceId: project.workspaceId,
              githubUrl: githubUrl.toLowerCase(),
              repositoryName: repo,
              owner,
              branch: branch || "main",
              accessToken: githubToken || undefined,
              status: "connected",
              lastSyncedAt: new Date().toISOString(),
              createdBy: user.$id,
              lastModifiedBy: user.$id,
              webhookId,
              webhookSecret,
              autoFetchCommits: true,
              linkCommitsToTasks: true,
              syncComments: true,
              allowPrMerge: true,
              createTasksFromIssues: true,
            }
          );
        }


        return c.json({ data: repository });
      } catch (error: unknown) {
        return c.json(
          {
            error: "Failed to link repository",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          500
        );
      }
    }
  )

  // Get linked repository for a project
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", connectGitHubRepoSchema.pick({ projectId: true })),
    async (c) => {
      try {
        const databases = c.get("databases");
        const user = c.get("user");
        const { projectId } = c.req.valid("query");

        // Get the project to verify workspace membership
        const project = await databases.getDocument(
          DATABASE_ID,
          PROJECTS_ID,
          projectId
        );

        if (!project) {
          return c.json({ error: "Project not found" }, 404);
        }

        // Check if user is a member of the workspace
        const member = await getMember({
          databases,
          workspaceId: project.workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // Get linked repository
        const repositories = await databases.listDocuments<GitHubRepository>(
          DATABASE_ID,
          GITHUB_REPOS_ID,
          [Query.equal("projectId", projectId), Query.limit(1)]
        );

        if (repositories.total === 0) {
          return c.json({ data: null });
        }

        const repo = repositories.documents[0];
        
        // Ensure status is not stuck on 'syncing'
        if (repo.status === 'syncing') {
          const updatedRepo = await databases.updateDocument<GitHubRepository>(
            DATABASE_ID,
            GITHUB_REPOS_ID,
            repo.$id,
            { status: 'connected' }
          );
          return c.json({ data: updatedRepo });
        }

        return c.json({ data: repo });
      } catch (error: unknown) {
        return c.json(
          {
            error: "Failed to fetch repository",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          500
        );
      }
    }
  )

  // Disconnect GitHub repository
  .delete(
    "/:repositoryId",
    sessionMiddleware,
    async (c) => {
      try {
        const databases = c.get("databases");
        const user = c.get("user");
        const { repositoryId } = c.req.param();

        // Get repository
        const repository = await databases.getDocument<GitHubRepository>(
          DATABASE_ID,
          GITHUB_REPOS_ID,
          repositoryId
        );

        if (!repository) {
          return c.json({ error: "Repository not found" }, 404);
        }

        // Get the project to verify workspace membership
        const project = await databases.getDocument(
          DATABASE_ID,
          PROJECTS_ID,
          repository.projectId
        );

        if (!project) {
          return c.json({ error: "Project not found" }, 404);
        }

        // Check if user is a member of the workspace
        const member = await getMember({
          databases,
          workspaceId: project.workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // RBAC: Only project admins/owners can disconnect repositories
        const { resolveUserProjectAccess } = await import(
          "@/lib/permissions/resolveUserProjectAccess"
        );
        const access = await resolveUserProjectAccess(databases, user.$id, repository.projectId);
        if (!access.isAdmin) {
          return c.json(
            { error: "Only project admins and owners can disconnect repositories" },
            403
          );
        }

        // Delete webhook from GitHub if registered
        if (repository.webhookId) {
          try {
            let token = repository.accessToken;
            if (token && token.includes(":")) {
              const { decryptToken } = await import("../lib/encryption");
              token = decryptToken(token);
            }
            const api = token ? new GitHubAPI(token) : githubAPI;
            await api.deleteWebhook(repository.owner, repository.repositoryName, repository.webhookId);
          } catch (err) {
            console.error("[GitHub Webhook] Failed to delete webhook during disconnect:", err);
          }
        }

        // Delete repository connection
        await databases.deleteDocument(
          DATABASE_ID,
          GITHUB_REPOS_ID,
          repositoryId
        );


        return c.json({ success: true });
      } catch (error: unknown) {
        return c.json(
          {
            error: "Failed to disconnect repository",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          500
        );
      }
    }
  )

  // Update repository settings/options
  .patch(
    "/:repositoryId/settings",
    sessionMiddleware,
    zValidator("json", z.object({
      autoFetchCommits: z.boolean().optional(),
      linkCommitsToTasks: z.boolean().optional(),
      syncComments: z.boolean().optional(),
      allowPrMerge: z.boolean().optional(),
      createTasksFromIssues: z.boolean().optional(),
    })),
    async (c) => {
      try {
        const databases = c.get("databases");
        const user = c.get("user");
        const { repositoryId } = c.req.param();
        const settings = c.req.valid("json");

        const repository = await databases.getDocument<GitHubRepository>(
          DATABASE_ID,
          GITHUB_REPOS_ID,
          repositoryId
        );

        if (!repository) {
          return c.json({ error: "Repository not found" }, 404);
        }

        const { resolveUserProjectAccess } = await import(
          "@/lib/permissions/resolveUserProjectAccess"
        );
        const access = await resolveUserProjectAccess(databases, user.$id, repository.projectId);
        if (!access.isAdmin) {
          return c.json(
            { error: "Only project admins and owners can update repository settings" },
            403
          );
        }

        const updated = await databases.updateDocument<GitHubRepository>(
          DATABASE_ID,
          GITHUB_REPOS_ID,
          repositoryId,
          {
            autoFetchCommits: settings.autoFetchCommits,
            linkCommitsToTasks: settings.linkCommitsToTasks,
            syncComments: settings.syncComments,
            allowPrMerge: settings.allowPrMerge,
            createTasksFromIssues: settings.createTasksFromIssues,
            lastModifiedBy: user.$id,
          }
        );

        return c.json({ data: updated });
      } catch (error: unknown) {
        return c.json(
          {
            error: "Failed to update settings",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          500
        );
      }
    }
  )

  // List user repositories for the connected OAuth account
  .get(
    "/user-repos",
    sessionMiddleware,
    zValidator("query", z.object({ projectId: z.string() })),
    async (c) => {
      try {
        const databases = c.get("databases");
        const user = c.get("user");
        const { projectId } = c.req.valid("query");

        // Get the project to verify workspace membership
        const project = await databases.getDocument(
          DATABASE_ID,
          PROJECTS_ID,
          projectId
        );

        if (!project) {
          return c.json({ error: "Project not found" }, 404);
        }

        const member = await getMember({
          databases,
          workspaceId: project.workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // Get the GitHub token from the database
        const repositories = await databases.listDocuments<GitHubRepository>(
          DATABASE_ID,
          GITHUB_REPOS_ID,
          [Query.equal("projectId", projectId), Query.limit(1)]
        );

        if (repositories.total === 0 || !repositories.documents[0].accessToken) {
          return c.json({ error: "Not authenticated with GitHub" }, 400);
        }

        const repository = repositories.documents[0];
        let decryptedToken = repository.accessToken;
        if (!decryptedToken) {
          return c.json({ error: "Not authenticated with GitHub" }, 400);
        }
        if (decryptedToken.includes(":")) {
          const { decryptToken } = await import("../lib/encryption");
          decryptedToken = decryptToken(decryptedToken);
        }

        const api = new GitHubAPI(decryptedToken);
        const repos = await api.listUserRepositories();

        return c.json({ data: repos });
      } catch (error: unknown) {
        console.error("[GitHub List Repos Error]:", error);
        return c.json(
          {
            error: "Failed to list repositories",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          500
        );
      }
    }
  )

  // List branches for a selected repository
  .get(
    "/branches",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        projectId: z.string(),
        owner: z.string(),
        repo: z.string(),
      })
    ),
    async (c) => {
      try {
        const databases = c.get("databases");
        const user = c.get("user");
        const { projectId, owner, repo } = c.req.valid("query");

        // Get the project to verify workspace membership
        const project = await databases.getDocument(
          DATABASE_ID,
          PROJECTS_ID,
          projectId
        );

        if (!project) {
          return c.json({ error: "Project not found" }, 404);
        }

        const member = await getMember({
          databases,
          workspaceId: project.workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // Get the GitHub token from the database
        const repositories = await databases.listDocuments<GitHubRepository>(
          DATABASE_ID,
          GITHUB_REPOS_ID,
          [Query.equal("projectId", projectId), Query.limit(1)]
        );

        if (repositories.total === 0 || !repositories.documents[0].accessToken) {
          return c.json({ error: "Not authenticated with GitHub" }, 400);
        }

        const repository = repositories.documents[0];
        let decryptedToken = repository.accessToken;
        if (!decryptedToken) {
          return c.json({ error: "Not authenticated with GitHub" }, 400);
        }
        if (decryptedToken.includes(":")) {
          const { decryptToken } = await import("../lib/encryption");
          decryptedToken = decryptToken(decryptedToken);
        }

        const api = new GitHubAPI(decryptedToken);
        const branches = await api.listBranches(owner, repo);

        return c.json({ data: branches });
      } catch (error: unknown) {
        console.error("[GitHub List Branches Error]:", error);
        return c.json(
          {
            error: "Failed to list branches",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          500
        );
      }
    }
  )

  // Get GitHub events (commits & PRs) linked to a specific task
  .get(
    "/task-events/:taskKey",
    sessionMiddleware,
    async (c) => {
      try {
        const databases = c.get("databases");
        const user = c.get("user");
        const { taskKey } = c.req.param();

        // 1. Get the task (work item) by its key to find workspace and project ID
        const tasks = await databases.listDocuments(
          DATABASE_ID,
          TASKS_ID,
          [Query.equal("key", taskKey.toUpperCase()), Query.limit(1)]
        );

        if (tasks.total === 0) {
          return c.json({ error: "Task not found" }, 404);
        }

        const task = tasks.documents[0];

        // 2. Check workspace membership
        const member = await getMember({
          databases,
          workspaceId: task.workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // 3. Query github_commits and github_pull_requests collections
        const [commits, prs] = await Promise.all([
          databases.listDocuments(
            DATABASE_ID,
            GITHUB_COMMITS_ID,
            [
              Query.equal("projectId", task.projectId),
              Query.equal("taskId", taskKey.toUpperCase()),
              Query.orderDesc("processedAt"),
              Query.limit(100)
            ]
          ),
          databases.listDocuments(
            DATABASE_ID,
            GITHUB_PRS_ID,
            [
              Query.equal("projectId", task.projectId),
              Query.equal("taskId", taskKey.toUpperCase()),
              Query.orderDesc("processedAt"),
              Query.limit(100)
            ]
          )
        ]);

        return c.json({
          data: {
            commits: commits.documents,
            pullRequests: prs.documents,
          }
        });
      } catch (error: unknown) {
        console.error("[GitHub Get Task Events Error]:", error);
        return c.json(
          {
            error: "Failed to fetch task github events",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          500
        );
      }
    }
  )

  // Get GitHub issues for a project
  .get(
    "/issues",
    sessionMiddleware,
    zValidator("query", z.object({ projectId: z.string() })),
    async (c) => {
      try {
        const databases = c.get("databases");
        const user = c.get("user");
        const { projectId } = c.req.valid("query");

        // 1. Check project access
        const project = await databases.getDocument(
          DATABASE_ID,
          PROJECTS_ID,
          projectId
        );

        const member = await getMember({
          databases,
          workspaceId: project.workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // 2. Fetch issues
        const issues = await databases.listDocuments(
          DATABASE_ID,
          GITHUB_ISSUES_ID,
          [
            Query.equal("projectId", projectId),
            Query.limit(100),
          ]
        );

        return c.json({ data: issues.documents });
      } catch (error: unknown) {
        console.error("[GitHub Get Issues Error]:", error);
        return c.json(
          {
            error: "Failed to fetch project issues",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          500
        );
      }
    }
  )

  // Get GitHub releases for a project
  .get(
    "/releases",
    sessionMiddleware,
    zValidator("query", z.object({ projectId: z.string() })),
    async (c) => {
      try {
        const databases = c.get("databases");
        const user = c.get("user");
        const { projectId } = c.req.valid("query");

        // 1. Check project access
        const project = await databases.getDocument(
          DATABASE_ID,
          PROJECTS_ID,
          projectId
        );

        const member = await getMember({
          databases,
          workspaceId: project.workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // 2. Fetch releases sorted by publishedAt descending
        const releases = await databases.listDocuments(
          DATABASE_ID,
          GITHUB_RELEASES_ID,
          [
            Query.equal("projectId", projectId),
            Query.orderDesc("publishedAt"),
            Query.limit(100),
          ]
        );

        return c.json({ data: releases.documents });
      } catch (error: unknown) {
        console.error("[GitHub Get Releases Error]:", error);
        return c.json(
          {
            error: "Failed to fetch project releases",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          500
        );
      }
    }
  )

  // Get all GitHub commits synced for a project
  .get(
    "/commits",
    sessionMiddleware,
    zValidator("query", z.object({ projectId: z.string() })),
    async (c) => {
      try {
        const databases = c.get("databases");
        const user = c.get("user");
        const { projectId } = c.req.valid("query");

        const project = await databases.getDocument(
          DATABASE_ID,
          PROJECTS_ID,
          projectId
        );

        const member = await getMember({
          databases,
          workspaceId: project.workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        const commits = await databases.listDocuments(
          DATABASE_ID,
          GITHUB_COMMITS_ID,
          [
            Query.equal("projectId", projectId),
            Query.orderDesc("processedAt"),
            Query.limit(100),
          ]
        );

        return c.json({ data: commits.documents });
      } catch (error: unknown) {
        console.error("[GitHub Get Project Commits Error]:", error);
        return c.json(
          {
            error: "Failed to fetch project commits",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          500
        );
      }
    }
  )

  // Get all GitHub pull requests synced for a project
  .get(
    "/pull-requests",
    sessionMiddleware,
    zValidator("query", z.object({ projectId: z.string() })),
    async (c) => {
      try {
        const databases = c.get("databases");
        const user = c.get("user");
        const { projectId } = c.req.valid("query");

        const project = await databases.getDocument(
          DATABASE_ID,
          PROJECTS_ID,
          projectId
        );

        const member = await getMember({
          databases,
          workspaceId: project.workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        const prs = await databases.listDocuments(
          DATABASE_ID,
          GITHUB_PRS_ID,
          [
            Query.equal("projectId", projectId),
            Query.orderDesc("processedAt"),
            Query.limit(100),
          ]
        );

        return c.json({ data: prs.documents });
      } catch (error: unknown) {
        console.error("[GitHub Get Project PRs Error]:", error);
        return c.json(
          {
            error: "Failed to fetch project pull requests",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          500
        );
      }
    }
  );

export default app;
