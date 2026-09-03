import type { InjectedContext, PersonaRole, WorkspaceRole } from "./types";
import { normalizeWorkspaceRole } from "./roles";

/** Minimal Fairlx AgentContext shape used by the existing agent runtime. */
export type FairlxAgentContext = {
  user: { id: string; name: string; email: string };
  workspaces: Array<{ id: string; name: string; role?: string }>;
  projects: Array<{ id: string; name: string; workspaceId: string; key?: string }>;
  workItems: Array<{
    id: string;
    key?: string;
    title: string;
    status?: string;
    priority?: string;
    type?: string;
    workspaceId?: string;
    projectId?: string;
    dueDate?: string;
    flagged?: boolean;
    createdAt?: string;
  }>;
  githubRepos: Array<{
    id: string;
    owner?: string;
    repositoryName?: string;
    branch?: string;
    githubUrl?: string;
    workspaceId?: string;
    projectId?: string;
  }>;
  docs: Array<{ id: string; title?: string; projectId?: string }>;
};

export function agentContextToInjected(
  context: FairlxAgentContext,
  options?: { workspaceId?: string; projectId?: string; personaRole?: PersonaRole },
): InjectedContext {
  const workspace =
    context.workspaces.find((item) => item.id === options?.workspaceId) ?? context.workspaces[0];
  const project =
    context.projects.find((item) => item.id === options?.projectId) ??
    context.projects.find((item) => item.workspaceId === workspace?.id);
  const workItems = context.workItems.filter((item) => !project || item.projectId === project.id);
  const workspaceRole = normalizeWorkspaceRole(workspace?.role) as WorkspaceRole;
  return {
    user: context.user,
    workspaceRole,
    personaRole: options?.personaRole,
    workspaceId: workspace?.id,
    projectId: project?.id,
    workspaceName: workspace?.name,
    projectName: project?.name,
    projectKey: project?.key,
    entities: [
      ...workItems.slice(0, 20).map((item) => ({
        entityType: "WORK_ITEM" as const,
        referenceKey: item.key || item.title,
        id: item.id,
        data: { ...item },
      })),
      ...context.docs.slice(0, 8).map((doc) => ({
        entityType: "DOC" as const,
        referenceKey: doc.title || doc.id,
        id: doc.id,
        data: { title: doc.title },
      })),
    ],
    workItems: workItems.map((item) => ({
      id: item.id,
      key: item.key,
      title: item.title,
      status: item.status,
      priority: item.priority,
      type: item.type,
      dueAt: item.dueDate,
      flagged: item.flagged,
      workspaceId: item.workspaceId,
      createdAt: item.createdAt,
    })),
    sprints: [],
    blockers: workItems
      .filter((item) => /block/i.test(item.status || ""))
      .map((item) => ({ id: item.id, key: item.key, title: item.title, status: item.status })),
    unassigned: [],
    repos: context.githubRepos.map((repo) => ({
      id: repo.id,
      owner: repo.owner,
      name: repo.repositoryName,
      branch: repo.branch,
      url: repo.githubUrl,
    })),
  };
}

export function toFairlxRunPatch(run: {
  parentRunId?: string;
  subAgentType?: string;
  waitingForRunId?: string;
  allowedTools: string[];
  qaReport?: unknown;
}) {
  return {
    parentRunId: run.parentRunId ?? "",
    subAgentType: run.subAgentType ?? "",
    waitingForRunId: run.waitingForRunId ?? "",
    allowedToolsJson: JSON.stringify(run.allowedTools),
    qaReportJson: run.qaReport ? JSON.stringify(run.qaReport) : "",
  };
}
