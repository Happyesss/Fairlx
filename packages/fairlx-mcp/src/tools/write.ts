import { forbiddenError, invalidParams, notFoundError } from "../protocol/errors";
import type { McpToolResult } from "../protocol/types";
import type { AuthContext } from "../auth/context";
import { hasScope } from "../auth/scopes";
import { PERMISSIONS, type McpRuntime } from "../runtime/types";
import { hydrateMembers, toolResult, withId } from "../runtime/output";
import { requireProjectAccess, assertWorkspaceBound } from "../runtime/rbac";
import { loadProject, loadWorkItem } from "../runtime/tenant";
import { withIdempotency } from "../runtime/idempotency";
import {
  audit,
  LINK_INVERSE,
  loadBlocksLinks,
  optionalString,
  parseCustomFields,
  redactGithubRepo,
  requireString,
  wouldCreateCycle,
} from "./helpers";
import {
  isWorkspaceAdminRole,
  matchWorkspaceMember,
  normalizeMemberRole,
  type NamedMember,
} from "./member-match";

export async function handleWriteTool(
  name: string,
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  switch (name) {
    case "fairlx_project_create":
      return projectCreate(args, runtime, auth);
    case "fairlx_project_update":
      return projectUpdate(args, runtime, auth);
    case "fairlx_work_item_create":
      return workItemCreate(args, runtime, auth);
    case "fairlx_work_item_update":
      return workItemUpdate(args, runtime, auth);
    case "fairlx_work_item_bulk_update":
      return workItemBulkUpdate(args, runtime, auth);
    case "fairlx_work_item_split":
      return workItemSplit(args, runtime, auth);
    case "fairlx_sprint_create":
      return sprintCreate(args, runtime, auth);
    case "fairlx_sprint_start":
      return sprintStart(args, runtime, auth);
    case "fairlx_sprint_complete":
      return sprintComplete(args, runtime, auth);
    case "fairlx_link_create":
      return linkCreate(args, runtime, auth);
    case "fairlx_comment_add":
      return commentAdd(args, runtime, auth);
    case "fairlx_comment_update":
      return commentUpdate(args, runtime, auth);
    case "fairlx_time_log_add":
      return timeLogAdd(args, runtime, auth);
    case "fairlx_doc_create":
      return docCreate(args, runtime, auth);
    case "fairlx_doc_update":
      return docUpdate(args, runtime, auth);
    case "fairlx_custom_field_set":
      return customFieldSet(args, runtime, auth);
    case "fairlx_webhook_create":
      return webhookCreate(args, runtime, auth);
    case "fairlx_github_sync":
      return githubSync(args, runtime, auth);
    // ── New write tools ──
    case "fairlx_subtask_create":
      return subtaskCreate(args, runtime, auth);
    case "fairlx_subtask_update":
      return subtaskUpdate(args, runtime, auth);
    case "fairlx_notification_mark_read":
      return notificationMarkRead(args, runtime, auth);
    case "fairlx_saved_view_create":
      return savedViewCreate(args, runtime, auth);
    case "fairlx_sprint_update":
      return sprintUpdate(args, runtime, auth);
    case "fairlx_workspace_member_update":
      return workspaceMemberUpdate(args, runtime, auth);
    default:
      throw invalidParams(`Unknown write tool: ${name}`);
  }
}

async function projectCreate(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const workspaceId = requireString(args, "workspaceId");
  const name = requireString(args, "name");
  assertWorkspaceBound(auth, workspaceId);
  const members = await runtime.store.list<Record<string, unknown>>(runtime.collections.members, [
    { type: "equal", field: "userId", value: auth.actorUserId },
    { type: "equal", field: "workspaceId", value: workspaceId },
    { type: "limit", value: 1 },
  ]);
  if (members.documents.length === 0) throw notFoundError("Not found");

  const run = async () => {
    const project = await runtime.store.create<Record<string, unknown>>(runtime.collections.projects, {
      name,
      workspaceId,
      description: optionalString(args, "description") ?? "",
      boardType: optionalString(args, "boardType") ?? "SCRUM",
      status: "ACTIVE",
    });
    await audit(runtime, {
      workspaceId,
      projectId: project.$id,
      userId: auth.actorUserId,
      action: "mcp.project.create",
      resourceType: "project",
      resourceId: project.$id,
      resourceName: name,
    });
    return toolResult({ project: withId(project) });
  };
  const key = optionalString(args, "idempotencyKey");
  if (key) return withIdempotency(runtime, key, "fairlx_project_create", run);
  return run();
}

