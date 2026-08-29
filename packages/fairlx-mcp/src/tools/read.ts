import { invalidParams, notFoundError } from "../protocol/errors";
import type { McpToolResult } from "../protocol/types";
import type { AuthContext } from "../auth/context";
import { PERMISSIONS, type McpQuery, type McpRuntime } from "../runtime/types";
import { compactWorkItem, toolResult, withId, wrapUntrusted } from "../runtime/output";
import { requireProjectAccess, assertWorkspaceBound } from "../runtime/rbac";
import { loadProject, loadWorkItem } from "../runtime/tenant";
import { listQuery, optionalString, requireString } from "./helpers";

export async function handleReadTool(
  name: string,
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  switch (name) {
    case "fairlx_workspace_list":
      return workspaceList(args, runtime, auth);
    case "fairlx_project_list":
      return projectList(args, runtime, auth);
    case "fairlx_project_get":
      return projectGet(args, runtime, auth);
    case "fairlx_project_members_list":
      return projectMembersList(args, runtime, auth);
    case "fairlx_work_item_list":
      return workItemList(args, runtime, auth);
    case "fairlx_work_item_get":
      return workItemGet(args, runtime, auth);
    case "fairlx_sprint_list":
      return sprintList(args, runtime, auth);
    case "fairlx_sprint_get":
      return sprintGet(args, runtime, auth);
    case "fairlx_link_list":
      return linkList(args, runtime, auth);
    case "fairlx_comment_list":
      return commentList(args, runtime, auth);
    case "fairlx_time_log_list":
      return timeLogList(args, runtime, auth);
    case "fairlx_doc_list":
      return docList(args, runtime, auth);
    case "fairlx_doc_get":
      return docGet(args, runtime, auth);
    case "fairlx_workflow_get":
      return workflowGet(args, runtime, auth);
    case "fairlx_agent_context_get":
      return agentContextGet(args, runtime, auth);
    default:
      throw invalidParams(`Unknown read tool: ${name}`);
  }
}

async function workspaceList(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const members = await runtime.store.list<Record<string, unknown>>(runtime.collections.members, [
    { type: "equal", field: "userId", value: auth.actorUserId },
    { type: "limit", value: 100 },
  ]);
  let workspaceIds = members.documents
    .map((m) => String(m.workspaceId ?? ""))
    .filter(Boolean);
  if (auth.workspaceId) {
    workspaceIds = workspaceIds.filter((id) => id === auth.workspaceId);
  }
  const workspaces = [];
  for (const id of workspaceIds.slice(0, typeof args.limit === "number" ? args.limit : 50)) {
    try {
      const ws = await runtime.store.get<Record<string, unknown>>(runtime.collections.workspaces, id);
      workspaces.push(withId(ws));
    } catch {
      // skip missing
    }
  }
  return toolResult({ workspaces });
}

async function projectList(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const workspaceId = requireString(args, "workspaceId");
  assertWorkspaceBound(auth, workspaceId);
  const extra: McpQuery[] = [{ type: "equal", field: "workspaceId", value: workspaceId }];
  if (auth.projectId) extra.push({ type: "equal", field: "$id", value: auth.projectId });
  const result = await runtime.store.list<Record<string, unknown>>(
    runtime.collections.projects,
    listQuery(args, extra)
  );
  const visible = [];
  for (const project of result.documents) {
    try {
      await requireProjectAccess(
        runtime,
        auth,
        String(project.$id),
        PERMISSIONS.VIEW_PROJECT,
        ["project:read"]
      );
      visible.push(withId(project));
    } catch {
      // hide unauthorized
    }
  }
  return toolResult({ projects: visible, total: visible.length });
}

async function projectGet(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const projectId = requireString(args, "projectId");
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.VIEW_PROJECT, ["project:read"]);
  const project = await loadProject(runtime, auth, projectId);
  return toolResult({ project: withId(project) });
}

async function projectMembersList(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const projectId = requireString(args, "projectId");
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.VIEW_MEMBERS, ["project:read"]);
  let members = await runtime.store.list<Record<string, unknown>>(runtime.collections.projectMembers, [
    { type: "equal", field: "projectId", value: projectId },
    { type: "limit", value: 100 },
  ]);
  if (members.documents.length === 0) {
    members = await runtime.store.list<Record<string, unknown>>(
      runtime.collections.projectTeamMembers,
      [
        { type: "equal", field: "projectId", value: projectId },
        { type: "limit", value: 100 },
      ]
    );
  }
  return toolResult({ members: members.documents.map((m) => withId(m)) });
}

