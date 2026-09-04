import {
  jwtToAuthContext,
  listToolsForClient,
  type AuthContext,
} from "@fairlx/mcp-server";
import type { Databases } from "node-appwrite";

import { resolveUserProjectAccess } from "@/lib/permissions/resolveUserProjectAccess";

import type { AgentContext, AgentRun } from "../types";
import { mergeAgentMcpAuth } from "./agent-auth-scopes";

export { mergeAgentMcpAuth, scopesForWorkspaceRole } from "./agent-auth-scopes";

export async function buildAgentMcpAuth(params: {
  databases: Databases;
  userId: string;
  context: AgentContext;
  run: AgentRun;
}): Promise<AuthContext> {
  const { databases, userId, context, run } = params;
  const workspace =
    context.workspaces.find((item) => item.id === run.workspaceId) ??
    context.workspaces.find((item) => item.id === context.workspaces[0]?.id);
  const projectId = run.projectId || undefined;
  let projectAccess: { hasAccess: boolean; isOwner: boolean; permissions: string[] } | null = null;

  if (projectId) {
    try {
      const access = await resolveUserProjectAccess(databases, userId, projectId);
      if (access.hasAccess) {
        projectAccess = {
          hasAccess: true,
          isOwner: access.isOwner,
          permissions: access.permissions,
        };
      }
    } catch {
      // Fall through to workspace role.
    }
  }

  const merged = mergeAgentMcpAuth({
    workspaceRole: workspace?.role,
    projectAccess,
  });
  return jwtToAuthContext(userId, {
    workspaceId: workspace?.id || run.workspaceId,
    projectId,
    organizationId: workspace?.organizationId,
    scopes: merged.scopes,
    projectPermissions: merged.projectPermissions,
  });
}

export function mcpToolsForAuth(auth: AuthContext) {
  return listToolsForClient(auth);
}
