import { z } from "zod";
import { Hono } from "hono";
import { Query, ID } from "node-appwrite";
import { zValidator } from "@hono/zod-validator";

import { sessionMiddleware } from "@/lib/session-middleware";
import { createAdminClient } from "@/lib/appwrite";
import { batchGetUsers } from "@/lib/batch-users";
import { DATABASE_ID, MEMBERS_ID, NOTIFICATIONS_ID, WORKSPACES_ID } from "@/config";
import { getPermissions } from "@/lib/rbac";
import { validateUserOrgMembershipForWorkspace } from "@/lib/invariants";
import { invalidateCache, invalidateCachePattern, CK, CKPattern } from "@/lib/redis";
import { logComputeUsage } from "@/lib/usage-metering";

import { getMember } from "../utils";
import { Member, MemberRole, WorkspaceMemberRole, MemberStatus } from "../types";
import {
  dispatchWorkitemEvent,
} from "@/lib/notifications";
import {
  createMemberAddedEvent,
  createMemberRemovedEvent,
} from "@/lib/notifications/events";

const app = new Hono()
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const { users } = await createAdminClient();
      const databases = c.get("databases");
      const user = c.get("user");
      const { workspaceId } = c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // INVARIANT: Validate org membership for org workspaces
      try {
        await validateUserOrgMembershipForWorkspace(databases, user.$id, workspaceId);
      } catch {
        // Don't block - just log for observability
      }

      const members = await databases.listDocuments<Member>(DATABASE_ID, MEMBERS_ID, [
        Query.equal("workspaceId", workspaceId),
      ]);

      // OPTIMIZED: Batch-fetch all users in one call (was N+1 users.get per member)
      const userIds = members.documents.map(m => m.userId);
      const userMap = await batchGetUsers(users, userIds);

      const populatedMembers = members.documents
        .map((member) => {
          const userData = userMap.get(member.userId);
          if (!userData) return null;
          const prefs = userData.prefs as { profileImageUrl?: string | null } | undefined;

          return {
            ...member,
            name: userData.name || userData.email,
            email: userData.email,
            profileImageUrl: prefs?.profileImageUrl ?? null,
          };
        })
        .filter((member): member is NonNullable<typeof member> => member !== null);

      return c.json({ data: { ...members, documents: populatedMembers } });
    }
  )

  .get(
    "/current",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId } = c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const permissions = await getPermissions(databases, workspaceId, user.$id);

      return c.json({ data: { ...member, permissions } });
    }
  )
  .delete("/:memberId", sessionMiddleware, async (c) => {
    const { memberId } = c.req.param();
    const user = c.get("user");
    const databases = c.get("databases");

    const memberToDelete = await databases.getDocument(
      DATABASE_ID,
      MEMBERS_ID,
      memberId
    );

    const allMembersInWorkspace = await databases.listDocuments(
      DATABASE_ID,
      MEMBERS_ID,
      [Query.equal("workspaceId", memberToDelete.workspaceId)]
    );

    const member = await getMember({
      databases,
      workspaceId: memberToDelete.workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Verify delete permissions - support both legacy and new roles
    const isAdminOrOwner =
      member.role === MemberRole.ADMIN ||
      member.role === MemberRole.OWNER ||
      member.role === WorkspaceMemberRole.WS_ADMIN;
    const isDeletingSelf = member.$id === memberToDelete.$id;

    if (!isDeletingSelf && !isAdminOrOwner) {
      return c.json({ error: "Unauthorized. Only admins or owners can remove other members." }, 401);
    }

    // Prevent last member deletion
    if (allMembersInWorkspace.total === 1) {
      return c.json({ error: "Cannot delete the only member." }, 400);
    }

    // Enforce owner transfer
    if (memberToDelete.role === MemberRole.OWNER && isDeletingSelf) {
      return c.json({
        error: "Cannot leave workspace as owner. Transfer ownership to another member first."
      }, 400);
    }

    // Protect owner role
    if (memberToDelete.role === MemberRole.OWNER && !isDeletingSelf) {
      return c.json({
        error: "Cannot remove the workspace owner. They must transfer ownership first."
      }, 400);
    }

    await databases.updateDocument(DATABASE_ID, MEMBERS_ID, memberId, {
      status: MemberStatus.DELETED,
      deletedAt: new Date().toISOString(),
      deletedBy: user.$id,
    });

    // Dispatch member removal event (non-blocking)
    try {
      const workspace = await databases.getDocument(DATABASE_ID, WORKSPACES_ID, memberToDelete.workspaceId);
      const userName = user.name || user.email || "Someone";

      // We need the target user info to get their name
      const { users } = await createAdminClient();
      const targetUser = await users.get(memberToDelete.userId);
      const targetName = targetUser.name || targetUser.email || "Someone";

      const event = createMemberRemovedEvent(
        memberToDelete.workspaceId,
        workspace.name,
        user.$id,
        userName,
        memberToDelete.userId,
        targetName
      );
      dispatchWorkitemEvent(event).catch(() => { });
    } catch {
      // Silent
    }

    // Invalidate member and permission caches
    await invalidateCache(
      CK.workspaceMember(memberToDelete.userId, memberToDelete.workspaceId),
      CK.memberList(memberToDelete.workspaceId)
    );
    await invalidateCachePattern(CKPattern.workspacePerms(memberToDelete.workspaceId));
    await invalidateCachePattern(CKPattern.allUserPerms(memberToDelete.userId));

    // LOG COMPUTE USAGE: Member Removal
    logComputeUsage({
      databases,
      workspaceId: memberToDelete.workspaceId,
      units: 1,
      jobType: "member_remove",
    });

    return c.json({ data: { $id: memberToDelete.$id } });
  })
  .patch(
    "/:memberId",
    sessionMiddleware,
    zValidator("json", z.object({ role: z.union([z.nativeEnum(MemberRole), z.string()]) })),
    async (c) => {
      const { memberId } = c.req.param();
      const { role } = c.req.valid("json");
      const user = c.get("user");
      const databases = c.get("databases");

      const memberToUpdate = await databases.getDocument(
        DATABASE_ID,
        MEMBERS_ID,
        memberId
      );

      const allMembersInWorkspace = await databases.listDocuments(
        DATABASE_ID,
        MEMBERS_ID,
        [Query.equal("workspaceId", memberToUpdate.workspaceId)]
      );

      const member = await getMember({
        databases,
        workspaceId: memberToUpdate.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Support both legacy (ADMIN) and new (WS_ADMIN) roles for update permissions
      if (member.role !== MemberRole.ADMIN &&
        member.role !== MemberRole.OWNER &&
        member.role !== WorkspaceMemberRole.WS_ADMIN) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (allMembersInWorkspace.total === 1) {
        return c.json({ error: "Cannot downgrade the only member." }, 400);
      }

      // PRIVILEGE ESCALATION CHECK
      // 1. Prevent setting role to OWNER unless caller is OWNER
      if (role === MemberRole.OWNER && member.role !== MemberRole.OWNER) {
        return c.json({ error: "Only the Workspace Owner can grant Owner privileges." }, 403);
      }

      // 2. Prevent modifying an existing OWNER unless caller is OWNER
      // (Self-update allowed if caller is OWNER, but redundant check since only Owner passes)
      if (memberToUpdate.role === MemberRole.OWNER && member.role !== MemberRole.OWNER) {
        return c.json({ error: "Only the Workspace Owner can modify the Owner's role." }, 403);
      }

      await databases.updateDocument(DATABASE_ID, MEMBERS_ID, memberId, {
        role,
      });

      // Notify the user about their role change (non-blocking)
      try {
        const { databases: adminDb } = await createAdminClient();
        const workspace = await adminDb.getDocument(DATABASE_ID, WORKSPACES_ID, memberToUpdate.workspaceId);
        const callerName = user.name || user.email || "Someone";

        await adminDb.createDocument(
          DATABASE_ID,
          NOTIFICATIONS_ID,
          ID.unique(),
          {
            userId: memberToUpdate.userId,
            type: "task_updated", // Using existing enum for DB compatibility
            title: "Role Updated",
            message: `${callerName} changed your role to ${role} in "${workspace.name}"`,
            workspaceId: memberToUpdate.workspaceId,
            triggeredBy: user.$id,
            metadata: JSON.stringify({ eventType: "WORKSPACE_ROLE_CHANGED", newRole: role }),
            read: false,
          },
          [
            `read("user:${memberToUpdate.userId}")`,
            `update("user:${memberToUpdate.userId}")`,
            `delete("user:${memberToUpdate.userId}")`
          ]
        );
      } catch {
        // Silent failure - notifications are non-critical
      }

      // Invalidate member and permission caches on role change
      await invalidateCache(
        CK.workspaceMember(memberToUpdate.userId, memberToUpdate.workspaceId),
        CK.memberList(memberToUpdate.workspaceId)
      );
      await invalidateCachePattern(CKPattern.workspacePerms(memberToUpdate.workspaceId));
      await invalidateCachePattern(CKPattern.allUserPerms(memberToUpdate.userId));

      return c.json({ data: { $id: memberToUpdate.$id } });
    }
  )
  /**
   * POST /members/from-org
   * Add an organization member to a workspace explicitly
   * 
   * WHY: Enables explicit assignment rather than only invite codes
   * 
   * REQUIREMENTS:
   * - Caller must be ADMIN/OWNER/WS_ADMIN of the workspace
   * - Target user must be a member of the organization (for org workspaces)
   * - User must not already be a workspace member
   */
  .post(
    "/from-org",
    sessionMiddleware,
    zValidator("json", z.object({
      workspaceId: z.string(),
      userId: z.string(),
      role: z.nativeEnum(MemberRole),
    })),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workspaceId, userId, role } = c.req.valid("json");

      // Verify caller has permission (workspace role OR org-level WORKSPACE_ASSIGN)
      const callerMember = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      // Check 1: Workspace-level admin role
      const hasWorkspaceAdminRole = callerMember && (
        callerMember.role === MemberRole.ADMIN ||
        callerMember.role === MemberRole.OWNER ||
        callerMember.role === WorkspaceMemberRole.WS_ADMIN
      );

      // Check 2: Org-level WORKSPACE_ASSIGN permission (from departments)
      // Check 2: Org-level WORKSPACE_ASSIGN permission (from departments)
      let hasOrgAssignPermission = false;
      try {
        const { resolveUserOrgAccess, hasOrgPermissionFromAccess } = await import("@/lib/permissions/resolveUserOrgAccess");
        const { OrgPermissionKey } = await import("@/features/org-permissions/types");
        const { WORKSPACES_ID } = await import("@/config");

        // Get the workspace to find its organizationId
        const workspace = await databases.getDocument(DATABASE_ID, WORKSPACES_ID, workspaceId);

        if (workspace.organizationId) {
          const orgAccess = await resolveUserOrgAccess(databases, user.$id, workspace.organizationId);
          hasOrgAssignPermission = hasOrgPermissionFromAccess(orgAccess, OrgPermissionKey.WORKSPACE_ASSIGN);
        }
      } catch {
      }

      if (!hasWorkspaceAdminRole && !hasOrgAssignPermission) {
        return c.json({ error: "Requires workspace admin role or WORKSPACE_ASSIGN permission" }, 401);
      }

      // ============================================================
      // CHECK FOR DIRECT WORKSPACE MEMBERSHIP ONLY
      // ============================================================
      // CRITICAL: We must NOT use getMember() here because it has an
      // organization fallback. A user being an org member does NOT mean
      // they are already a workspace member.
      // 
      // Workspace membership uniqueness is: (userId + workspaceId)
      const existingMembers = await databases.listDocuments(
        DATABASE_ID,
        MEMBERS_ID,
        [
          Query.equal("workspaceId", workspaceId),
          Query.equal("userId", userId),
        ]
      );

      const existingMember = existingMembers.documents[0] as Member;

      // LEDGER LOGIC: Handle Soft-Deleted Members
      if (existingMembers.total > 0) {
        if (existingMember.status === MemberStatus.DELETED) {
          // Reactivate the deleted member (Soft Restore)
          const reactivatedMember = await databases.updateDocument(
            DATABASE_ID,
            MEMBERS_ID,
            existingMember.$id,
            {
              status: MemberStatus.ACTIVE,
              role,
            }
          );

          // Notify about reactivation
          try {
            const adminDb = databases; // Reuse existing
            const workspace = await adminDb.getDocument(DATABASE_ID, WORKSPACES_ID, workspaceId);
            const callerName = user.name || user.email || "Someone";

            const { users } = await createAdminClient();
            const targetUser = await users.get(userId);
            const targetName = targetUser.name || targetUser.email || "Someone";

            const event = createMemberAddedEvent(
              workspaceId,
              workspace.name,
              user.$id,
              callerName,
              userId,
              targetName,
              role
            );
            dispatchWorkitemEvent(event).catch(() => { });
          } catch {
            // silent
          }

          await invalidateCache(
            CK.workspaceMember(userId, workspaceId),
            CK.memberList(workspaceId)
          );
          await invalidateCachePattern(CKPattern.workspacePerms(workspaceId));

          return c.json({ data: reactivatedMember });
        } else {
          // Active member already exists
          return c.json({ error: "User is already a workspace member" }, 400);
        }
      }

      // For org workspaces, validate org membership
      try {
        await validateUserOrgMembershipForWorkspace(databases, userId, workspaceId);
      } catch {
        return c.json({
          error: "User must be an organization member to be added to this workspace"
        }, 400);
      }

      // Create workspace membership
      const newMember = await databases.createDocument(
        DATABASE_ID,
        MEMBERS_ID,
        ID.unique(),
        {
          workspaceId,
          userId,
          role,
          status: MemberStatus.ACTIVE, // Default explicit status
        }
      );

      // Notify the new member about being added (non-blocking)
      try {
        const adminDb = databases; // Reuse
        const workspace = await adminDb.getDocument(DATABASE_ID, WORKSPACES_ID, workspaceId);
        const callerName = user.name || user.email || "Someone";

        const { users } = await createAdminClient();
        const targetUser = await users.get(userId);
        const targetName = targetUser.name || targetUser.email || "Someone";

        const event = createMemberAddedEvent(
          workspaceId,
          workspace.name,
          user.$id,
          callerName,
          userId,
          targetName,
          role
        );
        dispatchWorkitemEvent(event).catch(() => { });
      } catch {
        // Silent failure - notifications are non-critical
      }

      // Invalidate member caches
      await invalidateCache(CK.memberList(workspaceId));
      await invalidateCachePattern(CKPattern.workspacePerms(workspaceId));

      // LOG COMPUTE USAGE: Member Invite (from-org)
      logComputeUsage({
        databases,
        workspaceId: workspaceId,
        units: 1,
        jobType: "member_invite",
      });

      return c.json({ data: newMember });
    }
  );

export default app;