async function projectUpdate(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const projectId = requireString(args, "projectId");
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.EDIT_SETTINGS, [
    "admin:manage",
  ]);
  const patch: Record<string, unknown> = {};
  if (args.name !== undefined) patch.name = requireString(args, "name");
  if (args.description !== undefined) patch.description = String(args.description);
  if (args.status !== undefined) patch.status = requireString(args, "status");
  const project = await runtime.store.update<Record<string, unknown>>(
    runtime.collections.projects,
    projectId,
    patch
  );
  await audit(runtime, {
    projectId,
    userId: auth.actorUserId,
    action: "mcp.project.update",
    resourceType: "project",
    resourceId: projectId,
  });
  return toolResult({ project: withId(project) });
}

async function workItemCreate(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const projectId = requireString(args, "projectId");
  const title = requireString(args, "title");
  const access = await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.CREATE_TASKS, [
    "tasks:write",
  ]);
  const project = await loadProject(runtime, auth, projectId);
  const run = async () => {
    const key = await runtime.generateWorkItemKey(projectId);
    const item = await runtime.store.create<Record<string, unknown>>(runtime.collections.workItems, {
      title,
      name: title,
      key,
      workspaceId: String(project.workspaceId),
      projectId,
      type: optionalString(args, "type") ?? "TASK",
      status: "TODO",
      priority: optionalString(args, "priority") ?? "MEDIUM",
      description: optionalString(args, "description") ?? "",
      sprintId: optionalString(args, "sprintId") ?? null,
      assigneeIds: Array.isArray(args.assigneeIds) ? args.assigneeIds : [],
      storyPoints: typeof args.storyPoints === "number" ? args.storyPoints : undefined,
      reporterId: auth.actorUserId,
      flagged: false,
    });
    await audit(runtime, {
      workspaceId: project.workspaceId,
      projectId,
      userId: auth.actorUserId,
      action: "mcp.work_item.create",
      resourceType: "work_item",
      resourceId: item.$id,
      resourceName: title,
    });
    void access;
    return toolResult({ workItem: withId(item) });
  };
  const idem = optionalString(args, "idempotencyKey");
  if (idem) return withIdempotency(runtime, idem, "fairlx_work_item_create", run);
  return run();
}

async function workItemUpdate(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const workItemId = requireString(args, "workItemId");
  const item = await loadWorkItem(runtime, auth, workItemId);
  const projectId = String(item.projectId);
  const access = await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.EDIT_TASKS, [
    "tasks:write",
  ]);
  const patch: Record<string, unknown> = {};
  if (args.title !== undefined) {
    patch.title = requireString(args, "title");
    patch.name = patch.title;
  }
  if (args.priority !== undefined) patch.priority = requireString(args, "priority");
  if (args.description !== undefined) patch.description = String(args.description);
  if (args.sprintId !== undefined) patch.sprintId = args.sprintId;
  if (args.assigneeIds !== undefined) patch.assigneeIds = args.assigneeIds;
  if (args.storyPoints !== undefined) patch.storyPoints = args.storyPoints;
  if (args.status !== undefined) {
    const toStatus = requireString(args, "status");
    const fromStatus = String(item.status ?? "TODO");
    const project = await loadProject(runtime, auth, projectId);
    const check = await runtime.validateStatusTransition({
      workflowId: String(project.workflowId ?? ""),
      fromStatus,
      toStatus,
      userId: auth.actorUserId,
      projectId,
      memberRole: access.role,
    });
    if (!check.allowed) {
      throw invalidParams(check.reason ?? "Status transition not allowed");
    }
    patch.status = toStatus;
  }
  const updated = await runtime.store.update<Record<string, unknown>>(
    runtime.collections.workItems,
    workItemId,
    patch
  );
  return toolResult({ workItem: withId(updated) });
}

