import { Databases, Query } from "node-appwrite";
import type { Models } from "node-appwrite";

import {
  CODE_DOCS_ID,
  DATABASE_ID,
  GITHUB_REPOS_ID,
  MEMBERS_ID,
  NOTIFICATIONS_ID,
  PROJECT_DOCS_ID,
  PROJECT_INTEGRATIONS_ID,
  PROJECTS_ID,
  WORK_ITEMS_ID,
  WORKSPACES_ID,
} from "@/config";
import type { AgentContext } from "../types";

type MemberDoc = Models.Document & { workspaceId: string };
type WorkspaceDoc = Models.Document & { name: string; imageUrl?: string; inviteCode?: string };
type ProjectDoc = Models.Document & {
  name: string;
  workspaceId: string;
  description?: string;
  status?: string;
  key?: string;
};
type WorkItemDoc = Models.Document & {
  key?: string;
  title: string;
  type?: string;
  status?: string;
  priority?: string;
  workspaceId?: string;
  projectId?: string;
};

async function safeList(
  databases: Databases,
  collectionId: string,
  queries: string[],
): Promise<Models.Document[]> {
  try {
    const result = await databases.listDocuments(DATABASE_ID, collectionId, queries);
    return result.documents;
  } catch {
    return [];
  }
}

export async function loadAgentContext(
  databases: Databases,
  user: { $id: string; name?: string; email?: string },
): Promise<AgentContext> {
  const members = await databases.listDocuments(DATABASE_ID, MEMBERS_ID, [
    Query.equal("userId", user.$id),
    Query.limit(100),
  ]);
  const workspaceIds = Array.from(
    new Set(members.documents.map((doc) => (doc as MemberDoc).workspaceId).filter(Boolean)),
  ).slice(0, 100);

  const workspaces = workspaceIds.length
    ? ((await databases.listDocuments(DATABASE_ID, WORKSPACES_ID, [
        Query.contains("$id", workspaceIds),
        Query.limit(100),
      ])).documents as WorkspaceDoc[])
    : [];

  const projects = workspaceIds.length
    ? ((await safeList(databases, PROJECTS_ID, [
        Query.equal("workspaceId", workspaceIds),
        Query.limit(100),
      ])) as ProjectDoc[])
    : [];

  const workItems = (await safeList(databases, WORK_ITEMS_ID, [
    Query.equal("assigneeIds", user.$id),
    Query.orderDesc("$createdAt"),
    Query.limit(20),
  ])) as WorkItemDoc[];

  const notifications = await safeList(databases, NOTIFICATIONS_ID, [
    Query.equal("userId", user.$id),
    Query.orderDesc("$createdAt"),
    Query.limit(20),
  ]);

  const githubRepos = workspaceIds.length
    ? await safeList(databases, GITHUB_REPOS_ID, [
        Query.equal("workspaceId", workspaceIds),
        Query.limit(50),
      ])
    : [];

  const projectIds = projects.map((project) => project.$id).slice(0, 100);
  const integrations = workspaceIds.length
    ? await safeList(databases, PROJECT_INTEGRATIONS_ID, [
        Query.equal("workspaceId", workspaceIds),
        Query.limit(50),
      ])
    : [];
  const integrationsByProject =
    integrations.length === 0 && projectIds.length
      ? await safeList(databases, PROJECT_INTEGRATIONS_ID, [
          Query.equal("projectId", projectIds),
          Query.limit(50),
        ])
      : [];

  const docs = workspaceIds.length
    ? await safeList(databases, PROJECT_DOCS_ID, [
        Query.equal("workspaceId", workspaceIds),
        Query.limit(50),
      ])
    : [];
  const codeDocs = workspaceIds.length
    ? await safeList(databases, CODE_DOCS_ID, [
        Query.equal("workspaceId", workspaceIds),
        Query.limit(50),
      ])
    : [];

  return {
    user: {
      id: user.$id,
      name: user.name || "",
      email: user.email || "",
    },
    workspaces: workspaces.map((workspace) => ({
      id: workspace.$id,
      name: workspace.name,
      imageUrl: workspace.imageUrl,
      inviteCode: workspace.inviteCode,
    })),
    projects: projects.map((project) => ({
      id: project.$id,
      name: project.name,
      workspaceId: project.workspaceId,
      description: project.description,
      status: project.status,
      key: project.key,
    })),
    workItems: workItems.map((item) => ({
      id: item.$id,
      key: item.key,
      title: item.title,
      type: item.type,
      status: item.status,
      priority: item.priority,
      workspaceId: item.workspaceId,
      projectId: item.projectId,
    })),
    notifications: notifications.map((item) => ({
      id: item.$id,
      title: String(item.title ?? item.name ?? ""),
      message: String(item.message ?? item.body ?? ""),
      isRead: Boolean(item.isRead),
      workspaceId: String(item.workspaceId ?? ""),
      createdAt: item.$createdAt,
    })),
    githubRepos: githubRepos.map((repo) => ({
      id: repo.$id,
      repositoryName: String(repo.repositoryName ?? repo.name ?? ""),
      owner: String(repo.owner ?? ""),
      githubUrl: String(repo.githubUrl ?? ""),
      workspaceId: String(repo.workspaceId ?? ""),
      projectId: String(repo.projectId ?? ""),
      branch: String(repo.branch ?? ""),
    })),
    integrations: [...integrations, ...integrationsByProject].map((item) => ({
      id: item.$id,
      provider: String(item.provider ?? ""),
      projectId: String(item.projectId ?? ""),
      workspaceId: String(item.workspaceId ?? ""),
      name: String(item.name ?? item.provider ?? ""),
    })),
    docs: [...docs, ...codeDocs].map((doc) => ({
      id: doc.$id,
      title: String(doc.title ?? ""),
      name: String(doc.name ?? ""),
      description: String(doc.description ?? ""),
      projectId: String(doc.projectId ?? ""),
      workspaceId: String(doc.workspaceId ?? ""),
      category: String(doc.category ?? ""),
    })),
  };
}
