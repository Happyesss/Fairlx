import type { McpTokenRecord } from "../runtime/types";
import { ALL_SCOPES, resolveEffectiveScopes } from "./scopes";

export interface AuthContext {
  actorUserId: string;
  tokenId?: string;
  projectId?: string;
  workspaceId?: string;
  organizationId?: string;
  scopes: string[];
  /** Set for project-scoped tokens after role resolution. Used to filter tools/list. */
  projectPermissions?: string[];
  authType: "secret" | "jwt";
}

export function tokenToAuthContext(
  token: McpTokenRecord,
  options?: { roleScopes?: string[]; projectPermissions?: string[] }
): AuthContext {
  return {
    actorUserId: token.createdBy,
    tokenId: token.$id,
    projectId: token.projectId || undefined,
    workspaceId: token.workspaceId,
    organizationId: token.organizationId,
    scopes: resolveEffectiveScopes({
      explicitScopes: token.scopes,
      roleScopes: options?.roleScopes,
    }),
    projectPermissions: options?.projectPermissions,
    authType: "secret",
  };
}

export function jwtToAuthContext(
  userId: string,
  options?: {
    workspaceId?: string;
    projectId?: string;
    organizationId?: string;
    scopes?: string[];
    projectPermissions?: string[];
  }
): AuthContext {
  return {
    actorUserId: userId,
    workspaceId: options?.workspaceId,
    projectId: options?.projectId,
    organizationId: options?.organizationId,
    scopes: options?.scopes?.length ? options.scopes : [...ALL_SCOPES],
    projectPermissions: options?.projectPermissions,
    authType: "jwt",
  };
}