async function workItemBulkUpdate(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  if (!Array.isArray(args.workItemIds) || args.workItemIds.length === 0) {
    throw invalidParams("workItemIds is required");
  }
  const updated: unknown[] = [];
  for (const id of args.workItemIds) {
    if (typeof id !== "string") continue;
    const item = await loadWorkItem(runtime, auth, id);
    await requireProjectAccess(runtime, auth, String(item.projectId), PERMISSIONS.EDIT_TASKS, [
      "tasks:write",
    ]);
    const patch: Record<string, unknown> = {};
    if (args.status !== undefined) patch.status = args.status;
    if (args.sprintId !== undefined) patch.sprintId = args.sprintId;
    if (args.assigneeIds !== undefined) patch.assigneeIds = args.assigneeIds;
    if (args.priority !== undefined) patch.priority = args.priority;
    const doc = await runtime.store.update(runtime.collections.workItems, id, patch);
    updated.push(withId(doc as Record<string, unknown>));
  }
  return toolResult({ updated, count: updated.length });
}

async function workItemSplit(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const workItemId = requireString(args, "workItemId");
  if (!Array.isArray(args.titles) || args.titles.length === 0) {
    throw invalidParams("titles is required");
  }
  const source = await loadWorkItem(runtime, auth, workItemId);
  const projectId = String(source.projectId);
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.CREATE_TASKS, ["tasks:write"]);
  const run = async () => {
    const created = [];
    for (const title of args.titles as unknown[]) {
      if (typeof title !== "string" || !title) continue;
      const key = await runtime.generateWorkItemKey(projectId);
      const child = await runtime.store.create<Record<string, unknown>>(
        runtime.collections.workItems,
        {
          title,
          name: title,
          key,
          workspaceId: String(source.workspaceId),
          projectId,
          type: source.type ?? "TASK",
          status: source.status ?? "TODO",
          priority: source.priority ?? "MEDIUM",
          sprintId: source.sprintId ?? null,
          epicId: source.epicId ?? null,
          assigneeIds: source.assigneeIds ?? [],
          reporterId: auth.actorUserId,
          flagged: false,
        }
      );
      await runtime.store.create(runtime.collections.workItemLinks, {
        workspaceId: source.workspaceId,
        projectId,
        sourceItemId: child.$id,
        targetItemId: workItemId,
        linkType: "SPLIT_FROM",
        createdBy: auth.actorUserId,
      });
      await runtime.store.create(runtime.collections.workItemLinks, {
        workspaceId: source.workspaceId,
        projectId,
        sourceItemId: workItemId,
        targetItemId: child.$id,
        linkType: "SPLIT_TO",
        createdBy: auth.actorUserId,
      });
      created.push(withId(child));
    }
    return toolResult({ sourceId: workItemId, created });
  };
  const idem = optionalString(args, "idempotencyKey");
  if (idem) return withIdempotency(runtime, idem, "fairlx_work_item_split", run);
  return run();
}

async function sprintCreate(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const projectId = requireString(args, "projectId");
  const name = requireString(args, "name");
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.CREATE_SPRINTS, [
    "sprints:manage",
  ]);
  const project = await loadProject(runtime, auth, projectId);
  const run = async () => {
    const sprint = await runtime.store.create<Record<string, unknown>>(runtime.collections.sprints, {
      name,
      workspaceId: String(project.workspaceId),
      projectId,
      goal: optionalString(args, "goal") ?? "",
      startDate: optionalString(args, "startDate"),
      endDate: optionalString(args, "endDate"),
      status: "PLANNED",
      position: 0,
    });
    return toolResult({ sprint: withId(sprint) });
  };
  const idem = optionalString(args, "idempotencyKey");
  if (idem) return withIdempotency(runtime, idem, "fairlx_sprint_create", run);
  return run();
}