async function workItemList(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const projectId = requireString(args, "projectId");
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.VIEW_TASKS, ["tasks:read"]);
  const extra: McpQuery[] = [{ type: "equal", field: "projectId", value: projectId }];
  const sprintId = optionalString(args, "sprintId");
  const status = optionalString(args, "status");
  const type = optionalString(args, "type");
  if (sprintId) extra.push({ type: "equal", field: "sprintId", value: sprintId });
  if (status) extra.push({ type: "equal", field: "status", value: status });
  if (type) extra.push({ type: "equal", field: "type", value: type });
  const result = await runtime.store.list<Record<string, unknown>>(
    runtime.collections.workItems,
    listQuery(args, extra)
  );
  return toolResult({
    workItems: result.documents.map((d) => compactWorkItem(d)),
    total: result.total,
  });
}

async function workItemGet(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const workItemId = requireString(args, "workItemId");
  const item = await loadWorkItem(runtime, auth, workItemId);
  await requireProjectAccess(
    runtime,
    auth,
    String(item.projectId),
    PERMISSIONS.VIEW_TASKS,
    ["tasks:read"]
  );
  return toolResult({
    workItem: withId(item),
    untrusted: wrapUntrusted("work_item", {
      title: item.title,
      description: item.description,
    }),
  });
}

async function sprintList(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const projectId = requireString(args, "projectId");
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.VIEW_SPRINTS, ["sprints:read"]);
  const extra: McpQuery[] = [{ type: "equal", field: "projectId", value: projectId }];
  const status = optionalString(args, "status");
  if (status) extra.push({ type: "equal", field: "status", value: status });
  const result = await runtime.store.list<Record<string, unknown>>(
    runtime.collections.sprints,
    listQuery(args, extra)
  );
  return toolResult({ sprints: result.documents.map((d) => withId(d)), total: result.total });
}

async function sprintGet(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const sprintId = requireString(args, "sprintId");
  let sprint: Record<string, unknown>;
  try {
    sprint = await runtime.store.get<Record<string, unknown>>(runtime.collections.sprints, sprintId);
  } catch {
    throw notFoundError("Not found");
  }
  await requireProjectAccess(
    runtime,
    auth,
    String(sprint.projectId),
    PERMISSIONS.VIEW_SPRINTS,
    ["sprints:read"]
  );
  return toolResult({ sprint: withId(sprint) });
}

async function linkList(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const workItemId = optionalString(args, "workItemId");
  const projectIdArg = optionalString(args, "projectId");
  let projectId = projectIdArg;
  if (workItemId) {
    const item = await loadWorkItem(runtime, auth, workItemId);
    projectId = String(item.projectId);
  }
  if (!projectId) throw invalidParams("workItemId or projectId is required");
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.VIEW_TASKS, ["tasks:read"]);
  const extra: McpQuery[] = [{ type: "equal", field: "projectId", value: projectId }];
  const result = await runtime.store.list<Record<string, unknown>>(
    runtime.collections.workItemLinks,
    listQuery(args, extra)
  );
  let docs = result.documents;
  if (workItemId) {
    docs = docs.filter(
      (d) => d.sourceItemId === workItemId || d.targetItemId === workItemId
    );
  }
  return toolResult({ links: docs.map((d) => withId(d)) });
}

async function commentList(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const workItemId = requireString(args, "workItemId");
  const item = await loadWorkItem(runtime, auth, workItemId);
  await requireProjectAccess(
    runtime,
    auth,
    String(item.projectId),
    PERMISSIONS.VIEW_TASKS,
    ["tasks:read"]
  );
  const result = await runtime.store.list<Record<string, unknown>>(
    runtime.collections.comments,
    listQuery(args, [{ type: "equal", field: "taskId", value: workItemId }])
  );
  return toolResult({
    comments: result.documents.map((d) => ({
      ...withId(d),
      untrusted: wrapUntrusted("comment", d.content),
    })),
  });
}

