import { Databases, Query } from "node-appwrite";
import { DATABASE_ID, PROJECT_MEMBERS_ID, PROJECT_ROLES_ID, MEMBERS_ID, PROJECT_TEAM_MEMBERS_ID, PROJECT_PERMISSIONS_ID } from "@/config";
import { ProjectMember, ProjectRole, ProjectPermissionResult } from "@/features/project-members/types";
import { PROJECT_PERMISSIONS, DEFAULT_PROJECT_ROLES } from "./project-permissions";
import { MemberRole } from "@/features/members/types";
import { ROLE_PERMISSIONS } from "@/lib/permissions/resolveUserProjectAccess";

/**
 * @deprecated This module is deprecated.
 * Use `@/lib/permissions/resolveUserProjectAccess` instead.
 * 
 * Migration Guide:
 * - `getProjectPermissions()` → `resolveUserProjectAccess()` → `.permissions`
 * - `canProject()` → `hasProjectPermission()`
 * - `isProjectMember()` → `resolveUserProjectAccess()` → `.hasAccess`
 * - Route handlers → Use `requireProjectAuth()` from `@/lib/middleware/project-auth`
 * 
 * This module will be removed in a future release.
 */

/**
 * Central Permission Resolver for Project-Scoped RBAC
 * 
 * @deprecated Use resolveUserProjectAccess from @/lib/permissions/resolveUserProjectAccess
 * 
 * Resolution Logic:
 * 1. Fetch ALL project_members for (userId + projectId)
 * 2. For each membership, resolve roleId → permissions[]
 * 3. Merge permissions (union) if user is in multiple teams
 * 4. Return TRUE if ANY role grants the permission
 * 5. NO workspace fallback (except for workspace admins if enabled)
 * 
 * Backend is the source of truth.
 */

/**
 * Retrieves the merged permissions for a user in a specific project.
 * 
 * @param databases - Appwrite Databases instance
 * @param userId - The user's Appwrite auth ID
 * @param projectId - The project ID to check permissions for
 * @param options - Optional settings (e.g., workspace admin bypass)
 * @returns Array of permission strings the user has in this project
 */
export async function getProjectPermissions(
    databases: Databases,
    userId: string,
    projectId: string,
    options?: {
        workspaceId?: string;
        allowWorkspaceAdminOverride?: boolean;
    }
): Promise<string[]> {
    try {
        // If workspace admin override is enabled, check if user is workspace admin
        if (options?.workspaceId && options?.allowWorkspaceAdminOverride) {
            const isWorkspaceAdmin = await checkWorkspaceAdmin(
                databases,
                options.workspaceId,
                userId
            );
            if (isWorkspaceAdmin) {
                // Workspace admins get all permissions (super-admin bypass)
                return Object.values(PROJECT_PERMISSIONS);
            }
        }

        // Fetch all project memberships for this user in this project
        // Fetch all project memberships for this user in this project
        let memberships;
        try {
            memberships = await databases.listDocuments<ProjectMember>(
                DATABASE_ID,
                PROJECT_MEMBERS_ID,
                [
                    Query.equal("userId", userId),
                    Query.equal("projectId", projectId),
                ]
            );
        } catch {
            // If user is not authorized to list members (e.g. not a member), return empty
            // This handles the "401 The current user is not authorized" error
            // console.warn("[Project-RBAC] User not authorized to list memberships (likely not a member):", error);
            return [];
        }

        if (memberships.total === 0) {
            return [];
        }

        // Collect all role IDs
        const roleIds = [...new Set(memberships.documents.map((m) => m.roleId))];

        // Fetch all roles
        const roles = await databases.listDocuments<ProjectRole>(
            DATABASE_ID,
            PROJECT_ROLES_ID,
            [Query.equal("$id", roleIds)]
        );

        // Merge all permissions from all roles (union)
        const allPermissions = new Set<string>();
        for (const role of roles.documents) {
            for (const permission of role.permissions || []) {
                allPermissions.add(permission);
            }
        }

        return Array.from(allPermissions);
    } catch {
        return [];
    }
}

/**
 * Checks if a user has a specific permission in a project.
 * 
 * @param databases - Appwrite Databases instance
 * @param userId - The user's Appwrite auth ID
 * @param projectId - The project ID to check
 * @param permission - The permission string to check
 * @param options - Optional settings
 * @returns True if user has the permission, false otherwise
 */
export async function canProject(
    databases: Databases,
    userId: string,
    projectId: string,
    permission: string,
    options?: {
        workspaceId?: string;
        allowWorkspaceAdminOverride?: boolean;
    }
): Promise<boolean> {
    const permissions = await getProjectPermissions(databases, userId, projectId, options);
    return permissions.includes(permission);
}