async function sprintStart(
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
    PERMISSIONS.START_SPRINT,
    ["sprints:manage"]
  );
  const updated = await runtime.store.update<Record<string, unknown>>(
    runtime.collections.sprints,
    sprintId,
    { status: "ACTIVE" }
  );
  await audit(runtime, {
    projectId: sprint.projectId,
    userId: auth.actorUserId,
    action: "mcp.sprint.start",
    resourceType: "sprint",
    resourceId: sprintId,
  });
  return toolResult({ sprint: withId(updated) });
}

async function sprintComplete(
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
    PERMISSIONS.COMPLETE_SPRINT,
    ["sprints:manage"]
  );
  const updated = await runtime.store.update<Record<string, unknown>>(
    runtime.collections.sprints,
    sprintId,
    { status: "COMPLETED" }
  );
  await audit(runtime, {
    projectId: sprint.projectId,
    userId: auth.actorUserId,
    action: "mcp.sprint.complete",
    resourceType: "sprint",
    resourceId: sprintId,
  });
  return toolResult({ sprint: withId(updated) });
}

async function linkCreate(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const sourceItemId = requireString(args, "sourceItemId");
  const targetItemId = requireString(args, "targetItemId");
  const linkType = requireString(args, "linkType");
  const source = await loadWorkItem(runtime, auth, sourceItemId);
  const target = await loadWorkItem(runtime, auth, targetItemId);
  if (String(source.projectId) !== String(target.projectId)) {
    throw invalidParams("Links must be within the same project");
  }
  const projectId = String(source.projectId);
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.EDIT_TASKS, ["tasks:write"]);
  if (linkType === "BLOCKS") {
    const existing = await loadBlocksLinks(runtime, projectId);
    if (wouldCreateCycle(existing, sourceItemId, targetItemId)) {
      throw invalidParams("Link would create a cycle");
    }
  }
  const run = async () => {
    const link = await runtime.store.create<Record<string, unknown>>(
      runtime.collections.workItemLinks,
      {
        workspaceId: source.workspaceId,
        projectId,
        sourceItemId,
        targetItemId,
        linkType,
        description: optionalString(args, "description"),
        createdBy: auth.actorUserId,
      }
    );
    let inverse = null;
    if (args.createInverse && LINK_INVERSE[linkType]) {
      inverse = await runtime.store.create(runtime.collections.workItemLinks, {
        workspaceId: source.workspaceId,
        projectId,
        sourceItemId: targetItemId,
        targetItemId: sourceItemId,
        linkType: LINK_INVERSE[linkType],
        createdBy: auth.actorUserId,
      });
    }
    return toolResult({ link: withId(link), inverse });
  };
  const idem = optionalString(args, "idempotencyKey");
  if (idem) return withIdempotency(runtime, idem, "fairlx_link_create", run);
  return run();
}

async function commentAdd(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const workItemId = requireString(args, "workItemId");
  const content = requireString(args, "content");
  const item = await loadWorkItem(runtime, auth, workItemId);
  await requireProjectAccess(
    runtime,
    auth,
    String(item.projectId),
    PERMISSIONS.CREATE_COMMENTS,
    ["comments:write"]
  );
  const run = async () => {
    const comment = await runtime.store.create<Record<string, unknown>>(runtime.collections.comments, {
      taskId: workItemId,
      projectId: item.projectId,
      workspaceId: item.workspaceId,
      authorId: auth.actorUserId,
      content,
      isEdited: false,
      parentId: optionalString(args, "parentId") ?? null,
    });
    return toolResult({ comment: withId(comment) });
  };
  const idem = optionalString(args, "idempotencyKey");
  if (idem) return withIdempotency(runtime, idem, "fairlx_comment_add", run);
  return run();
}

