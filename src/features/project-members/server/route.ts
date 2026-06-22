import { Hono } from "hono";
import { ID, Query } from "node-appwrite";
import { zValidator } from "@hono/zod-validator";

import { sessionMiddleware } from "@/lib/session-middleware";
import { createAdminClient } from "@/lib/appwrite";
import { batchGetUsers } from "@/lib/batch-users";
import {
    DATABASE_ID,
    PROJECT_MEMBERS_ID,
    PROJECT_ROLES_ID,
    PROJECT_TEAMS_ID,
    PROJECT_TEAM_MEMBERS_ID,
    PROJECTS_ID,
} from "@/config";
import {
    getProjectPermissionResult,
    canProject,
} from "@/lib/project-rbac";
import { PROJECT_PERMISSIONS } from "@/lib/project-permissions";
import { ProjectMember, ProjectRole, PopulatedProjectMember, ProjectMemberStatus } from "../types";
import { Project } from "@/features/projects/types";
import {
    createProjectMemberSchema,
    updateProjectMemberSchema,
    getProjectMembersSchema,
    getPermissionsSchema,
    createProjectRoleSchema,
    updateProjectRoleSchema,
    getProjectRolesSchema,
} from "../schemas";
import {
    dispatchWorkitemEvent,
} from "@/lib/notifications";
import {
    createProjectMemberAddedEvent,
    createProjectMemberRemovedEvent,
} from "@/lib/notifications/events";
import { invalidateCache, invalidateCachePattern, CK, CKPattern } from "@/lib/redis";