/**
 * Gets detailed permission result including role information.
 * Useful for frontend hooks that need role context.
 */
export async function getProjectPermissionResult(
    databases: Databases,
    userId: string,
    projectId: string
): Promise<ProjectPermissionResult> {
    try {
        // --- Workspace Admin / Org Admin Override ---
        // Check if user is a workspace admin or org admin and grant full permissions
        try {
            const { PROJECTS_ID, WORKSPACES_ID, ORGANIZATION_MEMBERS_ID } = await import("@/config");
            const project = await databases.getDocument(DATABASE_ID, PROJECTS_ID, projectId);
            const workspaceId = project.workspaceId;

            // Check workspace admin
            const isWsAdmin = await checkWorkspaceAdmin(databases, workspaceId, userId);
            if (isWsAdmin) {
                return {
                    projectId,
                    userId,
                    permissions: Object.values(PROJECT_PERMISSIONS),
                    roles: [{ roleId: "ws-admin", roleName: "Workspace Admin", teamId: "", teamName: "" }],
                    isProjectAdmin: true,
                };
            }

            // Check org admin
            let organizationId: string | null = null;
            try {
                const workspace = await databases.getDocument(DATABASE_ID, WORKSPACES_ID, workspaceId);
                organizationId = workspace.organizationId || null;
            } catch { /* ignore */ }

            if (organizationId) {
                try {
                    const orgMembers = await databases.listDocuments(
                        DATABASE_ID,
                        ORGANIZATION_MEMBERS_ID,
                        [
                            Query.equal("organizationId", organizationId),
                            Query.equal("userId", userId),
                            Query.equal("status", "ACTIVE"),
                        ]
                    );
                    if (orgMembers.total > 0) {
                        const orgRole = orgMembers.documents[0].role;
                        // Only OWNER bypasses project membership (department-driven model)
                        if (orgRole === "OWNER") {
                            return {
                                projectId,
                                userId,
                                permissions: Object.values(PROJECT_PERMISSIONS),
                                roles: [{ roleId: "org-owner", roleName: "Org OWNER", teamId: "", teamName: "" }],
                                isProjectAdmin: true,
                            };
                        }
                    }
                } catch { /* ignore */ }
            }
        } catch { /* project fetch failed, continue with member-based resolution */ }

        // --- Standard member-based resolution ---
        // Fetch all project memberships
        let memberships;
        try {
            memberships = await databases.listDocuments<ProjectMember>(
                DATABASE_ID,
                PROJECT_MEMBERS_ID,
                [
                    Query.equal("userId", userId),
                    Query.equal("projectId", projectId),
                ]
            );
        } catch {
            // If unauthorized (401), treat as no membership
            return {
                projectId,
                userId,
                permissions: [],
                roles: [],
                isProjectAdmin: false,
            };
        }

        if (memberships.total === 0) {
            return {
                projectId,
                userId,
                permissions: [],
                roles: [],
                isProjectAdmin: false,
            };
        }

        // Collect role IDs (filter out empty/undefined)
        const roleIds = [...new Set(memberships.documents.map((m) => m.roleId).filter(Boolean))];

        // Fetch roles (only if there are valid roleIds)
        let roles: { documents: ProjectRole[] } = { documents: [] };
        if (roleIds.length > 0) {
            try {
                roles = await databases.listDocuments<ProjectRole>(
                    DATABASE_ID,
                    PROJECT_ROLES_ID,
                    [Query.equal("$id", roleIds)]
                );
            } catch {
                // Role fetch failed - continue with fallback
            }
        }

        // Build role-to-team mapping and collect role permissions
        const roleInfos: ProjectPermissionResult["roles"] = [];
        const allPermissions = new Set<string>();

        for (const membership of memberships.documents) {
            const role = roles.documents.find((r) => r.$id === membership.roleId);
            if (role) {
                roleInfos.push({
                    roleId: role.$id,
                    roleName: role.name,
                    teamId: membership.teamId,
                    teamName: membership.teamId, // Will be populated by caller if needed
                });
                for (const permission of role.permissions || []) {
                    allPermissions.add(permission);
                }
            }

            // Fallback: Also check the `role` field (PROJECT_OWNER, PROJECT_ADMIN, MEMBER, VIEWER)
            // This handles cases where members have a direct role but no roleId
            const memberRole = (membership as unknown as { role?: string }).role;
            if (memberRole) {
                const rolePerms = ROLE_PERMISSIONS[memberRole as keyof typeof ROLE_PERMISSIONS];
                if (rolePerms) {
                    for (const perm of rolePerms) {
                        allPermissions.add(perm);
                    }
                }
            }
        }

        // ============================================================
        // IMPORTANT: Also fetch TEAM-LEVEL permissions from PROJECT_PERMISSIONS_ID
        // This is where "Run by Team" permissions are stored
        // ============================================================
        
        // 1. Get user's team memberships from PROJECT_TEAM_MEMBERS
        const teamMemberships = await databases.listDocuments(
            DATABASE_ID,
            PROJECT_TEAM_MEMBERS_ID,
            [
                Query.equal("projectId", projectId),
                Query.equal("userId", userId),
            ]
        ).catch(() => ({ documents: [], total: 0 }));
        
        const teamIds = teamMemberships.documents.map((tm) => tm.teamId as string);
        
        // 2. Fetch permissions assigned to those teams
        if (teamIds.length > 0) {
            const teamPermissions = await databases.listDocuments(
                DATABASE_ID,
                PROJECT_PERMISSIONS_ID,
                [
                    Query.equal("projectId", projectId),
                    Query.contains("assignedToTeamId", teamIds),
                ]
            ).catch(() => ({ documents: [], total: 0 }));
            
            // Add team permissions to the set
            for (const perm of teamPermissions.documents) {
                if (perm.permissionKey) {
                    allPermissions.add(perm.permissionKey as string);
                }
            }
        }
        
        // 3. Also fetch direct user permissions (assigned to user, not team)
        const directPermissions = await databases.listDocuments(
            DATABASE_ID,
            PROJECT_PERMISSIONS_ID,
            [
                Query.equal("projectId", projectId),
                Query.equal("assignedToUserId", userId),
            ]
        ).catch(() => ({ documents: [], total: 0 }));
        
        for (const perm of directPermissions.documents) {
            if (perm.permissionKey) {
                allPermissions.add(perm.permissionKey as string);
            }
        }

        // Check if user is a project admin (has all permissions from default Project Admin role)
        // Also check role field, roleName field, and role document name for OWNER/ADMIN
        const projectAdminPermissions = DEFAULT_PROJECT_ROLES.PROJECT_ADMIN.permissions;
        const hasAdminPerms = projectAdminPermissions.every((p) => allPermissions.has(p));
        const hasOwnerOrAdminRole = memberships.documents.some((m) => {
            const mRole = (m as unknown as { role?: string }).role;
            const mRoleName = (m as unknown as { roleName?: string }).roleName;
            return mRole === "PROJECT_OWNER" || mRole === "PROJECT_ADMIN" ||
                   mRoleName === "OWNER" || mRoleName === "ADMIN";
        });
        // Also check from role documents
        const hasOwnerOrAdminRoleDoc = roleInfos.some(
            (r) => r.roleName === "OWNER" || r.roleName === "ADMIN"
        );
        const isProjectAdmin = hasAdminPerms || hasOwnerOrAdminRole || hasOwnerOrAdminRoleDoc;

        return {
            projectId,
            userId,
            permissions: Array.from(allPermissions),
            roles: roleInfos,
            isProjectAdmin,
        };
    } catch {
        return {
            projectId,
            userId,
            permissions: [],
            roles: [],
            isProjectAdmin: false,
        };
    }
}