async function commentUpdate(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const commentId = requireString(args, "commentId");
  const content = requireString(args, "content");
  let comment: Record<string, unknown>;
  try {
    comment = await runtime.store.get<Record<string, unknown>>(
      runtime.collections.comments,
      commentId
    );
  } catch {
    throw notFoundError("Not found");
  }
  await requireProjectAccess(
    runtime,
    auth,
    String(comment.projectId),
    PERMISSIONS.CREATE_COMMENTS,
    ["comments:write"]
  );
  const updated = await runtime.store.update<Record<string, unknown>>(
    runtime.collections.comments,
    commentId,
    { content, isEdited: true }
  );
  return toolResult({ comment: withId(updated) });
}

async function timeLogAdd(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const workItemId = requireString(args, "workItemId");
  if (typeof args.loggedHours !== "number") throw invalidParams("loggedHours is required");
  const item = await loadWorkItem(runtime, auth, workItemId);
  await requireProjectAccess(runtime, auth, String(item.projectId), PERMISSIONS.EDIT_TASKS, [
    "time:write",
  ]);
  const run = async () => {
    const log = await runtime.store.create<Record<string, unknown>>(runtime.collections.timeLogs, {
      taskId: workItemId,
      projectId: item.projectId,
      workspaceId: item.workspaceId,
      userId: auth.actorUserId,
      loggedHours: args.loggedHours,
      logDate: optionalString(args, "logDate") ?? new Date().toISOString(),
      description: optionalString(args, "description") ?? "",
      isBillable: args.isBillable === true,
      createdBy: auth.actorUserId,
    });
    return toolResult({ timeLog: withId(log) });
  };
  const idem = optionalString(args, "idempotencyKey");
  if (idem) return withIdempotency(runtime, idem, "fairlx_time_log_add", run);
  return run();
}

async function docCreate(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const projectId = requireString(args, "projectId");
  const title = requireString(args, "title");
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.CREATE_DOCS, ["docs:write"]);
  const project = await loadProject(runtime, auth, projectId);
  const content = optionalString(args, "content") ?? "";
  const run = async () => {
    const doc = await runtime.store.create<Record<string, unknown>>(
      runtime.collections.projectDocs,
      {
        title,
        name: title,
        description: content,
        projectId,
        workspaceId: String(project.workspaceId),
        category: optionalString(args, "category") ?? "other",
        size: content.length,
        mimeType: "text/markdown",
        fileId: "mcp-inline",
        uploadedBy: auth.actorUserId,
        tags: Array.isArray(args.tags) ? args.tags : [],
        version: "1.0",
        isArchived: false,
      }
    );
    return toolResult({ doc: withId(doc) });
  };
  const idem = optionalString(args, "idempotencyKey");
  if (idem) return withIdempotency(runtime, idem, "fairlx_doc_create", run);
  return run();
}

async function docUpdate(
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
  await requireProjectAccess(runtime, auth, String(doc.projectId), PERMISSIONS.EDIT_DOCS, [
    "docs:write",
  ]);
  const patch: Record<string, unknown> = {};
  if (args.title !== undefined) {
    patch.title = requireString(args, "title");
    patch.name = patch.title;
  }
  if (args.content !== undefined) {
    patch.description = String(args.content);
    patch.size = String(args.content).length;
  }
  if (args.category !== undefined) patch.category = args.category;
  if (args.tags !== undefined) patch.tags = args.tags;
  if (args.isArchived !== undefined) patch.isArchived = args.isArchived;
  const updated = await runtime.store.update<Record<string, unknown>>(
    runtime.collections.projectDocs,
    docId,
    patch
  );
  return toolResult({ doc: withId(updated) });
}

async function customFieldSet(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const workItemId = requireString(args, "workItemId");
  const fieldId = requireString(args, "fieldId");
  const item = await loadWorkItem(runtime, auth, workItemId);
  await requireProjectAccess(runtime, auth, String(item.projectId), PERMISSIONS.EDIT_TASKS, [
    "tasks:write",
  ]);
  const fields = parseCustomFields(item.customFields);
  const idx = fields.findIndex((f) => f.fieldId === fieldId);
  if (idx >= 0) fields[idx] = { fieldId, value: args.value };
  else fields.push({ fieldId, value: args.value });
  const updated = await runtime.store.update<Record<string, unknown>>(
    runtime.collections.workItems,
    workItemId,
    { customFields: JSON.stringify(fields) }
  );
  return toolResult({ workItem: withId(updated), customFields: fields });
}