async function timeLogList(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const workItemId = optionalString(args, "workItemId");
  const projectIdArg = optionalString(args, "projectId");
  let projectId = projectIdArg;
  if (workItemId) {
    const item = await loadWorkItem(runtime, auth, workItemId);
    projectId = String(item.projectId);
  }
  if (!projectId) throw invalidParams("workItemId or projectId is required");
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.VIEW_TASKS, ["tasks:read"]);
  const extra: McpQuery[] = workItemId
    ? [{ type: "equal", field: "taskId", value: workItemId }]
    : [{ type: "equal", field: "projectId", value: projectId }];
  const result = await runtime.store.list<Record<string, unknown>>(
    runtime.collections.timeLogs,
    listQuery(args, extra)
  );
  return toolResult({ timeLogs: result.documents.map((d) => withId(d)) });
}

async function docList(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const projectId = requireString(args, "projectId");
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.VIEW_DOCS, ["docs:read"]);
  const result = await runtime.store.list<Record<string, unknown>>(
    runtime.collections.projectDocs,
    listQuery(args, [{ type: "equal", field: "projectId", value: projectId }])
  );
  return toolResult({
    docs: result.documents.map((d) => ({
      id: d.$id,
      title: d.title ?? d.name,
      name: d.name,
      category: d.category,
      mimeType: d.mimeType,
      size: d.size,
      version: d.version,
      isArchived: d.isArchived,
      tags: d.tags,
    })),
  });
}

async function docGet(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const docId = requireString(args, "docId");
  let doc: Record<string, unknown>;
  try {
    doc = await runtime.store.get<Record<string, unknown>>(runtime.collections.projectDocs, docId);
  } catch {
    throw notFoundError("Not found");
  }
  const projectId = String(doc.projectId);
  if (args.projectId && args.projectId !== projectId) throw notFoundError("Not found");
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.VIEW_DOCS, ["docs:read"]);
  return toolResult({
    doc: withId(doc),
    untrusted: wrapUntrusted("document", doc.description ?? doc.title ?? doc.name),
  });
}

async function workflowGet(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const projectId = requireString(args, "projectId");
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.VIEW_PROJECT, [
    "workflows:read",
  ]);
  const project = await loadProject(runtime, auth, projectId);
  const workflowId = String(project.workflowId ?? "");
  if (!workflowId) {
    return toolResult({ workflow: null, statuses: [], transitions: [] });
  }
  const workflow = await runtime.store.get<Record<string, unknown>>(
    runtime.collections.workflows,
    workflowId
  );
  const statuses = await runtime.store.list<Record<string, unknown>>(
    runtime.collections.workflowStatuses,
    [
      { type: "equal", field: "workflowId", value: workflowId },
      { type: "limit", value: 100 },
    ]
  );
  const transitions = await runtime.store.list<Record<string, unknown>>(
    runtime.collections.workflowTransitions,
    [
      { type: "equal", field: "workflowId", value: workflowId },
      { type: "limit", value: 100 },
    ]
  );
  return toolResult({
    workflow: withId(workflow),
    statuses: statuses.documents.map((d) => withId(d)),
    transitions: transitions.documents.map((d) => withId(d)),
  });
}

async function agentContextGet(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const workItemId = requireString(args, "workItemId");
  const item = await loadWorkItem(runtime, auth, workItemId);
  const projectId = String(item.projectId);
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.VIEW_TASKS, ["tasks:read"]);
  const project = await loadProject(runtime, auth, projectId);
  const comments = await runtime.store.list<Record<string, unknown>>(runtime.collections.comments, [
    { type: "equal", field: "taskId", value: workItemId },
    { type: "limit", value: 50 },
    { type: "orderDesc", field: "$createdAt" },
  ]);
  const links = await runtime.store.list<Record<string, unknown>>(
    runtime.collections.workItemLinks,
    [
      { type: "equal", field: "projectId", value: projectId },
      { type: "limit", value: 50 },
    ]
  );
  let sprint = null;
  if (item.sprintId) {
    try {
      sprint = await runtime.store.get(runtime.collections.sprints, String(item.sprintId));
    } catch {
      sprint = null;
    }
  }
  return toolResult({
    workItem: withId(item),
    project: withId(project),
    sprint,
    comments: comments.documents.map((d) => withId(d)),
    links: links.documents.filter(
      (d) => d.sourceItemId === workItemId || d.targetItemId === workItemId
    ),
    untrusted: wrapUntrusted("agent_context", {
      title: item.title,
      description: item.description,
      comments: comments.documents.map((d) => d.content),
    }),
  });
}
