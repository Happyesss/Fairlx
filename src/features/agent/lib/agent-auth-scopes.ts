import { PERMISSIONS, scopesFromPermissions } from "@fairlx/mcp-server";

const VIEWER_PERMISSIONS = [
  PERMISSIONS.VIEW_PROJECT,
  PERMISSIONS.VIEW_TASKS,
  PERMISSIONS.VIEW_SPRINTS,
  PERMISSIONS.VIEW_DOCS,
  PERMISSIONS.VIEW_MEMBERS,
];

const MEMBER_PERMISSIONS = [
  PERMISSIONS.VIEW_PROJECT,
  PERMISSIONS.VIEW_TASKS,
  PERMISSIONS.VIEW_SPRINTS,
  PERMISSIONS.VIEW_DOCS,
  PERMISSIONS.VIEW_MEMBERS,
  PERMISSIONS.CREATE_TASKS,
  PERMISSIONS.EDIT_TASKS,
];

const ADMIN_PERMISSIONS = [
  PERMISSIONS.VIEW_PROJECT,
  PERMISSIONS.VIEW_TASKS,
  PERMISSIONS.VIEW_SPRINTS,
  PERMISSIONS.VIEW_DOCS,
  PERMISSIONS.VIEW_MEMBERS,
  PERMISSIONS.CREATE_TASKS,
  PERMISSIONS.EDIT_TASKS,
  PERMISSIONS.DELETE_TASKS,
  PERMISSIONS.CREATE_SPRINTS,
  PERMISSIONS.EDIT_SPRINTS,
  PERMISSIONS.START_SPRINT,
  PERMISSIONS.COMPLETE_SPRINT,
  PERMISSIONS.DELETE_SPRINTS,
  PERMISSIONS.CREATE_COMMENTS,
  PERMISSIONS.DELETE_COMMENTS,
  PERMISSIONS.CREATE_DOCS,
  PERMISSIONS.EDIT_DOCS,
  PERMISSIONS.DELETE_DOCS,
  PERMISSIONS.EDIT_SETTINGS,
];

export function scopesForWorkspaceRole(role?: string | null): { scopes: string[]; isOwner: boolean } {
  const key = String(role || "").toUpperCase();
  if (["OWNER", "PROJECT_OWNER"].includes(key)) {
    return { scopes: scopesFromPermissions([], { isOwner: true }), isOwner: true };
  }
  if (["ADMIN", "WS_ADMIN", "PROJECT_ADMIN"].includes(key)) {
    return { scopes: scopesFromPermissions(ADMIN_PERMISSIONS), isOwner: false };
  }
  if (["VIEWER", "WS_VIEWER"].includes(key)) {
    return { scopes: scopesFromPermissions(VIEWER_PERMISSIONS), isOwner: false };
  }
  return { scopes: scopesFromPermissions(MEMBER_PERMISSIONS), isOwner: false };
}

export function mergeAgentMcpAuth(params: {
  workspaceRole?: string | null;
  projectAccess?: { hasAccess: boolean; isOwner: boolean; permissions: string[] } | null;
}): { scopes: string[]; projectPermissions?: string[] } {
  const { scopes, isOwner } = scopesForWorkspaceRole(params.workspaceRole);
  let merged = isOwner ? scopesFromPermissions([], { isOwner: true }) : [...scopes];
  const access = params.projectAccess;
  if (!access?.hasAccess) {
    return { scopes: merged };
  }
  const projectScopes = scopesFromPermissions(access.permissions, { isOwner: access.isOwner });
  merged = [...new Set([...merged, ...projectScopes])];
  return {
    scopes: merged,
    projectPermissions: access.isOwner || isOwner ? undefined : access.permissions,
  };
}
