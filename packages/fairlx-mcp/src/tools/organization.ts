import { forbiddenError, invalidParams, notFoundError } from "../protocol/errors";
import type { McpToolResult } from "../protocol/types";
import type { AuthContext } from "../auth/context";
import type { McpRuntime } from "../runtime/types";
import { toolResult } from "../runtime/output";
import { listAllDocuments, optionalString, requireString } from "./helpers";

export const ORG_PERMISSION = {
  MEMBERS_VIEW: "org.members.view",
  MEMBERS_MANAGE: "org.members.manage",
  SETTINGS_MANAGE: "org.settings.manage",
  WORKSPACE_ASSIGN: "org.workspace.assign",
} as const;

export async function resolveOrganizationId(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext,
): Promise<string> {
  const fromArgs = optionalString(args, "organizationId");
  if (fromArgs) return fromArgs;
  if (auth.organizationId) return auth.organizationId;
  const workspaceId = optionalString(args, "workspaceId") || auth.workspaceId;
  if (!workspaceId) {
    throw invalidParams("Provide organizationId or workspaceId");
  }
  const workspace = await runtime.store.get<Record<string, unknown>>(
    runtime.collections.workspaces,
    workspaceId,
  );
  const organizationId = String(workspace.organizationId ?? "").trim();
  if (!organizationId) {
    throw invalidParams("This workspace is not in an organization.");
  }
  return organizationId;
}

export async function organizationName(
  runtime: McpRuntime,
  organizationId: string,
): Promise<string | null> {
  const collection = runtime.collections.organizations;
  if (!collection) return null;
  try {
    const org = await runtime.store.get<Record<string, unknown>>(collection, organizationId);
    const name = String(org.name ?? "").trim();
    return name || null;
  } catch {
    return null;
  }
}

export async function actorCanReadOrganization(
  runtime: McpRuntime,
  auth: AuthContext,
  organizationId: string,
): Promise<boolean> {
  const orgMembersCollection = runtime.collections.organizationMembers;
  if (orgMembersCollection) {
    const orgMembership = await runtime.store.list<Record<string, unknown>>(orgMembersCollection, [
      { type: "equal", field: "organizationId", value: organizationId },
      { type: "equal", field: "userId", value: auth.actorUserId },
      { type: "limit", value: 1 },
    ]);
    if (orgMembership.documents.length > 0) {
      const status = String(orgMembership.documents[0]?.status ?? "ACTIVE").toUpperCase();
      if (status !== "SUSPENDED") return true;
    }
  }

  const workspaces = await listAllDocuments(runtime, runtime.collections.workspaces, [
    { type: "equal", field: "organizationId", value: organizationId },
  ]);
  for (const workspace of workspaces) {
    const workspaceId = String(workspace.$id ?? workspace.id ?? "");
    if (!workspaceId) continue;
    const membership = await runtime.store.list<Record<string, unknown>>(runtime.collections.members, [
      { type: "equal", field: "userId", value: auth.actorUserId },
      { type: "equal", field: "workspaceId", value: workspaceId },
      { type: "limit", value: 1 },
    ]);
    if (membership.documents.length > 0) return true;
  }
  return false;
}

async function requireOrgRead(
  runtime: McpRuntime,
  auth: AuthContext,
  organizationId: string,
): Promise<void> {
  if (!(await actorCanReadOrganization(runtime, auth, organizationId))) {
    throw notFoundError("Not found");
  }
}

function hasOrgPermission(
  access: { isOwner: boolean; permissions: string[] },
  permission: string,
): boolean {
  if (access.isOwner) return true;
  return access.permissions.includes(permission);
}

export async function organizationGet(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext,
): Promise<McpToolResult> {
  const organizationId = await resolveOrganizationId(args, runtime, auth);
  await requireOrgRead(runtime, auth, organizationId);

  const collection = runtime.collections.organizations;
  if (!collection) {
    return toolResult({ error: "Organizations are unavailable." }, true);
  }
  const org = await runtime.store.get<Record<string, unknown>>(collection, organizationId);
  const name = String(org.name ?? "").trim();
  if (!name) throw notFoundError("Not found");

  const orgMembersCollection = runtime.collections.organizationMembers;
  const orgMembers = orgMembersCollection
    ? await listAllDocuments(runtime, orgMembersCollection, [
        { type: "equal", field: "organizationId", value: organizationId },
      ])
    : [];
  const actorOrg = orgMembers.find((doc) => String(doc.userId ?? "") === auth.actorUserId);
  const access = runtime.resolveUserOrgAccess
    ? await runtime.resolveUserOrgAccess(auth.actorUserId, organizationId)
    : null;

  return toolResult({
    organization: {
      name,
      memberCount: orgMembers.length,
    },
    you: {
      orgRole: actorOrg ? String(actorOrg.role ?? access?.role ?? "MEMBER") : access?.role ?? null,
      workspaceMember: !actorOrg,
      canManageMembers: access ? hasOrgPermission(access, ORG_PERMISSION.MEMBERS_MANAGE) : false,
      canManageSettings: access ? hasOrgPermission(access, ORG_PERMISSION.SETTINGS_MANAGE) : false,
    },
    note: "Organization and workspace are different. This is the company. Use fairlx_workspace_get for the current workspace.",
  });
}