async function webhookCreate(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const projectId = requireString(args, "projectId");
  const name = requireString(args, "name");
  const url = requireString(args, "url");
  if (!Array.isArray(args.events)) throw invalidParams("events is required");
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.EDIT_SETTINGS, [
    "admin:manage",
  ]);
  const project = await loadProject(runtime, auth, projectId);
  const run = async () => {
    const webhook = await runtime.store.create<Record<string, unknown>>(
      runtime.collections.projectWebhooks,
      {
        projectId,
        workspaceId: String(project.workspaceId),
        name,
        url,
        secret: optionalString(args, "secret") ?? "",
        events: JSON.stringify(args.events),
        enabled: true,
        createdByUserId: auth.actorUserId,
        failureCount: 0,
      }
    );
    return toolResult({ webhook: withId(webhook) });
  };
  const idem = optionalString(args, "idempotencyKey");
  if (idem) return withIdempotency(runtime, idem, "fairlx_webhook_create", run);
  return run();
}

async function githubSync(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const projectId = requireString(args, "projectId");
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.EDIT_SETTINGS, [
    "admin:manage",
  ]);
  const repos = await runtime.store.list<Record<string, unknown>>(runtime.collections.githubRepos, [
    { type: "equal", field: "projectId", value: projectId },
    { type: "limit", value: 50 },
  ]);
  const synced = [];
  const now = runtime.now();
  for (const repo of repos.documents) {
    const updated = await runtime.store.update<Record<string, unknown>>(
      runtime.collections.githubRepos,
      String(repo.$id),
      { status: "syncing", lastSyncedAt: now }
    );
    synced.push(redactGithubRepo(withId(updated)));
  }
  return toolResult({ repositories: synced, count: synced.length });
}

// ═══════════════════════════════════════════════════════════════════
// NEW write tools
// ═══════════════════════════════════════════════════════════════════

async function subtaskCreate(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const workItemId = requireString(args, "workItemId");
  const title = requireString(args, "title");
  const item = await loadWorkItem(runtime, auth, workItemId);
  await requireProjectAccess(
    runtime,
    auth,
    String(item.projectId),
    PERMISSIONS.EDIT_TASKS,
    ["tasks:write"]
  );
  const run = async () => {
    const subtask = await runtime.store.create<Record<string, unknown>>(runtime.collections.subtasks, {
      parentTaskId: workItemId,
      projectId: item.projectId,
      workspaceId: item.workspaceId,
      title,
      isCompleted: false,
      createdBy: auth.actorUserId,
    });
    return toolResult({ subtask: withId(subtask) });
  };
  const idem = optionalString(args, "idempotencyKey");
  if (idem) return withIdempotency(runtime, idem, "fairlx_subtask_create", run);
  return run();
}

async function subtaskUpdate(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const subtaskId = requireString(args, "subtaskId");
  let subtask: Record<string, unknown>;
  try {
    subtask = await runtime.store.get<Record<string, unknown>>(runtime.collections.subtasks, subtaskId);
  } catch {
    throw notFoundError("Not found");
  }
  const projectId = String(subtask.projectId);
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.EDIT_TASKS, ["tasks:write"]);
  const patch: Record<string, unknown> = {};
  if (args.title !== undefined) patch.title = requireString(args, "title");
  if (args.isCompleted !== undefined) patch.isCompleted = Boolean(args.isCompleted);
  const updated = await runtime.store.update<Record<string, unknown>>(
    runtime.collections.subtasks,
    subtaskId,
    patch
  );
  return toolResult({ subtask: withId(updated) });
}

