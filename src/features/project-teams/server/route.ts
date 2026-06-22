import { Hono } from "hono";
import { ID, Query } from "node-appwrite";
import { zValidator } from "@hono/zod-validator";

import { sessionMiddleware } from "@/lib/session-middleware";
import { createAdminClient } from "@/lib/appwrite";
import { batchGetUsers } from "@/lib/batch-users";
import {
    DATABASE_ID,
    PROJECTS_ID,
    PROJECT_TEAMS_ID,
    PROJECT_TEAM_MEMBERS_ID,
    PROJECT_MEMBERS_ID,
    PROJECT_PERMISSIONS_ID,
} from "@/config";
import {
    ProjectTeam,
    ProjectTeamMember,
    ProjectMember,
    ProjectMemberStatus,
    PopulatedProjectTeam,
    PopulatedProjectTeamMember,
} from "../types";
import {
    createProjectTeamSchema,
    updateProjectTeamSchema,
    updateProjectTeamPermissionsSchema,
    getProjectTeamsSchema,
    addProjectTeamMemberSchema,
} from "../schemas";
import {
    resolveUserProjectAccess,
    hasProjectPermission,
} from "@/lib/permissions/resolveUserProjectAccess";
import { ProjectPermissionKey } from "@/lib/permissions/types";

/**
 * Project Teams API
 * 
 * GOVERNANCE:
 * - Teams belong ONLY to a project
 * - Names are fully custom (user-defined)
 * - Access requires project membership
 * - Permissions checked via resolveUserProjectAccess()
 */
