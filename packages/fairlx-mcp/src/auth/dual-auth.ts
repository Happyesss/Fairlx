import { authError } from "../protocol/errors";
import type { McpRuntime, McpTokenRecord } from "../runtime/types";
import { jwtToAuthContext, tokenToAuthContext, type AuthContext } from "./context";
import { scopesFromPermissions } from "./scopes";

export function isFairlxSecretToken(token: string): boolean {
  return token.startsWith("flx_live_sec_") || token.startsWith("flx_");
}

export function looksLikeJwt(token: string): boolean {
  return token.startsWith("eyJ");
}

export async function authenticateBearer(
  runtime: McpRuntime,
  authorization: string | undefined
): Promise<AuthContext> {
  if (!authorization?.startsWith("Bearer ")) {
    throw authError("Missing bearer token");
  }
  const plaintext = authorization.slice(7).trim();
  if (!plaintext) {
    throw authError("Missing bearer token");
  }

  if (isFairlxSecretToken(plaintext)) {
    const hash = runtime.hashMcpToken(plaintext);
    const record = await runtime.lookupTokenByHash(hash);
    if (!record) {
      throw authError("Invalid token");
    }
    if (record.isRevoked) {
      throw authError("Token revoked");
    }
    if (record.expiresAt && Date.parse(record.expiresAt) < Date.now()) {
      throw authError("Token expired");
    }
    if (!record.createdBy) {
      throw authError("Invalid token");
    }
    runtime.touchTokenLastUsed?.(record.$id).catch(() => undefined);
    return hydrateTokenAuth(runtime, record);
  }

  if (!runtime.verifyJwt) {
    throw authError("Invalid token");
  }
  const jwt = await runtime.verifyJwt(plaintext);
  if (!jwt?.userId) {
    throw authError("Invalid token");
  }
  return jwtToAuthContext(jwt.userId);
}

/**
 * Project-scoped tokens inherit write/delete from the creator's current role.
 * Workspace-scoped tokens inherit the full MCP catalog; per-project RBAC still
 * runs on every tool call.
 */
async function hydrateTokenAuth(
  runtime: McpRuntime,
  record: McpTokenRecord
): Promise<AuthContext> {
  if (!record.projectId) {
    return tokenToAuthContext(record);
  }

  const access = await runtime.resolveUserProjectAccess(record.createdBy, record.projectId);
  if (!access.hasAccess) {
    return tokenToAuthContext(record);
  }

  return tokenToAuthContext(record, {
    roleScopes: scopesFromPermissions(access.permissions, { isOwner: access.isOwner }),
    projectPermissions: access.isOwner ? undefined : access.permissions,
  });
}
