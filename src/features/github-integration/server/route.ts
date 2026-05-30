import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { ID, Query } from "node-appwrite";

import {
  DATABASE_ID,
  GITHUB_REPOS_ID,
  PROJECTS_ID,
  CODE_DOCS_ID,
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
        const api = githubToken ? new GitHubAPI(githubToken) : githubAPI;

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
          
          repository = await databases.updateDocument<GitHubRepository>(
            DATABASE_ID,
            GITHUB_REPOS_ID,
            existing.documents[0].$id,
            {
              githubUrl: githubUrl.toLowerCase(),
              repositoryName: repo,
              owner,
              branch,
              accessToken: githubToken || undefined,
              status: "connected",
              lastSyncedAt: new Date().toISOString(),
              error: null,
              lastModifiedBy: user.$id,
            }
          );
        } else {
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
  );

export default app;
