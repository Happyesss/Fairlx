import { ID, Query, type Databases } from "node-appwrite";

import { DATABASE_ID, MEMBERS_ID, ORGANIZATION_MEMBERS_ID, ORGANIZATIONS_ID, WORKSPACES_ID } from "@/config";
import { createAdminClient } from "@/lib/appwrite";
import { CK, CKPattern, invalidateCache, invalidateCachePattern } from "@/lib/redis";
import { hasOrgPermissionFromAccess, resolveUserOrgAccess } from "@/lib/permissions/resolveUserOrgAccess";
import { OrgPermissionKey } from "@/features/org-permissions/types";
import { inviteOrganizationMember, InviteOrgMemberError } from "@/features/organizations/services/invite-org-member";
import { Organization } from "@/features/organizations/types";

import { MemberRole, MemberStatus } from "../types";
import { canAddToOrganizationAndWorkspace } from "../lib/org-and-workspace-access";

export class AddToOrgAndWorkspaceError extends Error {
  constructor(
    public code:
      | "UNAUTHORIZED"
      | "NOT_ORG_WORKSPACE"
      | "WORKSPACE_NOT_FOUND"
      | "INVALID_EMAIL"
      | "INVALID_ROLE"
      | "ALREADY_IN_WORKSPACE"
      | "FAILED",
    message: string,
  ) {
    super(message);
    this.name = "AddToOrgAndWorkspaceError";
  }
}

export type AddToOrgAndWorkspaceResult = {
  userId: string;
  email: string;
  name: string;
  role: MemberRole;
  addedToOrganization: boolean;
  addedToWorkspace: boolean;
  alreadyInWorkspace: boolean;
  emailSent: boolean;
  emailError?: string;
  organizationName: string;
  workspaceName: string;
};

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeWorkspaceRole(raw?: string): MemberRole {
  const key = String(raw ?? MemberRole.MEMBER).trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (key === MemberRole.OWNER) return MemberRole.OWNER;
  if (key === MemberRole.ADMIN || key === "WS_ADMIN" || key === "ADMINISTRATOR") return MemberRole.ADMIN;
  if (key === MemberRole.MEMBER || key === "WS_EDITOR" || key === "EDITOR") return MemberRole.MEMBER;
  throw new AddToOrgAndWorkspaceError(
    "INVALID_ROLE",
    `Unknown role "${raw}". Use ADMIN or MEMBER.`,
  );
}

export async function actorMayAddToOrganizationAndWorkspace(params: {
  databases: Databases;
  actorUserId: string;
  organizationId: string;
  workspaceId: string;
}): Promise<{ allowed: boolean; actorWorkspaceRole: string | null }> {
  const access = await resolveUserOrgAccess(params.databases, params.actorUserId, params.organizationId);
  const membership = await params.databases.listDocuments(DATABASE_ID, MEMBERS_ID, [
    Query.equal("workspaceId", params.workspaceId),
    Query.equal("userId", params.actorUserId),
    Query.limit(1),
  ]);
  const actorWorkspaceRole = String(membership.documents[0]?.role ?? "") || null;
  return {
    actorWorkspaceRole,
    allowed: canAddToOrganizationAndWorkspace({
      isOrgOwner: access.isOwner,
      hasMembersManage: hasOrgPermissionFromAccess(access, OrgPermissionKey.MEMBERS_MANAGE),
      actorWorkspaceRole,
    }),
  };
}

async function findOrganizationMemberUser(params: {
  databases: Databases;
  organizationId: string;
  email: string;
}): Promise<{ userId: string; name: string; email: string } | null> {
  const { users } = await createAdminClient();
  const byEmail = await params.databases.listDocuments(DATABASE_ID, ORGANIZATION_MEMBERS_ID, [
    Query.equal("organizationId", params.organizationId),
    Query.equal("email", params.email),
    Query.limit(1),
  ]);
  const orgDoc = byEmail.documents[0];
  if (orgDoc) {
    return {
      userId: String(orgDoc.userId ?? ""),
      name: String(orgDoc.name ?? params.email.split("@")[0] ?? "Member"),
      email: String(orgDoc.email ?? params.email),
    };
  }

  const existingUsers = await users.list([Query.equal("email", params.email)]);
  const existingUser = existingUsers.users[0];
  if (!existingUser) return null;

  const byUser = await params.databases.listDocuments(DATABASE_ID, ORGANIZATION_MEMBERS_ID, [
    Query.equal("organizationId", params.organizationId),
    Query.equal("userId", existingUser.$id),
    Query.limit(1),
  ]);
  if (byUser.total === 0) return null;
  return {
    userId: existingUser.$id,
    name: existingUser.name || existingUser.email || params.email.split("@")[0] || "Member",
    email: existingUser.email || params.email,
  };
}

/**
 * Add a person to the organization and then to this workspace.
 * Workspace admins can do this without waiting for the organization owner.
 */