export async function organizationList(
  _args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext,
): Promise<McpToolResult> {
  const orgMembersCollection = runtime.collections.organizationMembers;
  const orgCollection = runtime.collections.organizations;
  if (!orgMembersCollection || !orgCollection) {
    return toolResult({ organizations: [], message: "Organizations are unavailable." });
  }

  const memberships = await listAllDocuments(runtime, orgMembersCollection, [
    { type: "equal", field: "userId", value: auth.actorUserId },
  ]);
  const organizations = [];
  for (const membership of memberships) {
    const organizationId = String(membership.organizationId ?? "").trim();
    if (!organizationId) continue;
    const status = String(membership.status ?? "ACTIVE").toUpperCase();
    if (status === "SUSPENDED") continue;
    try {
      const org = await runtime.store.get<Record<string, unknown>>(orgCollection, organizationId);
      organizations.push({
        name: String(org.name ?? ""),
        role: String(membership.role ?? "MEMBER"),
        status,
      });
    } catch {
      // skip missing
    }
  }
  return toolResult({ organizations });
}

export async function organizationWorkspacesList(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext,
): Promise<McpToolResult> {
  const organizationId = await resolveOrganizationId(args, runtime, auth);
  await requireOrgRead(runtime, auth, organizationId);
  const orgName = (await organizationName(runtime, organizationId)) ?? "";

  const workspaces = await listAllDocuments(runtime, runtime.collections.workspaces, [
    { type: "equal", field: "organizationId", value: organizationId },
  ]);
  const access = runtime.resolveUserOrgAccess
    ? await runtime.resolveUserOrgAccess(auth.actorUserId, organizationId)
    : null;
  const canSeeAll =
    Boolean(access?.isOwner) ||
    Boolean(access && hasOrgPermission(access, ORG_PERMISSION.WORKSPACE_ASSIGN));

  const visible = [];
  for (const workspace of workspaces) {
    const workspaceId = String(workspace.$id ?? workspace.id ?? "");
    const membership = await runtime.store.list<Record<string, unknown>>(runtime.collections.members, [
      { type: "equal", field: "userId", value: auth.actorUserId },
      { type: "equal", field: "workspaceId", value: workspaceId },
      { type: "limit", value: 1 },
    ]);
    const inWorkspace = membership.documents.length > 0;
    if (!canSeeAll && !inWorkspace) continue;
    visible.push({
      name: String(workspace.name ?? ""),
      role: inWorkspace ? String(membership.documents[0]?.role ?? "MEMBER") : null,
      inWorkspace,
    });
  }

  return toolResult({
    organization: orgName,
    workspaces: visible,
  });
}

export async function organizationUpdate(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext,
): Promise<McpToolResult> {
  const organizationId = await resolveOrganizationId(args, runtime, auth);
  const name = requireString(args, "name").trim();
  if (!name) throw invalidParams("Provide the new organization name");

  const collection = runtime.collections.organizations;
  if (!collection) {
    return toolResult({ error: "Organizations are unavailable." }, true);
  }
  if (!runtime.resolveUserOrgAccess) {
    throw forbiddenError("Organization updates are unavailable.");
  }
  const access = await runtime.resolveUserOrgAccess(auth.actorUserId, organizationId);
  if (!hasOrgPermission(access, ORG_PERMISSION.SETTINGS_MANAGE)) {
    throw forbiddenError(
      "You do not have organization settings permission. A workspace admin role is not enough to rename the organization.",
    );
  }

  const updated = await runtime.store.update<Record<string, unknown>>(collection, organizationId, { name });
  return toolResult({
    organization: { name: String(updated.name ?? name) },
    updated: true,
  });
}
