import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "crypto";
import { ID, Query, Databases } from "node-appwrite";

import {
  DATABASE_ID,
  GITHUB_REPOS_ID,
  GITHUB_EVENTS_ID,
  GITHUB_COMMITS_ID,
  GITHUB_PRS_ID,
  GITHUB_ISSUES_ID,
  GITHUB_RELEASES_ID,
} from "@/config";
import { createAdminClient } from "@/lib/appwrite";
import { replaceGitHubImagesInMarkdown } from "./image-sync";

import { GitHubRepository, GitHubWebhookEventType } from "../types";
import {
  parseTaskIdsFromCommitMessage,
  parseTaskIdFromBranchName,
  parseTaskIdsFromPRTitle,
} from "../lib/task-parser";


// ─── Types for GitHub webhook payloads ──────────────────

interface GitHubPushPayload {
  ref: string; // "refs/heads/main"
  commits: Array<{
    id: string;
    message: string;
    url: string;
    author: {
      name: string;
      email: string;
      username?: string;
    };
    added: string[];
    removed: string[];
    modified: string[];
  }>;
  repository: {
    full_name: string;
  };
}

interface GitHubPullRequestPayload {
  action: string;
  number: number;
  pull_request: {
    title: string;
    html_url: string;
    state: string;
    merged: boolean;
    head: { ref: string };
    base: { ref: string };
    user: { login: string; avatar_url: string };
    additions: number;
    deletions: number;
    changed_files: number;
  };
  repository: {
    full_name: string;
  };
}

// ─── Webhook Signature Verification ──────────────────

/**
 * Verify the HMAC-SHA256 signature from GitHub webhooks.
 * Uses timing-safe comparison to prevent timing attacks.
 */
function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  // GitHub sends: sha256=<hex>
  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") return false;

  const signature = parts[1]!;
  const expectedSignature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch {
    return false;
  }
}

// ─── Route Handler ──────────────────

const app = new Hono()
  /**
   * POST /incoming/:projectId — Receive inbound GitHub webhook events.
   *
   * This endpoint is called by GitHub when events occur on linked repositories.
   * It does NOT use sessionMiddleware — it authenticates via HMAC signature.
   */
  .post("/incoming/:projectId", async (c) => {
    const { projectId } = c.req.param();
    const eventType = c.req.header("X-GitHub-Event");
    const signatureHeader = c.req.header("X-Hub-Signature-256");
    const deliveryId = c.req.header("X-GitHub-Delivery");

    // Validate required headers
    if (!eventType) {
      return c.json({ error: "Missing X-GitHub-Event header" }, 400);
    }
    if (!deliveryId) {
      return c.json({ error: "Missing X-GitHub-Delivery header" }, 400);
    }

    // Get raw body for signature verification
    const rawBody = await c.req.text();

    // Get the admin client (webhooks don't have user sessions)
    const { databases } = await createAdminClient();

    // Find the linked repository for this project
    const repositories = await databases.listDocuments<GitHubRepository>(
      DATABASE_ID,
      GITHUB_REPOS_ID,
      [Query.equal("projectId", projectId), Query.limit(1)]
    );

    if (repositories.total === 0) {
      return c.json({ error: "No repository linked to this project" }, 404);
    }

    const repository = repositories.documents[0];

    // Verify webhook signature if a secret is configured
    // For now, we generate a webhook secret when registering the webhook
    // and store it on the repository document.
    // If no webhookSecret is stored yet (legacy repos), skip verification but log a warning.
    const webhookSecret = (repository as GitHubRepository & { webhookSecret?: string }).webhookSecret;

    if (webhookSecret && signatureHeader) {
      const isValid = verifyWebhookSignature(rawBody, signatureHeader, webhookSecret);
      if (!isValid) {
        console.error(`[GitHub Webhook] Invalid signature for project ${projectId}`);
        return c.json({ error: "Invalid webhook signature" }, 401);
      }
    } else if (!webhookSecret) {
      console.warn(`[GitHub Webhook] No webhook secret configured for project ${projectId} — skipping signature verification`);
    }

    // Check for duplicate delivery (idempotency)
    try {
      const existingEvents = await databases.listDocuments(
        DATABASE_ID,
        GITHUB_EVENTS_ID,
        [Query.equal("githubDeliveryId", deliveryId), Query.limit(1)]
      );

      if (existingEvents.total > 0) {
        return c.json({ message: "Event already processed" }, 200);
      }
    } catch {
      // Collection might not exist yet — continue processing
    }

    // Parse the payload
    const payload = JSON.parse(rawBody);

    // Handle ping event (sent when webhook is first created)
    if (eventType === "ping") {
      return c.json({ message: "pong" });
    }

    // Process based on event type
    try {
      switch (eventType) {
        case "push":
          await processPushEvent(databases, projectId, payload, deliveryId, rawBody);
          break;

        case "pull_request":
          await processPullRequestEvent(databases, projectId, payload, deliveryId, rawBody);
          break;

        case "issues":
          await processIssuesEvent(databases, projectId, payload, deliveryId);
          break;

        case "release":
          await processReleaseEvent(databases, projectId, payload, deliveryId);
          break;

        default:
          console.log(`[GitHub Webhook] Unhandled event type: ${eventType}`);
          return c.json({ message: `Event type '${eventType}' not processed` }, 200);
      }

      return c.json({ message: "Event processed successfully" });
    } catch (error) {
      console.error(`[GitHub Webhook] Error processing ${eventType} event:`, error);
      return c.json({ error: "Failed to process webhook event" }, 500);
    }
  });