/**
 * Helper to check if a user is a workspace admin.
 * Used for workspace admin override feature.
 */
async function checkWorkspaceAdmin(
    databases: Databases,
    workspaceId: string,
    userId: string
): Promise<boolean> {
    try {
        const members = await databases.listDocuments(DATABASE_ID, MEMBERS_ID, [
            Query.equal("workspaceId", workspaceId),
            Query.equal("userId", userId),
        ]);

        if (members.total === 0) return false;

        const member = members.documents[0];
        return member.role === MemberRole.ADMIN || member.role === "OWNER";
    } catch {
        return false;
    }
}

/**
 * Checks if a user has any access to a project (is member of any team).
 */
export async function isProjectMember(
    databases: Databases,
    userId: string,
    projectId: string
): Promise<boolean> {
    try {
        const memberships = await databases.listDocuments<ProjectMember>(
            DATABASE_ID,
            PROJECT_MEMBERS_ID,
            [
                Query.equal("userId", userId),
                Query.equal("projectId", projectId),
                Query.limit(1),
            ]
        );

        return memberships.total > 0;
    } catch {
        return false;
    }
}

/**
 * Gets all project IDs a user has access to.
 * Useful for filtering project lists.
 */
export async function getUserProjectIds(
    databases: Databases,
    userId: string,
    workspaceId?: string
): Promise<string[]> {
    try {
        const queries = [Query.equal("userId", userId)];
        if (workspaceId) {
            queries.push(Query.equal("workspaceId", workspaceId));
        }

        const memberships = await databases.listDocuments<ProjectMember>(
            DATABASE_ID,
            PROJECT_MEMBERS_ID,
            queries
        );

        // Return unique project IDs
        return [...new Set(memberships.documents.map((m) => m.projectId))];
    } catch {
        return [];
    }
}
