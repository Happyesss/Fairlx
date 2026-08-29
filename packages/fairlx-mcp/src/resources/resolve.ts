import type { AuthContext } from "../auth/context";
import { notFoundError } from "../protocol/errors";
import { compactWorkItem, withId, wrapUntrusted } from "../runtime/output";
import { assertWorkspaceBound, requireProjectAccess } from "../runtime/rbac";
import { PERMISSIONS, type McpRuntime } from "../runtime/types";
import { getSkill } from "../skills/load";
import { handleReadTool } from "../tools/read";

type ResourceContents = {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
};

function jsonContents(uri: string, payload: unknown): ResourceContents {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function markdownContents(uri: string, text: string): ResourceContents {
  return {
    contents: [{ uri, mimeType: "text/markdown", text }],
  };
}

async function fromReadTool(
  uri: string,
  name: string,
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<ResourceContents> {
  const result = await handleReadTool(name, args, runtime, auth);
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: result.content[0]?.text ?? "{}",
      },
    ],
  };
}

export async function readResource(
  runtime: McpRuntime,
  auth: AuthContext,
  uri: string
): Promise<ResourceContents> {
  const skill = /^fairlx:\/\/skills\/([^/]+)$/.exec(uri);
  if (skill) {
    const record = getSkill(skill[1]);
    if (!record) throw notFoundError("Not found");
    return markdownContents(uri, record.content);
  }

  const workspace = /^fairlx:\/\/workspaces\/([^/]+)$/.exec(uri);
  if (workspace) {
    const workspaceId = workspace[1];
    assertWorkspaceBound(auth, workspaceId);
    const members = await runtime.store.list(runtime.collections.members, [
      { type: "equal", field: "userId", value: auth.actorUserId },
      { type: "equal", field: "workspaceId", value: workspaceId },
      { type: "limit", value: 1 },
    ]);
    if (members.documents.length === 0) throw notFoundError("Not found");
    const doc = await runtime.store.get<Record<string, unknown>>(
      runtime.collections.workspaces,
      workspaceId
    );
    return jsonContents(uri, { workspace: withId(doc) });
  }

  const backlog = /^fairlx:\/\/projects\/([^/]+)\/backlog$/.exec(uri);
  if (backlog) {
    const projectId = backlog[1];
    await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.VIEW_TASKS, ["tasks:read"]);
    const result = await runtime.store.list<Record<string, unknown>>(
      runtime.collections.workItems,
      [
        { type: "equal", field: "projectId", value: projectId },
        { type: "isNull", field: "sprintId" },
        { type: "limit", value: 50 },
        { type: "orderDesc", field: "$createdAt" },
      ]
    );
    return jsonContents(uri, {
      projectId,
      workItems: result.documents.map((d) => compactWorkItem(d)),
      total: result.total,
    });
  }

  const activeSprints = /^fairlx:\/\/projects\/([^/]+)\/sprints\/active$/.exec(uri);
  if (activeSprints) {
    return fromReadTool(
      uri,
      "fairlx_sprint_list",
      { projectId: activeSprints[1], status: "ACTIVE" },
      runtime,
      auth
    );
  }

  const workflow = /^fairlx:\/\/projects\/([^/]+)\/workflow$/.exec(uri);
  if (workflow) {
    return fromReadTool(uri, "fairlx_workflow_get", { projectId: workflow[1] }, runtime, auth);
  }

  const activity = /^fairlx:\/\/projects\/([^/]+)\/activity$/.exec(uri);
  if (activity) {
    const projectId = activity[1];
    await requireProjectAccess(runtime, auth, projectId, PERMISSIONS.VIEW_PROJECT, [
      "project:read",
    ]);
    const logs = await runtime.store.list<Record<string, unknown>>(
      runtime.collections.organizationAuditLogs,
      [
        { type: "equal", field: "projectId", value: projectId },
        { type: "limit", value: 50 },
        { type: "orderDesc", field: "$createdAt" },
      ]
    );
    return jsonContents(uri, {
      projectId,
      activity: logs.documents.map((d) => ({
        ...withId(d),
        untrusted: wrapUntrusted("activity", d.metadata ?? d.resourceName ?? d.action),
      })),
      total: logs.total,
    });
  }

  const doc = /^fairlx:\/\/projects\/([^/]+)\/docs\/([^/]+)$/.exec(uri);
  if (doc) {
    return fromReadTool(uri, "fairlx_doc_get", { projectId: doc[1], docId: doc[2] }, runtime, auth);
  }

  const project = /^fairlx:\/\/projects\/([^/]+)$/.exec(uri);
  if (project) {
    return fromReadTool(uri, "fairlx_project_get", { projectId: project[1] }, runtime, auth);
  }

  const context = /^fairlx:\/\/work-items\/([^/]+)\/context$/.exec(uri);
  if (context) {
    return fromReadTool(
      uri,
      "fairlx_agent_context_get",
      { workItemId: context[1] },
      runtime,
      auth
    );
  }

  const workItem = /^fairlx:\/\/work-items\/([^/]+)$/.exec(uri);
  if (workItem) {
    return fromReadTool(uri, "fairlx_work_item_get", { workItemId: workItem[1] }, runtime, auth);
  }

  throw notFoundError("Not found");
}
