import { invalidParams, notFoundError } from "../protocol/errors";
import type { McpToolResult } from "../protocol/types";
import type { AuthContext } from "../auth/context";
import { PERMISSIONS, type McpRuntime } from "../runtime/types";
import { toolResult } from "../runtime/output";
import { requireProjectAccess } from "../runtime/rbac";
import { loadWorkItem } from "../runtime/tenant";
import { audit, requireString } from "./helpers";

export async function handleDestructiveTool(
  name: string,
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  switch (name) {
    case "fairlx_project_delete":
      return projectDelete(args, runtime, auth);
    case "fairlx_work_item_delete":
      return workItemDelete(args, runtime, auth);
    case "fairlx_sprint_delete":
      return sprintDelete(args, runtime, auth);
    case "fairlx_link_delete":
      return linkDelete(args, runtime, auth);
    case "fairlx_comment_delete":
      return commentDelete(args, runtime, auth);
    case "fairlx_time_log_delete":
      return timeLogDelete(args, runtime, auth);
    case "fairlx_doc_delete":
      return docDelete(args, runtime, auth);
    // ── New destructive tools ──
    case "fairlx_subtask_delete":
      return subtaskDelete(args, runtime, auth);
    case "fairlx_saved_view_delete":
      return savedViewDelete(args, runtime, auth);
    case "fairlx_webhook_delete":
      return webhookDelete(args, runtime, auth);
    default:
      throw invalidParams(`Unknown destructive tool: ${name}`);
  }
}

async function projectDelete(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const projectId = requireString(args, "projectId");
  await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.DELETE_PROJECT, [
    "admin:manage",
  ]);
  await runtime.store.delete(runtime.collections.projects, projectId);
  await audit(runtime, {
    projectId,
    userId: auth.actorUserId,
    action: "mcp.project.delete",
    resourceType: "project",
    resourceId: projectId,
  });
  return toolResult({ deleted: true, projectId });
}

async function workItemDelete(
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
    PERMISSIONS.DELETE_TASKS,
    ["tasks:delete"]
  );
  await runtime.store.delete(runtime.collections.workItems, workItemId);
  await audit(runtime, {
    projectId: item.projectId,
    userId: auth.actorUserId,
    action: "mcp.work_item.delete",
    resourceType: "work_item",
    resourceId: workItemId,
  });
  return toolResult({ deleted: true, workItemId });
}

async function sprintDelete(
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
    PERMISSIONS.DELETE_SPRINTS,
    ["sprints:manage"]
  );
  await runtime.store.delete(runtime.collections.sprints, sprintId);
  return toolResult({ deleted: true, sprintId });
}

async function linkDelete(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const linkId = requireString(args, "linkId");
  let link: Record<string, unknown>;
  try {
    link = await runtime.store.get<Record<string, unknown>>(
      runtime.collections.workItemLinks,
      linkId
    );
  } catch {
    throw notFoundError("Not found");
  }
  await requireProjectAccess(runtime, auth, String(link.projectId), PERMISSIONS.EDIT_TASKS, [
    "tasks:write",
  ]);
  await runtime.store.delete(runtime.collections.workItemLinks, linkId);
  return toolResult({ deleted: true, linkId });
}

async function commentDelete(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const commentId = requireString(args, "commentId");
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
    PERMISSIONS.DELETE_COMMENTS,
    ["comments:write"]
  );
  await runtime.store.delete(runtime.collections.comments, commentId);
  return toolResult({ deleted: true, commentId });
}

async function timeLogDelete(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const timeLogId = requireString(args, "timeLogId");
  let log: Record<string, unknown>;
  try {
    log = await runtime.store.get<Record<string, unknown>>(runtime.collections.timeLogs, timeLogId);
  } catch {
    throw notFoundError("Not found");
  }
  await requireProjectAccess(runtime, auth, String(log.projectId), PERMISSIONS.EDIT_TASKS, [
    "time:write",
  ]);
  await runtime.store.delete(runtime.collections.timeLogs, timeLogId);
  return toolResult({ deleted: true, timeLogId });
}

async function docDelete(
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
  await requireProjectAccess(runtime, auth, String(doc.projectId), PERMISSIONS.DELETE_DOCS, [
    "docs:write",
  ]);
  await runtime.store.delete(runtime.collections.projectDocs, docId);
  return toolResult({ deleted: true, docId });
}

// ═══════════════════════════════════════════════════════════════════
// NEW destructive tools
// ═══════════════════════════════════════════════════════════════════

async function subtaskDelete(
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
  await requireProjectAccess(
    runtime,
    auth,
    String(subtask.projectId),
    PERMISSIONS.EDIT_TASKS,
    ["tasks:write"]
  );
  await runtime.store.delete(runtime.collections.subtasks, subtaskId);
  return toolResult({ deleted: true, subtaskId });
}

async function savedViewDelete(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const viewId = requireString(args, "viewId");
  let view: Record<string, unknown>;
  try {
    view = await runtime.store.get<Record<string, unknown>>(runtime.collections.savedViews, viewId);
  } catch {
    throw notFoundError("Not found");
  }
  await requireProjectAccess(
    runtime,
    auth,
    String(view.projectId),
    PERMISSIONS.DELETE_VIEWS,
    ["views:write"]
  );
  await runtime.store.delete(runtime.collections.savedViews, viewId);
  return toolResult({ deleted: true, viewId });
}

async function webhookDelete(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const webhookId = requireString(args, "webhookId");
  let webhook: Record<string, unknown>;
  try {
    webhook = await runtime.store.get<Record<string, unknown>>(
      runtime.collections.projectWebhooks,
      webhookId
    );
  } catch {
    throw notFoundError("Not found");
  }
  await requireProjectAccess(
    runtime,
    auth,
    String(webhook.projectId),
    PERMISSIONS.EDIT_SETTINGS,
    ["admin:manage"]
  );
  await runtime.store.delete(runtime.collections.projectWebhooks, webhookId);
  await audit(runtime, {
    projectId: webhook.projectId,
    userId: auth.actorUserId,
    action: "mcp.webhook.delete",
    resourceType: "webhook",
    resourceId: webhookId,
  });
  return toolResult({ deleted: true, webhookId });
}

