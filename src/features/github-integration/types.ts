import { Models } from "node-appwrite";

export type GitHubRepository = Models.Document & {
  projectId: string;
  workspaceId: string;
  githubUrl: string;
  repositoryName: string;
  owner: string;
  branch: string;
  accessToken?: string;
  lastSyncedAt: string;
  status: "connected" | "syncing" | "error" | "disconnected" | "authenticating";
  error?: string;
  createdBy?: string;
  lastModifiedBy?: string;
  webhookId?: number;
  webhookSecret?: string;
  autoFetchCommits?: boolean;
  linkCommitsToTasks?: boolean;
  syncComments?: boolean;
  allowPrMerge?: boolean;
  createTasksFromIssues?: boolean;
};


export type CodeDocumentation = Models.Document & {
  projectId: string;
  content: string;
  generatedAt: string;
  fileStructure?: string;
  mermaidDiagram?: string;
};

export type CommitSummary = Models.Document & {
  projectId: string;
  commitHash: string;
  commitMessage: string;
  author: string;
  authorAvatar?: string;
  timestamp: string;
  summary: string;
  filesChanged: number;
  additions: number;
  deletions: number;
};

export type CodebaseQuestion = Models.Document & {
  projectId: string;
  userId: string;
  question: string;
  answer: string;
  timestamp: string;
  upvotes: number;
};

export type FileAnalysis = {
  path: string;
  summary: string;
  language: string;
  lines: number;
};

// ─── OAuth & Webhook Types ──────────────────

export enum GitHubWebhookEventType {
  PUSH = "PUSH",
  PULL_REQUEST = "PULL_REQUEST",
  ISSUES = "ISSUES",
  RELEASE = "RELEASE",
}

/**
 * Record of a processed GitHub webhook event, stored in the `github_events` collection.
 */
export type GitHubEvent = Models.Document & {
  projectId: string;
  eventType: GitHubWebhookEventType;
  taskIds: string[];
  commitSha?: string;
  commitMessage?: string;
  commitUrl?: string;
  authorName?: string;
  authorEmail?: string;
  branchName?: string;
  repoFullName: string;
  prNumber?: number;
  prTitle?: string;
  prState?: string;
  prUrl?: string;
  githubDeliveryId: string;
  rawPayload?: string;
  processedAt: string;
};

/**
 * Encrypted state passed through the OAuth flow to prevent CSRF
 * and associate the callback with the correct project.
 */
export interface GitHubOAuthState {
  projectId: string;
  userId: string;
  timestamp: number;
  githubUrl?: string;
  branch?: string;
}


