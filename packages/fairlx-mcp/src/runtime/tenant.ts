import { invalidParams, notFoundError } from "../protocol/errors";
import type { AuthContext } from "../auth/context";
import type { McpRuntime } from "./types";
import { isWorkItemKeyCursor } from "./output";

async function tryGet(
  runtime: McpRuntime,
  collection: string | undefined,
  id: string
): Promise<Record<string, unknown> | null> {
  if (!collection) return null;
  try {
    return await runtime.store.get<Record<string, unknown>>(collection, id);
  } catch {
    return null;
  }
}

function assertWorkItemTenant(auth: AuthContext, item: Record<string, unknown>): Record<string, unknown> {
  const projectId = String(item.projectId ?? "");
  const workspaceId = String(item.workspaceId ?? "");
  if (auth.projectId && projectId && auth.projectId !== projectId) {
    throw notFoundError("Not found");
  }
  if (auth.workspaceId && workspaceId && auth.workspaceId !== workspaceId) {
    throw notFoundError("Not found");
  }
  return item;
}

export function workItemDocumentId(item: Record<string, unknown>): string {
  return String(item.$id ?? item.id ?? "");
}

export async function loadProject(
  runtime: McpRuntime,
  auth: AuthContext,
  projectId: string
): Promise<Record<string, unknown>> {
  if (auth.projectId && auth.projectId !== projectId) {
    throw notFoundError("Not found");
  }
  try {
    const project = await runtime.store.get<Record<string, unknown>>(
      runtime.collections.projects,
      projectId
    );
    const workspaceId = String(project.workspaceId ?? "");
    if (auth.workspaceId && workspaceId && auth.workspaceId !== workspaceId) {
      throw notFoundError("Not found");
    }
    return project;
  } catch (error) {
    if ((error as { httpStatus?: number }).httpStatus === 404) throw error;
    throw notFoundError("Not found");
  }
}

export async function loadWorkItem(
  runtime: McpRuntime,
  auth: AuthContext,
  workItemId: string
): Promise<Record<string, unknown>> {
  const ref = workItemId.trim();
  if (!ref) throw invalidParams("workItemId is required");

  if (auth.projectId && ref === auth.projectId) {
    throw invalidParams(
      "workItemId is this project's id. Pass the work item key (e.g. SCHO-1) or the work item document id from fairlx_work_item_list.",
    );
  }
  if (auth.workspaceId && ref === auth.workspaceId) {
    throw invalidParams(
      "workItemId is this workspace's id. Pass the work item key (e.g. SCHO-1) or the work item document id.",
    );
  }

  if (isWorkItemKeyCursor(ref)) {
    const queries = [
      ...(auth.workspaceId
        ? [{ type: "equal" as const, field: "workspaceId", value: auth.workspaceId }]
        : []),
      ...(auth.projectId ? [{ type: "equal" as const, field: "projectId", value: auth.projectId }] : []),
      { type: "equal" as const, field: "key", value: ref.toUpperCase() },
      { type: "limit" as const, value: 5 },
    ];
    const listed = await runtime.store.list<Record<string, unknown>>(
      runtime.collections.workItems,
      queries,
    );
    const match =
      listed.documents.find((doc) => String(doc.key ?? "").toUpperCase() === ref.toUpperCase()) ??
      listed.documents[0];
    if (!match) {
      throw invalidParams(
        `No work item with key ${ref.toUpperCase()}. Call fairlx_work_item_list and use that key. Do not pass a project or workspace id.`,
      );
    }
    return assertWorkItemTenant(auth, match);
  }

  try {
    const item = await runtime.store.get<Record<string, unknown>>(
      runtime.collections.workItems,
      ref,
    );
    return assertWorkItemTenant(auth, item);
  } catch (error) {
    if ((error as { httpStatus?: number }).httpStatus === 404) throw error;
    const project = await tryGet(runtime, runtime.collections.projects, ref);
    if (project) {
      throw invalidParams(
        "workItemId is a project id. Pass the work item key (e.g. SCHO-1) or the work item document id from fairlx_work_item_list.",
      );
    }
    throw notFoundError(
      "No work item with that id. Pass the work item key (e.g. SCHO-1) from fairlx_work_item_list, not a project or workspace id.",
    );
  }
}

export function paginationQueries(args: Record<string, unknown>) {
  const rawLimit = typeof args.limit === "number" ? args.limit : 50;
  const limit = Math.min(Math.max(1, rawLimit), 100);
  const cursorAfter = typeof args.cursorAfter === "string" ? args.cursorAfter : undefined;
  return { limit, cursorAfter };
}