async function notificationMarkRead(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const notificationId = optionalString(args, "notificationId");
  const markAll = args.markAll === true;
  if (!notificationId && !markAll) {
    throw invalidParams("notificationId or markAll is required");
  }
  if (notificationId) {
    let notification: Record<string, unknown>;
    try {
      notification = await runtime.store.get<Record<string, unknown>>(
        runtime.collections.notifications,
        notificationId
      );
    } catch {
      throw notFoundError("Not found");
    }
    // Only allow marking own notifications
    if (String(notification.userId) !== auth.actorUserId) {
      throw notFoundError("Not found");
    }
    const updated = await runtime.store.update<Record<string, unknown>>(
      runtime.collections.notifications,
      notificationId,
      { isRead: true }
    );
    return toolResult({ notification: withId(updated) });
  }
  // Mark all unread notifications as read
  const queries: import("../runtime/types").McpQuery[] = [
    { type: "equal", field: "userId", value: auth.actorUserId },
    { type: "equal", field: "isRead", value: false },
    { type: "limit", value: 100 },
  ];
  const workspaceId = optionalString(args, "workspaceId");
  if (workspaceId) {
    queries.push({ type: "equal", field: "workspaceId", value: workspaceId });
  }
  const unread = await runtime.store.list<Record<string, unknown>>(
    runtime.collections.notifications,
    queries
  );
  let count = 0;
  for (const n of unread.documents) {
    await runtime.store.update(runtime.collections.notifications, String(n.$id), { isRead: true });
    count++;
  }
  return toolResult({ markedRead: count });
}

async function savedViewCreate(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const projectId = requireString(args, "projectId");
  const name = requireString(args, "name");
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.CREATE_VIEWS, ["views:write"]);
  const project = await loadProject(runtime, auth, projectId);
  const run = async () => {
    const view = await runtime.store.create<Record<string, unknown>>(runtime.collections.savedViews, {
      projectId,
      workspaceId: String(project.workspaceId),
      name,
      filters: optionalString(args, "filters") ?? "{}",
      isShared: args.isShared === true,
      createdBy: auth.actorUserId,
    });
    return toolResult({ view: withId(view) });
  };
  const idem = optionalString(args, "idempotencyKey");
  if (idem) return withIdempotency(runtime, idem, "fairlx_saved_view_create", run);
  return run();
}

async function sprintUpdate(
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
    PERMISSIONS.EDIT_SPRINTS,
    ["sprints:manage"]
  );
  const patch: Record<string, unknown> = {};
  if (args.name !== undefined) patch.name = requireString(args, "name");
  if (args.goal !== undefined) patch.goal = String(args.goal);
  if (args.startDate !== undefined) patch.startDate = String(args.startDate);
  if (args.endDate !== undefined) patch.endDate = String(args.endDate);
  const updated = await runtime.store.update<Record<string, unknown>>(
    runtime.collections.sprints,
    sprintId,
    patch
  );
  await audit(runtime, {
    projectId: sprint.projectId,
    userId: auth.actorUserId,
    action: "mcp.sprint.update",
    resourceType: "sprint",
    resourceId: sprintId,
  });
  return toolResult({ sprint: withId(updated) });
}

async function listAllWorkspaceMembers(
  runtime: McpRuntime,
  workspaceId: string
): Promise<Record<string, unknown>[]> {
  const documents: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  for (;;) {
    const queries = [
      { type: "equal" as const, field: "workspaceId", value: workspaceId },
      { type: "limit" as const, value: 100 },
      { type: "orderDesc" as const, field: "$createdAt" },
      ...(cursor ? [{ type: "cursorAfter" as const, value: cursor }] : []),
    ];
    const page = await runtime.store.list<Record<string, unknown>>(
      runtime.collections.members,
      queries
    );
    documents.push(...page.documents);
    if (page.documents.length === 0 || documents.length >= page.total) break;
    const last = page.documents[page.documents.length - 1];
    cursor = String(last?.$id ?? last?.id ?? "");
    if (!cursor) break;
  }
  return documents;
}