const app = new Hono()
    /**
     * GET /api/project-members/permissions
     * Get current user's permissions for a project
     */
    .get(
        "/permissions",
        sessionMiddleware,
        zValidator("query", getPermissionsSchema),
        async (c) => {
            const { databases: adminDb } = await createAdminClient();
            const user = c.get("user");
            const { projectId } = c.req.valid("query");

            const result = await getProjectPermissionResult(
                adminDb,
                user.$id,
                projectId
            );

            return c.json({ data: result });
        }
    )

    /**
     * GET /api/project-members/current
     * Get current user's memberships in a project
     */
    .get(
        "/current",
        sessionMiddleware,
        zValidator("query", getPermissionsSchema),
        async (c) => {
            const { users, databases: adminDb } = await createAdminClient();
            const user = c.get("user");
            const { projectId } = c.req.valid("query");

            const memberships = await adminDb.listDocuments<ProjectMember>(
                DATABASE_ID,
                PROJECT_MEMBERS_ID,
                [
                    Query.equal("userId", user.$id),
                    Query.equal("projectId", projectId),
                ]
            );

            if (memberships.total === 0) {
                return c.json({ data: [] });
            }

            // Populate with team and role info
            // OPTIMIZED: Batch-fetch all users in one call (was N+1 users.get per member)
            const memberUserIds = memberships.documents.map(m => m.userId);
            const userMap = await batchGetUsers(users, memberUserIds);

            const populated: PopulatedProjectMember[] = await Promise.all(
                memberships.documents.map(async (membership) => {
                    // Look up team membership from PROJECT_TEAM_MEMBERS collection
                    let team: { $id: string; name: string } = { $id: "", name: "No Team" };

                    // First check PROJECT_TEAM_MEMBERS_ID for actual team membership
                    const teamMemberships = await adminDb.listDocuments(
                        DATABASE_ID,
                        PROJECT_TEAM_MEMBERS_ID,
                        [
                            Query.equal("projectId", membership.projectId),
                            Query.equal("userId", membership.userId),
                            Query.limit(1),
                        ]
                    ).catch(() => ({ documents: [], total: 0 }));

                    if (teamMemberships.total > 0) {
                        // User is in a team - get team info
                        const teamMember = teamMemberships.documents[0];
                        const teamDoc = await adminDb.getDocument(
                            DATABASE_ID,
                            PROJECT_TEAMS_ID,
                            teamMember.teamId as string
                        ).catch(() => null);

                        if (teamDoc) {
                            team = { $id: teamDoc.$id, name: teamDoc.name as string };
                        }
                    } else if (membership.teamId && membership.teamId.trim() !== "") {
                        // Fallback: check legacy teamId field
                        const teamDoc = await adminDb.getDocument(
                            DATABASE_ID,
                            PROJECT_TEAMS_ID,
                            membership.teamId
                        ).catch(() => null);

                        if (teamDoc) {
                            team = { $id: teamDoc.$id, name: teamDoc.name as string };
                        }
                    }

                    // Get role
                    const role = await adminDb.getDocument<ProjectRole>(
                        DATABASE_ID,
                        PROJECT_ROLES_ID,
                        membership.roleId
                    ).catch(() => ({
                        $id: membership.roleId,
                        name: "Unknown",
                        permissions: [] as string[],
                        color: undefined,
                    }));

                    // Get user info from batch map
                    const userInfo = userMap.get(membership.userId);

                    return {
                        ...membership,
                        user: {
                            $id: membership.userId,
                            userId: membership.userId,
                            name: userInfo?.name || "Unknown",
                            email: userInfo?.email || "",
                            profileImageUrl: userInfo?.prefs?.profileImageUrl,
                        },
                        team: {
                            $id: team.$id,
                            name: team.name as string,
                        },
                        role: {
                            $id: role.$id,
                            name: role.name,
                            permissions: role.permissions || [],
                            color: role.color,
                        },
                    };
                })
            );

            return c.json({ data: populated });
        }
    )

    /**
     * GET /api/project-members
     * List all members in a project (optionally filter by team)
     */
    .get(
        "/",
        sessionMiddleware,
        zValidator("query", getProjectMembersSchema),
        async (c) => {
            const { users, databases: adminDb } = await createAdminClient();
            const user = c.get("user");
            const { projectId, teamId, workspaceId } = c.req.valid("query");

            // Check if user has permission to view members
            // Use Admin DB for permission check to avoid catch-22
            const hasPermission = await canProject(
                adminDb,
                user.$id,
                projectId,
                PROJECT_PERMISSIONS.PROJECT_VIEW,
                { workspaceId, allowWorkspaceAdminOverride: true }
            );

            if (!hasPermission) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            // Build query
            const queries = [Query.equal("projectId", projectId)];
            if (teamId) {
                queries.push(Query.equal("teamId", teamId));
            }

            const memberships = await adminDb.listDocuments<ProjectMember>(
                DATABASE_ID,
                PROJECT_MEMBERS_ID,
                queries
            );

            // Populate members
            // OPTIMIZED: Batch-fetch all users in one call (was N+1 users.get per member)
            const memberUserIds = memberships.documents.map(m => m.userId);
            const userMap = await batchGetUsers(users, memberUserIds);

            const populated: PopulatedProjectMember[] = await Promise.all(
                memberships.documents.map(async (membership) => {
                    // Look up team membership from PROJECT_TEAM_MEMBERS collection
                    // This is the source of truth for team assignments
                    let team: { $id: string; name: string } = { $id: "", name: "No Team" };

                    // First check PROJECT_TEAM_MEMBERS_ID for actual team membership
                    const teamMemberships = await adminDb.listDocuments(
                        DATABASE_ID,
                        PROJECT_TEAM_MEMBERS_ID,
                        [
                            Query.equal("projectId", membership.projectId),
                            Query.equal("userId", membership.userId),
                            Query.limit(1),
                        ]
                    ).catch(() => ({ documents: [], total: 0 }));

                    if (teamMemberships.total > 0) {
                        // User is in a team - get team info
                        const teamMember = teamMemberships.documents[0];
                        const teamDoc = await adminDb.getDocument(
                            DATABASE_ID,
                            PROJECT_TEAMS_ID,
                            teamMember.teamId as string
                        ).catch(() => null);

                        if (teamDoc) {
                            team = { $id: teamDoc.$id, name: teamDoc.name as string };
                        }
                    } else if (membership.teamId && membership.teamId.trim() !== "") {
                        // Fallback: check legacy teamId field on membership record
                        const teamDoc = await adminDb.getDocument(
                            DATABASE_ID,
                            PROJECT_TEAMS_ID,
                            membership.teamId
                        ).catch(() => null);

                        if (teamDoc) {
                            team = { $id: teamDoc.$id, name: teamDoc.name as string };
                        }
                    }

                    const role = await adminDb.getDocument<ProjectRole>(
                        DATABASE_ID,
                        PROJECT_ROLES_ID,
                        membership.roleId
                    ).catch(() => ({
                        $id: membership.roleId,
                        name: "Unknown",
                        permissions: [] as string[],
                        color: undefined,
                    }));

                    const userInfo = userMap.get(membership.userId);

                    return {
                        ...membership,
                        user: {
                            $id: membership.userId,
                            userId: membership.userId,
                            name: userInfo?.name || "Unknown",
                            email: userInfo?.email || "",
                            profileImageUrl: userInfo?.prefs?.profileImageUrl,
                        },
                        team: {
                            $id: team.$id,
                            name: team.name as string,
                        },
                        role: {
                            $id: role.$id,
                            name: role.name,
                            permissions: role.permissions || [],
                            color: role.color,
                        },
                    };
                })
            );

            return c.json({ data: { documents: populated, total: memberships.total } });
        }
    )

    /**
     * POST /api/project-members
     * Add a member to a project team with a role
     */
    .post(
        "/",
        sessionMiddleware,
        zValidator("json", createProjectMemberSchema),
        async (c) => {
            // Remove databases from user client, we need adminDb
            const { databases: adminDb } = await createAdminClient();
            const user = c.get("user");
            const data = c.req.valid("json");

            // Check permission to invite members
            const hasPermission = await canProject(
                adminDb,
                user.$id,
                data.projectId,
                PROJECT_PERMISSIONS.MEMBER_INVITE,
                { workspaceId: data.workspaceId, allowWorkspaceAdminOverride: true }
            );

            if (!hasPermission) {
                return c.json({ error: "Unauthorized. You cannot invite members to this project." }, 403);
            }

            // Check if user is already a member of this project (and team if specified)
            const existingQueries = [
                Query.equal("userId", data.userId),
                Query.equal("projectId", data.projectId),
            ];
            // If teamId is provided, check for duplicate team membership
            // If no teamId, check for any existing membership in project
            if (data.teamId && data.teamId !== "__none__") {
                existingQueries.push(Query.equal("teamId", data.teamId));
            }

            const existing = await adminDb.listDocuments<ProjectMember>(
                DATABASE_ID,
                PROJECT_MEMBERS_ID,
                existingQueries
            );

            if (existing.total > 0) {
                // If teamId specified, they're already in the team
                // If no teamId, they're already a project member
                const errorMsg = data.teamId && data.teamId !== "__none__"
                    ? "User is already a member of this team"
                    : "User is already a project member";
                return c.json({ error: errorMsg }, 400);
            }

            // Verify role exists and belongs to this project
            const role = await adminDb.getDocument<ProjectRole>(
                DATABASE_ID,
                PROJECT_ROLES_ID,
                data.roleId
            ).catch(() => null);

            if (!role || role.projectId !== data.projectId) {
                return c.json({ error: "Invalid role for this project" }, 400);
            }

            // Create membership - only include fields that exist in the database schema
            const membership = await adminDb.createDocument<ProjectMember>(
                DATABASE_ID,
                PROJECT_MEMBERS_ID,
                ID.unique(),
                {
                    workspaceId: data.workspaceId,
                    projectId: data.projectId,
                    // Use empty string for "no team" assignment
                    teamId: data.teamId && data.teamId !== "__none__" ? data.teamId : "",
                    userId: data.userId,
                    roleId: data.roleId,
                    roleName: role.name,
                    status: ProjectMemberStatus.ACTIVE,
                    joinedAt: new Date().toISOString(),
                    addedBy: user.$id,
                }
            );

            // Notify of new project member (non-blocking)
            const userName = user.name || user.email || "Someone";
            try {
                // Get project and user info for notification
                const project = await adminDb.getDocument<Project>(DATABASE_ID, PROJECTS_ID, data.projectId);
                const addedUser = await (await createAdminClient()).users.get(data.userId);

                const event = createProjectMemberAddedEvent(
                    project,
                    user.$id,
                    userName,
                    data.userId,
                    addedUser.name || addedUser.email,
                    role.name
                );
                dispatchWorkitemEvent(event).catch(() => { });
            } catch (err) {
                console.error("[ProjectMembers] Notification failed:", err);
            }

            await invalidateCache(
                CK.projectMemberList(data.projectId),
                CK.authLifecycle(data.userId)
            );
            await invalidateCachePattern(CKPattern.projectPerms(data.projectId));
            await invalidateCachePattern(CKPattern.allUserPerms(data.userId));

            return c.json({ data: membership }, 201);
        }
    )

    /**
     * PATCH /api/project-members/:memberId
     * Update a member's role or team
     */
    .patch(
        "/:memberId",
        sessionMiddleware,
        zValidator("json", updateProjectMemberSchema),
        async (c) => {
            const { databases: adminDb } = await createAdminClient();
            const user = c.get("user");
            const { memberId } = c.req.param();
            const updates = c.req.valid("json");

            // Get the membership to update
            const membership = await adminDb.getDocument<ProjectMember>(
                DATABASE_ID,
                PROJECT_MEMBERS_ID,
                memberId
            );

            // Check permission
            const hasPermission = await canProject(
                adminDb,
                user.$id,
                membership.projectId,
                PROJECT_PERMISSIONS.MEMBER_INVITE, // Same permission for role changes
                { workspaceId: membership.workspaceId, allowWorkspaceAdminOverride: true }
            );

            if (!hasPermission) {
                return c.json({ error: "Unauthorized" }, 403);
            }

            // If changing role, verify it exists
            let roleName = membership.roleName;
            if (updates.roleId) {
                const role = await adminDb.getDocument<ProjectRole>(
                    DATABASE_ID,
                    PROJECT_ROLES_ID,
                    updates.roleId
                ).catch(() => null);

                if (!role || role.projectId !== membership.projectId) {
                    return c.json({ error: "Invalid role for this project" }, 400);
                }
                roleName = role.name;
            }

            const updated = await adminDb.updateDocument<ProjectMember>(
                DATABASE_ID,
                PROJECT_MEMBERS_ID,
                memberId,
                {
                    ...updates,
                    roleName,
                }
            );

            // Notify of member update? (Optional, skipping for now as it maps to the same MEMBER_ADDED usually)

            await invalidateCache(CK.projectMemberList(membership.projectId));
            await invalidateCachePattern(CKPattern.projectPerms(membership.projectId));
            await invalidateCachePattern(CKPattern.allUserPerms(membership.userId));

            return c.json({ data: updated });
        }
    )

    /**
     * DELETE /api/project-members/:memberId
     * Remove a member from a project team
     */
    .delete(
        "/:memberId",
        sessionMiddleware,
        async (c) => {
            const { databases: adminDb } = await createAdminClient();
            const user = c.get("user");
            const { memberId } = c.req.param();

            const membership = await adminDb.getDocument<ProjectMember>(
                DATABASE_ID,
                PROJECT_MEMBERS_ID,
                memberId
            );

            // Check permission
            const hasPermission = await canProject(
                adminDb,
                user.$id,
                membership.projectId,
                PROJECT_PERMISSIONS.MEMBER_REMOVE,
                { workspaceId: membership.workspaceId, allowWorkspaceAdminOverride: true }
            );

            if (!hasPermission) {
                return c.json({ error: "Unauthorized" }, 403);
            }

            // Also remove user from any project team they're in
            const teamMemberships = await adminDb.listDocuments(
                DATABASE_ID,
                PROJECT_TEAM_MEMBERS_ID,
                [
                    Query.equal("projectId", membership.projectId),
                    Query.equal("userId", membership.userId),
                ]
            );

            // Delete all team memberships for this user in this project
            await Promise.all(
                teamMemberships.documents.map((tm) =>
                    adminDb.deleteDocument(DATABASE_ID, PROJECT_TEAM_MEMBERS_ID, tm.$id)
                )
            );

            // Delete the project membership
            await adminDb.deleteDocument(DATABASE_ID, PROJECT_MEMBERS_ID, memberId);

            // Notify of member removal (non-blocking)
            const userName = user.name || user.email || "Someone";
            try {
                const project = await adminDb.getDocument<Project>(DATABASE_ID, PROJECTS_ID, membership.projectId);
                const removedUser = await (await createAdminClient()).users.get(membership.userId);

                const event = createProjectMemberRemovedEvent(
                    project,
                    user.$id,
                    userName,
                    membership.userId,
                    removedUser.name || removedUser.email
                );
                dispatchWorkitemEvent(event).catch(() => { });
            } catch (err) {
                console.error("[ProjectMembers] Remove notification failed:", err);
            }

            await invalidateCache(
                CK.projectMemberList(membership.projectId),
                CK.authLifecycle(membership.userId)
            );
            await invalidateCachePattern(CKPattern.projectPerms(membership.projectId));
            await invalidateCachePattern(CKPattern.allUserPerms(membership.userId));

            return c.json({ data: { $id: memberId, removedFromTeams: teamMemberships.total } });
        }
    )

    /**
     * GET /api/project-members/roles
     * List all roles for a project
     */
    .get(
        "/roles",
        sessionMiddleware,
        zValidator("query", getProjectRolesSchema),
        async (c) => {
            const { databases: adminDb } = await createAdminClient();
            const user = c.get("user");
            const { projectId, workspaceId } = c.req.valid("query");

            // Check basic project access
            const hasPermission = await canProject(
                adminDb,
                user.$id,
                projectId,
                PROJECT_PERMISSIONS.PROJECT_VIEW,
                { workspaceId, allowWorkspaceAdminOverride: true }
            );

            if (!hasPermission) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            const roles = await adminDb.listDocuments<ProjectRole>(
                DATABASE_ID,
                PROJECT_ROLES_ID,
                [Query.equal("projectId", projectId)]
            );

            return c.json({ data: roles });
        }
    )

    /**
     * POST /api/project-members/roles
     * Create a new role for a project
     */
    .post(
        "/roles",
        sessionMiddleware,
        zValidator("json", createProjectRoleSchema),
        async (c) => {
            const databases = c.get("databases");
            const user = c.get("user");
            const data = c.req.valid("json");

            // Check permission to create roles
            const hasPermission = await canProject(
                databases,
                user.$id,
                data.projectId,
                PROJECT_PERMISSIONS.ROLE_CREATE,
                { workspaceId: data.workspaceId, allowWorkspaceAdminOverride: true }
            );

            if (!hasPermission) {
                return c.json({ error: "Unauthorized. Cannot create roles in this project." }, 403);
            }

            // Check for duplicate name
            const existing = await databases.listDocuments<ProjectRole>(
                DATABASE_ID,
                PROJECT_ROLES_ID,
                [
                    Query.equal("projectId", data.projectId),
                    Query.equal("name", data.name),
                ]
            );

            if (existing.total > 0) {
                return c.json({ error: "A role with this name already exists" }, 400);
            }

            const role = await databases.createDocument<ProjectRole>(
                DATABASE_ID,
                PROJECT_ROLES_ID,
                ID.unique(),
                {
                    ...data,
                    createdBy: user.$id,
                }
            );

            return c.json({ data: role }, 201);
        }
    )

    /**
     * PATCH /api/project-members/roles/:roleId
     * Update a role's name or permissions
     */
    .patch(
        "/roles/:roleId",
        sessionMiddleware,
        zValidator("json", updateProjectRoleSchema),
        async (c) => {
            const { databases: adminDb } = await createAdminClient();
            const user = c.get("user");
            const { roleId } = c.req.param();
            const updates = c.req.valid("json");

            try {
                const role = await adminDb.getDocument<ProjectRole>(
                    DATABASE_ID,
                    PROJECT_ROLES_ID,
                    roleId
                );

                // Check permission using resolveUserProjectAccess for reliable permission checking
                const { resolveUserProjectAccess, hasProjectPermission, ProjectPermissionKey } = await import("@/lib/permissions/resolveUserProjectAccess");
                const access = await resolveUserProjectAccess(adminDb, user.$id, role.projectId);

                if (!access.hasAccess || !hasProjectPermission(access, ProjectPermissionKey.MANAGE_PERMISSIONS)) {
                    return c.json({ error: "Forbidden: No permission to manage role permissions" }, 403);
                }

                // Prevent editing default roles' core properties
                if (role.isDefault && updates.name) {
                    return c.json({ error: "Cannot rename default roles" }, 400);
                }

                const updated = await adminDb.updateDocument<ProjectRole>(
                    DATABASE_ID,
                    PROJECT_ROLES_ID,
                    roleId,
                    {
                        ...updates,
                        lastModifiedBy: user.$id,
                    }
                );

                return c.json({ data: updated });
            } catch (error) {
                console.error("Error updating role:", error);
                return c.json({ error: "Failed to update role" }, 500);
            }
        }
    )

    /**
     * DELETE /api/project-members/roles/:roleId
     * Delete a custom role
     */
    .delete(
        "/roles/:roleId",
        sessionMiddleware,
        async (c) => {
            const { databases: adminDb } = await createAdminClient();
            const user = c.get("user");
            const { roleId } = c.req.param();

            try {
                const role = await adminDb.getDocument<ProjectRole>(
                    DATABASE_ID,
                    PROJECT_ROLES_ID,
                    roleId
                );

                // Check permission using resolveUserProjectAccess
                const { resolveUserProjectAccess, hasProjectPermission, ProjectPermissionKey } = await import("@/lib/permissions/resolveUserProjectAccess");
                const access = await resolveUserProjectAccess(adminDb, user.$id, role.projectId);

                if (!access.hasAccess || !hasProjectPermission(access, ProjectPermissionKey.MANAGE_PERMISSIONS)) {
                    return c.json({ error: "Forbidden: No permission to delete roles" }, 403);
                }

                // Prevent deleting default roles
                if (role.isDefault) {
                    return c.json({ error: "Cannot delete default roles" }, 400);
                }

                // Check if any members are using this role
                const membersWithRole = await adminDb.listDocuments<ProjectMember>(
                    DATABASE_ID,
                    PROJECT_MEMBERS_ID,
                    [Query.equal("roleId", roleId)]
                );

                if (membersWithRole.total > 0) {
                    return c.json({
                        error: `Cannot delete role. ${membersWithRole.total} member(s) are using this role.`,
                    }, 400);
                }

                await adminDb.deleteDocument(DATABASE_ID, PROJECT_ROLES_ID, roleId);

                return c.json({ data: { $id: roleId } });
            } catch (error) {
                console.error("Error deleting role:", error);
                return c.json({ error: "Failed to delete role" }, 500);
            }
        }
    );

export default app;