export async function addMemberToOrganizationAndWorkspace(params: {
  databases: Databases;
  actorUserId: string;
  workspaceId: string;
  email: string;
  name?: string;
  role?: string;
}): Promise<AddToOrgAndWorkspaceResult> {
  const email = params.email.trim().toLowerCase();
  if (!looksLikeEmail(email)) {
    throw new AddToOrgAndWorkspaceError("INVALID_EMAIL", "Provide a valid email address.");
  }

  const role = normalizeWorkspaceRole(params.role);
  let workspace;
  try {
    workspace = await params.databases.getDocument(DATABASE_ID, WORKSPACES_ID, params.workspaceId);
  } catch {
    throw new AddToOrgAndWorkspaceError("WORKSPACE_NOT_FOUND", "Workspace not found.");
  }

  const organizationId = String(workspace.organizationId ?? "").trim();
  if (!organizationId) {
    throw new AddToOrgAndWorkspaceError(
      "NOT_ORG_WORKSPACE",
      "This workspace is not in an organization. Use the invite link instead.",
    );
  }

  const { allowed, actorWorkspaceRole } = await actorMayAddToOrganizationAndWorkspace({
    databases: params.databases,
    actorUserId: params.actorUserId,
    organizationId,
    workspaceId: params.workspaceId,
  });
  if (!allowed) {
    throw new AddToOrgAndWorkspaceError(
      "UNAUTHORIZED",
      "A workspace admin can add this person to the organization and this workspace. Organization owner approval is not required.",
    );
  }
  if (role === MemberRole.OWNER && actorWorkspaceRole !== MemberRole.OWNER) {
    throw new AddToOrgAndWorkspaceError("UNAUTHORIZED", "Only the workspace owner can grant owner.");
  }

  let organization: Organization;
  try {
    organization = await params.databases.getDocument<Organization>(
      DATABASE_ID,
      ORGANIZATIONS_ID,
      organizationId,
    );
  } catch {
    throw new AddToOrgAndWorkspaceError("FAILED", "Organization not found.");
  }

  const displayName = params.name?.trim() || email.split("@")[0] || "Member";
  let userId = "";
  let memberName = displayName;
  let memberEmail = email;
  let addedToOrganization = false;
  let emailSent = false;
  let emailError: string | undefined;

  const existingOrgMember = await findOrganizationMemberUser({
    databases: params.databases,
    organizationId,
    email,
  });

  if (existingOrgMember?.userId) {
    userId = existingOrgMember.userId;
    memberName = existingOrgMember.name || displayName;
    memberEmail = existingOrgMember.email || email;
  } else {
    try {
      const invited = await inviteOrganizationMember({
        databases: params.databases,
        actorUserId: params.actorUserId,
        organizationId,
        email,
        fullName: displayName,
        role: "MEMBER",
      });
      userId = invited.userId;
      memberName = invited.name;
      memberEmail = invited.email;
      addedToOrganization = true;
      emailSent = invited.emailSent;
      emailError = invited.emailError;
    } catch (error) {
      if (error instanceof InviteOrgMemberError && error.code === "EMAIL_EXISTS") {
        const again = await findOrganizationMemberUser({
          databases: params.databases,
          organizationId,
          email,
        });
        if (!again?.userId) {
          throw new AddToOrgAndWorkspaceError("FAILED", error.message);
        }
        userId = again.userId;
        memberName = again.name;
        memberEmail = again.email;
      } else {
        throw new AddToOrgAndWorkspaceError(
          "FAILED",
          error instanceof Error ? error.message : "Failed to add this person to the organization.",
        );
      }
    }
  }

  const existingWorkspace = await params.databases.listDocuments(DATABASE_ID, MEMBERS_ID, [
    Query.equal("workspaceId", params.workspaceId),
    Query.equal("userId", userId),
    Query.limit(1),
  ]);
  if (existingWorkspace.total > 0) {
    if (addedToOrganization) {
      return {
        userId,
        email: memberEmail,
        name: memberName,
        role: String(existingWorkspace.documents[0]?.role ?? MemberRole.MEMBER) as MemberRole,
        addedToOrganization: true,
        addedToWorkspace: false,
        alreadyInWorkspace: true,
        emailSent,
        emailError,
        organizationName: organization.name,
        workspaceName: String(workspace.name ?? ""),
      };
    }
    throw new AddToOrgAndWorkspaceError(
      "ALREADY_IN_WORKSPACE",
      `${memberName || memberEmail} is already a workspace member.`,
    );
  }

  await params.databases.createDocument(DATABASE_ID, MEMBERS_ID, ID.unique(), {
    workspaceId: params.workspaceId,
    userId,
    role,
    status: MemberStatus.ACTIVE,
  });

  await invalidateCache(
    CK.workspaceMember(userId, params.workspaceId),
    CK.memberList(params.workspaceId),
    CK.authLifecycle(userId),
    CK.authLifecycle(params.actorUserId),
  );
  await invalidateCachePattern(CKPattern.workspacePerms(params.workspaceId));
  await invalidateCachePattern(CKPattern.allUserPerms(userId));

  return {
    userId,
    email: memberEmail,
    name: memberName,
    role,
    addedToOrganization,
    addedToWorkspace: true,
    alreadyInWorkspace: false,
    emailSent,
    emailError,
    organizationName: organization.name,
    workspaceName: String(workspace.name ?? ""),
  };
}