async function requireWorkspaceAdmin(
  runtime: McpRuntime,
  auth: AuthContext,
  workspaceId: string
): Promise<{ role: string }> {
  assertWorkspaceBound(auth, workspaceId);
  if (!hasScope(auth.scopes, ["admin:manage"])) {
    throw forbiddenError("Insufficient MCP scope");
  }
  const membership = await runtime.store.list<Record<string, unknown>>(runtime.collections.members, [
    { type: "equal", field: "userId", value: auth.actorUserId },
    { type: "equal", field: "workspaceId", value: workspaceId },
    { type: "limit", value: 1 },
  ]);
  const actor = membership.documents[0];
  if (!actor) throw notFoundError("Not found");
  const role = String(actor.role ?? "");
  if (!isWorkspaceAdminRole(role)) {
    throw forbiddenError("Only workspace admins can change member roles");
  }
  return { role: role.toUpperCase() };
}

async function workspaceMemberUpdate(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const workspaceId = requireString(args, "workspaceId");
  const actor = await requireWorkspaceAdmin(runtime, auth, workspaceId);
  let role: "OWNER" | "ADMIN" | "MEMBER";
  try {
    role = normalizeMemberRole(requireString(args, "role"));
  } catch (error) {
    throw invalidParams(error instanceof Error ? error.message : "Invalid role");
  }
  if (role === "OWNER" && actor.role !== "OWNER") {
    throw forbiddenError("Only the workspace owner can grant owner");
  }

  const docs = await listAllWorkspaceMembers(runtime, workspaceId);
  const hydrated = await hydrateMembers(runtime, docs);
  const named: NamedMember[] = docs.map((doc, index) => ({
    id: String(doc.$id ?? doc.id ?? ""),
    name: hydrated[index]?.name ?? "",
    email: hydrated[index]?.email ?? "",
    role: hydrated[index]?.role ?? String(doc.role ?? "MEMBER"),
    status: hydrated[index]?.status ?? String(doc.status ?? "ACTIVE"),
  }));

  const query = optionalString(args, "email") || optionalString(args, "name") || "";
  if (!query) throw invalidParams("Provide the member's name or email");
  const matched = matchWorkspaceMember(query, named);
  if (matched.kind === "none") {
    return toolResult(
      {
        error: `No member matches "${query}".`,
        members: named.map(({ name, email, role: memberRole }) => ({
          name,
          email,
          role: memberRole,
        })),
      },
      true
    );
  }
  if (matched.kind === "many") {
    return toolResult(
      {
        error: "Several people match. Say which one.",
        matches: matched.members.map(({ name, email, role: memberRole }) => ({
          name,
          email,
          role: memberRole,
        })),
      },
      true
    );
  }

  const target = matched.member;
  const targetDoc = docs.find((doc) => String(doc.$id ?? doc.id ?? "") === target.id);
  if (!targetDoc) throw notFoundError("Not found");
  const currentRole = String(targetDoc.role ?? target.role);
  if (currentRole === "OWNER" && actor.role !== "OWNER") {
    throw forbiddenError("Only the workspace owner can change the owner's role");
  }
  if (docs.length === 1 && role !== "OWNER" && currentRole === "OWNER") {
    throw invalidParams("Cannot downgrade the only member");
  }
  if (currentRole === role) {
    return toolResult({
      member: { name: target.name, email: target.email, role, status: target.status },
      unchanged: true,
    });
  }

  await runtime.store.update(runtime.collections.members, target.id, { role });
  try {
    await runtime.onMembershipChanged?.({ userId: String(targetDoc.userId ?? ""), workspaceId });
  } catch {
    // Cache invalidation must never fail the role change.
  }
  await audit(runtime, {
    workspaceId,
    userId: auth.actorUserId,
    action: "mcp.workspace_member.update_role",
    resourceType: "member",
    resourceId: target.id,
    resourceName: target.name,
    metadata: { from: currentRole, to: role },
  });
  return toolResult({
    member: { name: target.name, email: target.email, role, status: target.status },
  });
}

