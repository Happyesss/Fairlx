/**
 * Workspace admin shortcut: add a person to the organization and this workspace
 * in one step. Organization membership and workspace membership stay distinct —
 * this only collapses the two writes for an admin of that workspace.
 */

export function isWorkspaceAdminRole(role: string | undefined | null): boolean {
  const key = String(role ?? "").trim().toUpperCase();
  return key === "OWNER" || key === "ADMIN" || key === "WS_ADMIN";
}

export function canAddToOrganizationAndWorkspace(input: {
  isOrgOwner: boolean;
  hasMembersManage: boolean;
  actorWorkspaceRole?: string | null;
}): boolean {
  if (input.isOrgOwner || input.hasMembersManage) return true;
  return isWorkspaceAdminRole(input.actorWorkspaceRole);
}
