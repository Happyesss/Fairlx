import { forbiddenError, notFoundError } from "../protocol/errors";
import type { AuthContext } from "../auth/context";
import { hasScope } from "../auth/scopes";
import type { McpProjectAccess, McpRuntime } from "./types";

export async function requireProjectAccess(
  runtime: McpRuntime,
  auth: AuthContext,
  projectId: string,
  permission: string,
  scopes: string[]
): Promise<McpProjectAccess> {
  if (auth.projectId && auth.projectId !== projectId) {
    throw notFoundError("Not found");
  }
  if (!hasScope(auth.scopes, scopes)) {
    throw forbiddenError("Insufficient MCP scope");
  }

  const access = await runtime.resolveUserProjectAccess(auth.actorUserId, projectId);
  if (!access.hasAccess) {
    throw notFoundError("Not found");
  }
  if (!runtime.hasProjectPermission(access, permission)) {
    throw forbiddenError("Insufficient project permission");
  }
  return access;
}

export function assertWorkspaceBound(auth: AuthContext, workspaceId: string): void {
  if (auth.workspaceId && auth.workspaceId !== workspaceId) {
    throw notFoundError("Not found");
  }
}
