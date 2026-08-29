import { notFoundError } from "../protocol/errors";
import type { AuthContext } from "../auth/context";
import type { McpRuntime } from "./types";

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
  try {
    const item = await runtime.store.get<Record<string, unknown>>(
      runtime.collections.workItems,
      workItemId
    );
    const projectId = String(item.projectId ?? "");
    const workspaceId = String(item.workspaceId ?? "");
    if (auth.projectId && projectId && auth.projectId !== projectId) {
      throw notFoundError("Not found");
    }
    if (auth.workspaceId && workspaceId && auth.workspaceId !== workspaceId) {
      throw notFoundError("Not found");
    }
    return item;
  } catch (error) {
    if ((error as { httpStatus?: number }).httpStatus === 404) throw error;
    throw notFoundError("Not found");
  }
}

export function paginationQueries(args: Record<string, unknown>) {
  const rawLimit = typeof args.limit === "number" ? args.limit : 50;
  const limit = Math.min(Math.max(1, rawLimit), 100);
  const cursorAfter = typeof args.cursorAfter === "string" ? args.cursorAfter : undefined;
  return { limit, cursorAfter };
}