// ─── Event Processors ──────────────────

async function processPushEvent(
  databases: Databases,
  projectId: string,
  payload: GitHubPushPayload,
  deliveryId: string,
  rawBody: string
) {
  const branchName = payload.ref.replace("refs/heads/", "");
  const repoFullName = payload.repository.full_name;

  for (const commit of payload.commits) {
    // Collect task IDs from commit message + branch name
    const taskIdsFromMessage = parseTaskIdsFromCommitMessage(commit.message);
    const taskIdFromBranch = parseTaskIdFromBranchName(branchName);
    const allTaskIds = [...new Set([
      ...taskIdsFromMessage,
      ...(taskIdFromBranch ? [taskIdFromBranch] : []),
    ])];

    try {
      await databases.createDocument(
        DATABASE_ID,
        GITHUB_EVENTS_ID,
        ID.unique(),
        {
          projectId,
          eventType: GitHubWebhookEventType.PUSH,
          taskIds: allTaskIds,
          commitSha: commit.id,
          commitMessage: commit.message.slice(0, 500),
          commitUrl: commit.url,
          authorName: commit.author.name,
          authorEmail: commit.author.email,
          branchName,
          repoFullName,
          githubDeliveryId: deliveryId,
          rawPayload: rawBody.slice(0, 10000),
          processedAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error(`[GitHub Webhook] Failed to store push event in github_events:`, error);
    }

    if (allTaskIds.length > 0) {
      for (const taskId of allTaskIds) {
        try {
          await databases.createDocument(
            DATABASE_ID,
            GITHUB_COMMITS_ID,
            ID.unique(),
            {
              projectId,
              taskId: taskId.toUpperCase(),
              commitSha: commit.id,
              commitMessage: commit.message.slice(0, 1000),
              commitUrl: commit.url,
              authorName: commit.author.name,
              authorEmail: commit.author.email,
              branchName,
              repoFullName,
              processedAt: new Date().toISOString(),
            }
          );

          // ======= Post Comment to Fairlx Task =======
          try {
            const { TASKS_ID, COMMENTS_ID } = await import("@/config");
            const tasks = await databases.listDocuments(
              DATABASE_ID,
              TASKS_ID,
              [
                Query.equal("projectId", projectId),
                Query.equal("key", taskId.toUpperCase()),
                Query.limit(1)
              ]
            );
            
            if (tasks.total > 0) {
              const taskDoc = tasks.documents[0];
              const commitHash = commit.id.substring(0, 7);
              const markdownComment = `### 🔗 GitHub Commit Linked\n\n**${commit.author.name}** pushed a commit related to this work item:\n\n> [\`${commitHash}\`](${commit.url}) - ${commit.message.split('\\n')[0]}`;
              
              await databases.createDocument(
                DATABASE_ID,
                COMMENTS_ID,
                ID.unique(),
                {
                  content: markdownComment,
                  taskId: taskDoc.$id,
                  workspaceId: taskDoc.workspaceId,
                  projectId: projectId,
                  authorId: "github-webhook",
                  isEdited: false,
                }
              );
            }
          } catch (err) {
            console.error(`[GitHub Webhook] Failed to post comment to task:`, err);
          }
          // ======= END Post Comment =======

        } catch (error) {
          console.error(`[GitHub Webhook] Failed to store push event in github_commits:`, error);
        }
      }
    } else {
      try {
        await databases.createDocument(
          DATABASE_ID,
          GITHUB_COMMITS_ID,
          ID.unique(),
          {
            projectId,
            taskId: "",
            commitSha: commit.id,
            commitMessage: commit.message.slice(0, 1000),
            commitUrl: commit.url,
            authorName: commit.author.name,
            authorEmail: commit.author.email,
            branchName,
            repoFullName,
            processedAt: new Date().toISOString(),
          }
        );
      } catch (error) {
        console.error(`[GitHub Webhook] Failed to store unlinked commit:`, error);
      }
    }
  }
}

async function processPullRequestEvent(
  databases: Databases,
  projectId: string,
  payload: GitHubPullRequestPayload,
  deliveryId: string,
  rawBody: string
) {
  const pr = payload.pull_request;
  const repoFullName = payload.repository.full_name;

  const taskIdsFromTitle = parseTaskIdsFromPRTitle(pr.title);
  const taskIdFromBranch = parseTaskIdFromBranchName(pr.head.ref);
  const allTaskIds = [...new Set([
    ...taskIdsFromTitle,
    ...(taskIdFromBranch ? [taskIdFromBranch] : []),
  ])];

  let prState = pr.state;
  if (pr.merged) {
    prState = "merged";
  }

  try {
    await databases.createDocument(
      DATABASE_ID,
      GITHUB_EVENTS_ID,
      ID.unique(),
      {
        projectId,
        eventType: GitHubWebhookEventType.PULL_REQUEST,
        taskIds: allTaskIds,
        branchName: pr.head.ref,
        repoFullName,
        prNumber: payload.number,
        prTitle: pr.title.slice(0, 300),
        prState,
        prUrl: pr.html_url,
        githubDeliveryId: `${deliveryId}-pr-${payload.number}`,
        rawPayload: rawBody.slice(0, 10000),
        processedAt: new Date().toISOString(),
      }
    );
  } catch (error) {
    console.error(`[GitHub Webhook] Failed to store PR event in github_events:`, error);
  }

  if (allTaskIds.length > 0) {
    for (const taskId of allTaskIds) {
      try {
        const existingPrs = await databases.listDocuments(
          DATABASE_ID,
          GITHUB_PRS_ID,
          [
            Query.equal("projectId", projectId),
            Query.equal("taskId", taskId.toUpperCase()),
            Query.equal("prNumber", payload.number),
            Query.limit(1)
          ]
        );

        if (existingPrs.total > 0) {
          await databases.updateDocument(
            DATABASE_ID,
            GITHUB_PRS_ID,
            existingPrs.documents[0].$id,
            {
              prState,
              prTitle: pr.title.slice(0, 1024),
              processedAt: new Date().toISOString(),
            }
          );
        } else {
          await databases.createDocument(
            DATABASE_ID,
            GITHUB_PRS_ID,
            ID.unique(),
            {
              projectId,
              taskId: taskId.toUpperCase(),
              prNumber: payload.number,
              prTitle: pr.title.slice(0, 1024),
              prState,
              prUrl: pr.html_url,
              branchName: pr.head.ref,
              repoFullName,
              processedAt: new Date().toISOString(),
            }
          );
        }
      } catch (error) {
        console.error(`[GitHub Webhook] Failed to update github_pull_requests:`, error);
      }
    }
  } else {
    try {
      const existingPrs = await databases.listDocuments(
        DATABASE_ID,
        GITHUB_PRS_ID,
        [
          Query.equal("projectId", projectId),
          Query.equal("taskId", ""),
          Query.equal("prNumber", payload.number),
          Query.limit(1)
        ]
      );

      if (existingPrs.total > 0) {
        await databases.updateDocument(
          DATABASE_ID,
          GITHUB_PRS_ID,
          existingPrs.documents[0].$id,
          {
            prState,
            prTitle: pr.title.slice(0, 1024),
            processedAt: new Date().toISOString(),
          }
        );
      } else {
        await databases.createDocument(
          DATABASE_ID,
          GITHUB_PRS_ID,
          ID.unique(),
          {
            projectId,
            taskId: "",
            prNumber: payload.number,
            prTitle: pr.title.slice(0, 1024),
            prState,
            prUrl: pr.html_url,
            branchName: pr.head.ref,
            repoFullName,
            processedAt: new Date().toISOString(),
          }
        );
      }
    } catch (error) {
      console.error(`[GitHub Webhook] Failed to update unlinked github_pull_requests:`, error);
    }
  }
}

interface GitHubIssuePayload {
  action: "opened" | "edited" | "closed" | "reopened";
  issue: {
    id: number;
    node_id: string;
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    state: "open" | "closed";
    labels?: Array<{ name: string }>;
  };
  repository: {
    full_name: string;
  };
}

async function processIssuesEvent(
  databases: Databases,
  projectId: string,
  payload: GitHubIssuePayload,
  _deliveryId: string
) {
  const { action, issue, repository: repo } = payload;
  const repoFullName = repo.full_name;

  const repositories = await databases.listDocuments<GitHubRepository>(
    DATABASE_ID,
    GITHUB_REPOS_ID,
    [Query.equal("projectId", projectId), Query.limit(1)]
  );

  if (repositories.total === 0) return;
  const repoConfig = repositories.documents[0];
  const createTasksFromIssues = repoConfig.createTasksFromIssues;

  // Decrypt access token and initialize storage for image processing
  let decryptedToken = repoConfig.accessToken;
  if (decryptedToken && decryptedToken.includes(":")) {
    const { decryptToken } = await import("../lib/encryption");
    decryptedToken = decryptToken(decryptedToken);
  }
  const { storage } = await createAdminClient();

  const rawBodyText = issue.body || "";
  const processedDescription = await replaceGitHubImagesInMarkdown(
    rawBodyText,
    decryptedToken,
    storage
  );

  const mappedIssues = await databases.listDocuments(
    DATABASE_ID,
    GITHUB_ISSUES_ID,
    [
      Query.equal("projectId", projectId),
      Query.equal("issueId", String(issue.id)),
      Query.limit(1)
    ]
  );

  const isMapped = mappedIssues.total > 0;

  if (action === "opened") {
    if (isMapped) return;

    let taskId: string | undefined = undefined;

    if (createTasksFromIssues) {
      const { PROJECTS_ID, TASKS_ID, WORKFLOW_STATUSES_ID } = await import("@/config");
      
      let project;
      try {
        project = await databases.getDocument(DATABASE_ID, PROJECTS_ID, projectId);
      } catch {
        console.error("[GitHub Sync] Project not found:", projectId);
        return;
      }

      let initialStatus = "TODO";
      if (project.workflowId) {
        try {
          const workflowStatuses = await databases.listDocuments(
            DATABASE_ID,
            WORKFLOW_STATUSES_ID,
            [
              Query.equal("workflowId", project.workflowId),
              Query.equal("isInitial", true),
              Query.limit(1)
            ]
          );
          if (workflowStatuses.total > 0) {
            initialStatus = workflowStatuses.documents[0].key;
          }
        } catch (err) {
          console.error("[GitHub Sync] Workflow initial status fetch error:", err);
        }
      }

      const projectKey = project.name.substring(0, 3).toUpperCase();
      const existingItems = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [Query.equal("projectId", projectId)]
      );
      const keyNumber = existingItems.total + 1;
      const taskKey = `${projectKey}-${keyNumber}`;

      let type = "ISSUE";
      const labels = issue.labels?.map(l => l.name.toLowerCase()) || [];
      if (labels.includes("bug") || labels.includes("defect") || labels.includes("error")) {
        type = "BUG";
      }

      try {
        const task = await databases.createDocument(
          DATABASE_ID,
          TASKS_ID,
          ID.unique(),
          {
            title: issue.title,
            type,
            key: taskKey,
            status: initialStatus,
            workspaceId: project.workspaceId,
            projectId,
            description: processedDescription || "No description provided.",
            priority: "MEDIUM",
            labels: issue.labels?.map(l => l.name) || [],
            position: 1000,
            flagged: false,
            lastModifiedBy: "github-webhook",
          }
        );
        taskId = task.$id;
        console.log(`[GitHub Sync] Mapped new task ${taskKey} from GitHub issue #${issue.number}`);
      } catch (err) {
        console.error("[GitHub Sync] Failed to create task from GitHub issue:", err);
      }
    }

    // Always create the GITHUB_ISSUES mapping so it shows up in the Issues list
    try {
      await databases.createDocument(
        DATABASE_ID,
        GITHUB_ISSUES_ID,
        ID.unique(),
        {
          projectId,
          taskId: taskId || "",
          issueId: String(issue.id),
          issueNumber: issue.number,
          issueUrl: issue.html_url,
          repoFullName,
          lastSyncedAt: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[GitHub Sync] Failed to create issue mapping:", err);
    }
  } else if (isMapped) {
    const mapping = mappedIssues.documents[0];
    const taskId = mapping.taskId as string;
    const { TASKS_ID } = await import("@/config");

    if (action === "closed") {
      if (taskId) {
        try {
          await databases.updateDocument(DATABASE_ID, TASKS_ID, taskId, {
            status: "DONE",
            lastModifiedBy: "github-webhook",
          });
          console.log(`[GitHub Sync] Closed task ${taskId} from GitHub issue #${issue.number} close`);
        } catch (err) {
          console.error("[GitHub Sync] Failed to update task status to DONE:", err);
        }
      }
    } else if (action === "reopened") {
      if (taskId) {
        try {
          await databases.updateDocument(DATABASE_ID, TASKS_ID, taskId, {
            status: "IN_PROGRESS",
            lastModifiedBy: "github-webhook",
          });
          console.log(`[GitHub Sync] Reopened task ${taskId} from GitHub issue #${issue.number} reopen`);
        } catch (err) {
          console.error("[GitHub Sync] Failed to update task status to IN_PROGRESS:", err);
        }
      }
    } else if (action === "edited") {
      if (taskId) {
        try {
          await databases.updateDocument(DATABASE_ID, TASKS_ID, taskId, {
            title: issue.title,
            description: processedDescription || "",
            lastModifiedBy: "github-webhook",
          });
          console.log(`[GitHub Sync] Updated task ${taskId} fields from GitHub issue #${issue.number} edits`);
        } catch (err) {
          console.error("[GitHub Sync] Failed to update task fields:", err);
        }
      }
    }

    // Always update lastSyncedAt on mapping
    try {
      await databases.updateDocument(
        DATABASE_ID,
        GITHUB_ISSUES_ID,
        mapping.$id,
        {
          lastSyncedAt: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[GitHub Sync] Failed to update issue mapping sync time:", err);
    }
  }
}

interface GitHubReleasePayload {
  action: string;
  release: {
    id: number;
    tag_name: string;
    name: string;
    body: string | null;
    html_url: string;
    published_at: string;
  };
}

async function processReleaseEvent(
  databases: Databases,
  projectId: string,
  payload: GitHubReleasePayload,
  _deliveryId: string
) {
  const { release } = payload;

  try {
    const existing = await databases.listDocuments(
      DATABASE_ID,
      GITHUB_RELEASES_ID,
      [
        Query.equal("projectId", projectId),
        Query.equal("releaseId", String(release.id)),
        Query.limit(1)
      ]
    );

    if (existing.total > 0) {
      await databases.updateDocument(
        DATABASE_ID,
        GITHUB_RELEASES_ID,
        existing.documents[0].$id,
        {
          tagName: release.tag_name,
          name: release.name || release.tag_name,
          htmlUrl: release.html_url,
          publishedAt: release.published_at || new Date().toISOString(),
          body: release.body || "",
        }
      );
    } else {
      await databases.createDocument(
        DATABASE_ID,
        GITHUB_RELEASES_ID,
        ID.unique(),
        {
          projectId,
          releaseId: String(release.id),
          tagName: release.tag_name,
          name: release.name || release.tag_name,
          htmlUrl: release.html_url,
          publishedAt: release.published_at || new Date().toISOString(),
          body: release.body || "",
        }
      );
    }
    console.log(`[GitHub Webhook] Successfully processed release: ${release.tag_name}`);
  } catch (error) {
    console.error("[GitHub Webhook] Failed to process release event:", error);
  }
}

export default app;