const app = new Hono()
    // =========================================================================
    // PROJECT TEAMS CRUD
    // =========================================================================

    /**
     * GET /api/project-teams?projectId=xxx
     * List all teams in a project
     */
    .get(
        "/",
        sessionMiddleware,
        zValidator("query", getProjectTeamsSchema),
        async (c) => {
            const { databases: adminDb } = await createAdminClient();
            const user = c.get("user");
            const { projectId } = c.req.valid("query");

            // Check project access
            // We can pass adminDb here, or any db client since resolveUserProjectAccess creates its own admin client
            const access = await resolveUserProjectAccess(adminDb, user.$id, projectId);
            if (!access.hasAccess) {
                return c.json({ error: "Unauthorized: Not a project member" }, 403);
            }

            // Get all teams in project
            const teams = await adminDb.listDocuments<ProjectTeam>(
                DATABASE_ID,
                PROJECT_TEAMS_ID,
                [
                    Query.equal("projectId", projectId),
                    Query.orderAsc("name"),
                ]
            );

            // Enrich with member counts
            const enrichedTeams: PopulatedProjectTeam[] = await Promise.all(
                teams.documents.map(async (team) => {
                    const members = await adminDb.listDocuments(
                        DATABASE_ID,
                        PROJECT_TEAM_MEMBERS_ID,
                        [Query.equal("teamId", team.$id)]
                    );
                    return {
                        ...team,
                        memberCount: members.total,
                    };
                })
            );

            return c.json({
                data: {
                    documents: enrichedTeams,
                    total: teams.total,
                },
            });
        }
    )

    /**
     * GET /api/project-teams/:teamId
     * Get a single team with members
     */
    .get("/:teamId", sessionMiddleware, async (c) => {
        const { users, databases: adminDb } = await createAdminClient();
        const user = c.get("user");
        const { teamId } = c.req.param();

        try {
            const team = await adminDb.getDocument<ProjectTeam>(
                DATABASE_ID,
                PROJECT_TEAMS_ID,
                teamId
            );

            // Check project access
            const access = await resolveUserProjectAccess(adminDb, user.$id, team.projectId);
            if (!access.hasAccess) {
                return c.json({ error: "Unauthorized: Not a project member" }, 403);
            }

            // Get team members
            const teamMembers = await adminDb.listDocuments<ProjectTeamMember>(
                DATABASE_ID,
                PROJECT_TEAM_MEMBERS_ID,
                [Query.equal("teamId", teamId)]
            );

            // OPTIMIZED: Batch-fetch all users in one call (was N+1 users.get per member)
            const teamMemberUserIds = teamMembers.documents.map(tm => tm.userId);
            const userMap = await batchGetUsers(users, teamMemberUserIds);

            // Populate member data
            const populatedMembers: PopulatedProjectTeamMember[] = teamMembers.documents.map((tm) => {
                const userInfo = userMap.get(tm.userId);
                return {
                    ...tm,
                    user: {
                        $id: tm.userId,
                        name: userInfo?.name || "Unknown",
                        email: userInfo?.email || "",
                        profileImageUrl: userInfo?.prefs?.profileImageUrl,
                    },
                    team: {
                        $id: team.$id,
                        name: team.name,
                        color: team.color,
                    },
                };
            });

            const result: PopulatedProjectTeam = {
                ...team,
                memberCount: teamMembers.total,
                members: populatedMembers,
            };

            return c.json({ data: result });
        } catch {
            return c.json({ error: "Team not found" }, 404);
        }
    })

    /**
     * POST /api/project-teams
     * Create a new team in a project
     */
    .post(
        "/",
        sessionMiddleware,
        zValidator("json", createProjectTeamSchema),
        async (c) => {
            try {
                const { databases: adminDb } = await createAdminClient();
                const user = c.get("user");
                const data = c.req.valid("json");

                // Check project access + permission
                const access = await resolveUserProjectAccess(adminDb, user.$id, data.projectId);
                if (!access.hasAccess) {
                    return c.json({ error: "Unauthorized: Not a project member" }, 403);
                }
                if (!hasProjectPermission(access, ProjectPermissionKey.MANAGE_TEAMS)) {
                    return c.json({ error: "Forbidden: Requires MANAGE_TEAMS permission" }, 403);
                }

                // Fetch project to get workspaceId (required by collection schema)
                const project = await adminDb.getDocument(DATABASE_ID, PROJECTS_ID, data.projectId);

                // Check for duplicate team name
                const existing = await adminDb.listDocuments(
                    DATABASE_ID,
                    PROJECT_TEAMS_ID,
                    [
                        Query.equal("projectId", data.projectId),
                        Query.equal("name", data.name),
                    ]
                );

                if (existing.total > 0) {
                    return c.json({ error: "Team name already exists in this project" }, 409);
                }

                // Create team
                const team = await adminDb.createDocument<ProjectTeam>(
                    DATABASE_ID,
                    PROJECT_TEAMS_ID,
                    ID.unique(),
                    {
                        projectId: data.projectId,
                        workspaceId: data.workspaceId || project.workspaceId,
                        name: data.name,
                        description: data.description || null,
                        color: data.color || "#4F46E5",
                        createdBy: user.$id,
                    }
                );

                return c.json({ data: team }, 201);
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to create team";
                return c.json({ error: message }, 500);
            }
        }
    )

    /**
     * PATCH /api/project-teams/:teamId
     * Update a team
     */
    .patch(
        "/:teamId",
        sessionMiddleware,
        zValidator("json", updateProjectTeamSchema),
        async (c) => {
            const { databases: adminDb } = await createAdminClient();
            const user = c.get("user");
            const { teamId } = c.req.param();
            const updates = c.req.valid("json");

            try {
                const team = await adminDb.getDocument<ProjectTeam>(
                    DATABASE_ID,
                    PROJECT_TEAMS_ID,
                    teamId
                );

                // Check permissions
                const access = await resolveUserProjectAccess(adminDb, user.$id, team.projectId);
                if (!hasProjectPermission(access, ProjectPermissionKey.MANAGE_TEAMS)) {
                    return c.json({ error: "Forbidden: Requires MANAGE_TEAMS permission" }, 403);
                }

                // Check for duplicate name if changing
                if (updates.name && updates.name !== team.name) {
                    const existing = await adminDb.listDocuments(
                        DATABASE_ID,
                        PROJECT_TEAMS_ID,
                        [
                            Query.equal("projectId", team.projectId),
                            Query.equal("name", updates.name),
                        ]
                    );
                    if (existing.total > 0) {
                        return c.json({ error: "Team name already exists" }, 409);
                    }
                }

                const updated = await adminDb.updateDocument<ProjectTeam>(
                    DATABASE_ID,
                    PROJECT_TEAMS_ID,
                    teamId,
                    {
                        ...(updates.name && { name: updates.name }),
                        ...(updates.description !== undefined && { description: updates.description }),
                        ...(updates.color && { color: updates.color }),
                    }
                );

                return c.json({ data: updated });
            } catch {
                return c.json({ error: "Team not found" }, 404);
            }
        }
    )

    /**
     * DELETE /api/project-teams/:teamId
     * Delete a team
     */
    .delete("/:teamId", sessionMiddleware, async (c) => {
        const { databases: adminDb } = await createAdminClient();
        const user = c.get("user");
        const { teamId } = c.req.param();

        try {
            const team = await adminDb.getDocument<ProjectTeam>(
                DATABASE_ID,
                PROJECT_TEAMS_ID,
                teamId
            );

            // Check permissions
            const access = await resolveUserProjectAccess(adminDb, user.$id, team.projectId);
            if (!hasProjectPermission(access, ProjectPermissionKey.MANAGE_TEAMS)) {
                return c.json({ error: "Forbidden: Requires MANAGE_TEAMS permission" }, 403);
            }

            // Delete team members first
            const members = await adminDb.listDocuments<ProjectTeamMember>(
                DATABASE_ID,
                PROJECT_TEAM_MEMBERS_ID,
                [Query.equal("teamId", teamId)]
            );

            await Promise.all(
                members.documents.map((m) =>
                    adminDb.deleteDocument(DATABASE_ID, PROJECT_TEAM_MEMBERS_ID, m.$id)
                )
            );

            // Delete team permissions
            const permissions = await adminDb.listDocuments(
                DATABASE_ID,
                PROJECT_PERMISSIONS_ID,
                [Query.equal("assignedToTeamId", teamId)]
            );

            await Promise.all(
                permissions.documents.map((p) =>
                    adminDb.deleteDocument(DATABASE_ID, PROJECT_PERMISSIONS_ID, p.$id)
                )
            );

            // Delete team
            await adminDb.deleteDocument(DATABASE_ID, PROJECT_TEAMS_ID, teamId);

            return c.json({ success: true });
        } catch {
            return c.json({ error: "Team not found" }, 404);
        }
    })

    // =========================================================================
    // TEAM MEMBERS
    // =========================================================================

    /**
     * GET /api/project-teams/:teamId/members
     * List all members in a team
     */
    .get(
        "/:teamId/members",
        sessionMiddleware,
        async (c) => {
            const { users, databases: adminDb } = await createAdminClient();
            const user = c.get("user");
            const { teamId } = c.req.param();

            try {
                const team = await adminDb.getDocument<ProjectTeam>(
                    DATABASE_ID,
                    PROJECT_TEAMS_ID,
                    teamId
                );

                // Check access
                const access = await resolveUserProjectAccess(adminDb, user.$id, team.projectId);
                if (!access.hasAccess) {
                    return c.json({ error: "Unauthorized" }, 403);
                }

                const teamMembers = await adminDb.listDocuments<ProjectTeamMember>(
                    DATABASE_ID,
                    PROJECT_TEAM_MEMBERS_ID,
                    [Query.equal("teamId", teamId)]
                );

                // OPTIMIZED: Batch-fetch all users in one call (was N+1 users.get per member)
                const teamMemberUserIds = teamMembers.documents.map(tm => tm.userId);
                const userMap = await batchGetUsers(users, teamMemberUserIds);

                // Populate
                const populated: PopulatedProjectTeamMember[] = teamMembers.documents.map((tm) => {
                    const userInfo = userMap.get(tm.userId);
                    return {
                        ...tm,
                        user: {
                            $id: tm.userId,
                            name: userInfo?.name || "Unknown",
                            email: userInfo?.email || "",
                            profileImageUrl: userInfo?.prefs?.profileImageUrl,
                        },
                        team: {
                            $id: team.$id,
                            name: team.name,
                            color: team.color,
                        },
                    };
                });

                return c.json({ data: { documents: populated, total: teamMembers.total } });
            } catch {
                return c.json({ error: "Team not found" }, 404);
            }
        }
    )

    /**
     * POST /api/project-teams/:teamId/members
     * Add a member to a team
     */
    .post(
        "/:teamId/members",
        sessionMiddleware,
        zValidator("json", addProjectTeamMemberSchema),
        async (c) => {
            const { databases: adminDb } = await createAdminClient();
            const user = c.get("user");
            const { teamId } = c.req.param();
            const data = c.req.valid("json");

            try {
                const team = await adminDb.getDocument<ProjectTeam>(
                    DATABASE_ID,
                    PROJECT_TEAMS_ID,
                    teamId
                );

                // Check permissions
                const access = await resolveUserProjectAccess(adminDb, user.$id, team.projectId);
                if (!hasProjectPermission(access, ProjectPermissionKey.MANAGE_TEAMS)) {
                    return c.json({ error: "Forbidden: Requires MANAGE_TEAMS permission" }, 403);
                }

                // Verify user is a project member
                // First try with ACTIVE status
                let projectMemberships = await adminDb.listDocuments<ProjectMember>(
                    DATABASE_ID,
                    PROJECT_MEMBERS_ID,
                    [
                        Query.equal("projectId", team.projectId),
                        Query.equal("userId", data.userId),
                        Query.equal("status", ProjectMemberStatus.ACTIVE),
                    ]
                );

                // Fallback: check without status filter for backward compatibility
                if (projectMemberships.total === 0) {
                    projectMemberships = await adminDb.listDocuments<ProjectMember>(
                        DATABASE_ID,
                        PROJECT_MEMBERS_ID,
                        [
                            Query.equal("projectId", team.projectId),
                            Query.equal("userId", data.userId),
                        ]
                    );
                    // Filter out explicitly REMOVED members
                    if (projectMemberships.total > 0 &&
                        projectMemberships.documents[0].status === ProjectMemberStatus.REMOVED) {
                        projectMemberships = { documents: [], total: 0 } as typeof projectMemberships;
                    }
                }

                if (projectMemberships.total === 0) {
                    return c.json({ error: "User is not a project member" }, 400);
                }

                // Check if already in team
                const existing = await adminDb.listDocuments(
                    DATABASE_ID,
                    PROJECT_TEAM_MEMBERS_ID,
                    [
                        Query.equal("teamId", teamId),
                        Query.equal("userId", data.userId),
                    ]
                );

                if (existing.total > 0) {
                    return c.json({ error: "User is already in this team" }, 409);
                }

                // Add to team
                const member = await adminDb.createDocument<ProjectTeamMember>(
                    DATABASE_ID,
                    PROJECT_TEAM_MEMBERS_ID,
                    ID.unique(),
                    {
                        projectId: team.projectId,
                        teamId,
                        userId: data.userId,
                        teamRole: data.teamRole || null,
                        joinedAt: new Date().toISOString(),
                        addedBy: user.$id,
                    }
                );

                return c.json({ data: member }, 201);
            } catch {
                return c.json({ error: "Team not found" }, 404);
            }
        }
    )

    /**
     * DELETE /api/project-teams/:teamId/members/:userId
     * Remove a member from a team
     */
    .delete("/:teamId/members/:userId", sessionMiddleware, async (c) => {
        const { databases: adminDb } = await createAdminClient();
        const user = c.get("user");
        const { teamId, userId: targetUserId } = c.req.param();

        try {
            const team = await adminDb.getDocument<ProjectTeam>(
                DATABASE_ID,
                PROJECT_TEAMS_ID,
                teamId
            );

            // Check permissions
            const access = await resolveUserProjectAccess(adminDb, user.$id, team.projectId);
            if (!hasProjectPermission(access, ProjectPermissionKey.MANAGE_TEAMS)) {
                return c.json({ error: "Forbidden: Requires MANAGE_TEAMS permission" }, 403);
            }

            // Find membership
            const memberships = await adminDb.listDocuments<ProjectTeamMember>(
                DATABASE_ID,
                PROJECT_TEAM_MEMBERS_ID,
                [
                    Query.equal("teamId", teamId),
                    Query.equal("userId", targetUserId),
                ]
            );

            if (memberships.total === 0) {
                return c.json({ error: "User is not in this team" }, 404);
            }

            await adminDb.deleteDocument(
                DATABASE_ID,
                PROJECT_TEAM_MEMBERS_ID,
                memberships.documents[0].$id
            );

            return c.json({ success: true });
        } catch {
            return c.json({ error: "Team not found" }, 404);
        }
    })

    /**
     * GET /api/project-teams/:teamId/permissions
     * Get permissions assigned to a team
     */
    .get("/:teamId/permissions", sessionMiddleware, async (c) => {
        const { databases: adminDb } = await createAdminClient();
        const user = c.get("user");
        const { teamId } = c.req.param();

        try {
            const team = await adminDb.getDocument<ProjectTeam>(
                DATABASE_ID,
                PROJECT_TEAMS_ID,
                teamId
            );

            // Check access
            const access = await resolveUserProjectAccess(adminDb, user.$id, team.projectId);
            if (!access.hasAccess) {
                return c.json({ error: "Unauthorized" }, 403);
            }

            const permissions = await adminDb.listDocuments(
                DATABASE_ID,
                PROJECT_PERMISSIONS_ID,
                [Query.equal("assignedToTeamId", teamId)]
            );

            return c.json({
                data: permissions.documents.map((p) => p.permissionKey)
            });
        } catch {
            return c.json({ error: "Team not found" }, 404);
        }
    })

    /**
     * PUT /api/project-teams/:teamId/permissions
     * Update permissions for a team (Replace all)
     */
    .put(
        "/:teamId/permissions",
        sessionMiddleware,
        zValidator("json", updateProjectTeamPermissionsSchema),
        async (c) => {
            const { databases: adminDb } = await createAdminClient();
            const user = c.get("user");
            const { teamId } = c.req.param();
            const { permissions: newPermissions } = c.req.valid("json");

            try {
                const team = await adminDb.getDocument<ProjectTeam>(
                    DATABASE_ID,
                    PROJECT_TEAMS_ID,
                    teamId
                );

                // Check permissions (Needs MANAGE_PERMISSIONS or MANAGE_TEAMS)
                const access = await resolveUserProjectAccess(adminDb, user.$id, team.projectId);
                if (
                    !hasProjectPermission(access, ProjectPermissionKey.MANAGE_PERMISSIONS) &&
                    !hasProjectPermission(access, ProjectPermissionKey.MANAGE_TEAMS)
                ) {
                    return c.json({ error: "Forbidden: Requires MANAGE_PERMISSIONS or MANAGE_TEAMS" }, 403);
                }

                // 1. Delete existing permissions for this team
                const existing = await adminDb.listDocuments(
                    DATABASE_ID,
                    PROJECT_PERMISSIONS_ID,
                    [Query.equal("assignedToTeamId", teamId)]
                );

                await Promise.all(
                    existing.documents.map((p) =>
                        adminDb.deleteDocument(DATABASE_ID, PROJECT_PERMISSIONS_ID, p.$id)
                    )
                );

                // 2. Create new permissions
                const created = await Promise.all(
                    newPermissions.map((key) =>
                        adminDb.createDocument(
                            DATABASE_ID,
                            PROJECT_PERMISSIONS_ID,
                            ID.unique(),
                            {
                                projectId: team.projectId,
                                permissionKey: key,
                                assignedToTeamId: teamId,
                                assignedToUserId: null,
                                grantedBy: user.$id,
                                grantedAt: new Date().toISOString(),
                            }
                        )
                    )
                );

                return c.json({ data: created.map(p => p.permissionKey) });
            } catch {
                return c.json({ error: "Failed to update permissions" }, 500);
            }
        }
    );

export default app;
