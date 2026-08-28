import "server-only";

import { Databases } from "node-appwrite";
import { OrgPermissionKey } from "@/features/org-permissions/types";
import { OrganizationRole } from "@/features/organizations/types";
import { AppRouteKey } from "./appRouteKeys";
import { getPathsForRouteKeys } from "./permissionRouteMap";
import { resolveUserOrgAccess, UserOrgAccessResult } from "./resolveUserOrgAccess";
import { resolveUserWorkspaceAccess } from "./resolveUserWorkspaceAccess";

/**
 * Resolve User Access (Refactored for Department-Driven Model)
 * 
 * Server-side permission resolver that computes the complete access
 * object for a user in an organization.
 * 
 * ARCHITECTURE:
 * - Delegates org-level permissions to resolveUserOrgAccess (department-based)
 * - Adds always-accessible routes (profile, welcome)
 * - Adds workspace routes when workspace context exists
 * 
 * GOVERNANCE CONTRACT:
 * DEPARTMENT → PERMISSIONS → ROUTES → NAVIGATION
 * 
 * RULES:
 * 1. OWNER always gets ALL routes (bypass all checks)
 * 2. Permissions come ONLY from departments (not roles)
 * 3. No department = ZERO org permissions
 * 4. Workspace and project RBAC remain unchanged
 * 
 * This function maintains backward compatibility with existing consumers.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface UserAccess {
    /** Route keys the user can access */
    allowedRouteKeys: AppRouteKey[];
    /** Concrete paths the user can access (resolved from route keys) */
    allowedPaths: string[];
    /** Whether user is org OWNER (super-role) */
    isOwner: boolean;
    /** User's org role */
    role: OrganizationRole | null;
    /** All permissions user has (from departments) */
    permissions: OrgPermissionKey[];
    /** User's org member ID */
    orgMemberId: string | null;
    /** Organization ID */
    organizationId: string | null;
    /** IDs of departments the user belongs to */
    departmentIds: string[];
    /** Whether user has department-based org access */
    hasDepartmentAccess: boolean;
}

// ============================================================================
// BASE ROUTE KEYS (always accessible)
// ============================================================================

/**
 * Route keys that are always accessible to authenticated users
 * regardless of org permissions
 */
const ALWAYS_ACCESSIBLE_ROUTES: AppRouteKey[] = [
    AppRouteKey.PROFILE,
    AppRouteKey.PROFILE_ACCOUNT,
    AppRouteKey.PROFILE_PASSWORD,
    AppRouteKey.WELCOME,
];

/**
 * Route keys accessible to any org member (including members with no departments).
 * Organization admin pages stay gated by department permissions separately.
 */
const ORG_MEMBER_BASE_ROUTES: AppRouteKey[] = [
    AppRouteKey.WORKSPACES,
];

/**
 * Core workspace pages visible to all org/workspace members.
 * Settings is admin-only and is not included here.
 */
const WORKSPACE_CORE_ROUTES: AppRouteKey[] = [
    AppRouteKey.WORKSPACE_HOME,
    AppRouteKey.WORKSPACE_TASKS,
    AppRouteKey.WORKSPACE_TEAMS,
    AppRouteKey.WORKSPACE_PROGRAMS,
    AppRouteKey.WORKSPACE_TIMELINE,
    AppRouteKey.WORKSPACE_SPACES,
    AppRouteKey.WORKSPACE_PROJECTS,
];

/**
 * Workspace admin routes (Settings). Visible to org OWNER or workspace OWNER/ADMIN.
 */
const WORKSPACE_ADMIN_ROUTES: AppRouteKey[] = [
    AppRouteKey.WORKSPACE_SETTINGS,
];

// ============================================================================
// MAIN RESOLVER
// ============================================================================

/**
 * Resolve user's complete access for an organization
 * 
 * @param databases - Appwrite databases instance
 * @param userId - User ID
 * @param organizationId - Organization ID (optional - if not provided, returns minimal access)
 * @param workspaceId - Active workspace ID (optional - used to resolve workspace routes)
 * @returns Complete UserAccess object
 */
export async function resolveUserAccess(
    databases: Databases,
    userId: string,
    organizationId?: string,
    workspaceId?: string
): Promise<UserAccess> {
    // Default access (no org context)
    const baseAccess: UserAccess = {
        allowedRouteKeys: [...ALWAYS_ACCESSIBLE_ROUTES],
        allowedPaths: [],
        isOwner: false,
        role: null,
        permissions: [],
        orgMemberId: null,
        organizationId: organizationId || null,
        departmentIds: [],
        hasDepartmentAccess: false,
    };

    if (!organizationId) {
        // No org context - return base access with profile routes
        baseAccess.allowedPaths = getPathsForRouteKeys(baseAccess.allowedRouteKeys, workspaceId);
        return baseAccess;
    }

    try {
        // ============================================================
        // DEPARTMENT-DRIVEN ORG ACCESS RESOLUTION
        // ============================================================
        const orgAccess: UserOrgAccessResult = await resolveUserOrgAccess(
            databases,
            userId,
            organizationId,
            workspaceId
        );

        // Not an org member at all
        if (!orgAccess.orgMemberId) {
            baseAccess.allowedPaths = getPathsForRouteKeys(baseAccess.allowedRouteKeys, workspaceId);
            return baseAccess;
        }

        // ============================================================
        // COMBINE ROUTE KEYS
        // ============================================================
        const allRouteKeys: AppRouteKey[] = [
            ...ALWAYS_ACCESSIBLE_ROUTES,
        ];

        // Any org member gets workspace list + core pages (Home, My Spaces, Programs, Timeline).
        // Settings and Organization stay hidden unless the user has admin/department access.
        if (orgAccess.orgMemberId) {
            allRouteKeys.push(...ORG_MEMBER_BASE_ROUTES);
            allRouteKeys.push(...WORKSPACE_CORE_ROUTES);
        }

        // Org-level permission routes (Organization, billing, members, etc.)
        // require department access (OWNER is treated as having department access).
        if (orgAccess.hasDepartmentAccess) {
            allRouteKeys.push(...orgAccess.allowedRouteKeys);
        }

        // Workspace Settings: org OWNER, or workspace OWNER/ADMIN (canDelete).
        if (orgAccess.isOwner) {
            allRouteKeys.push(...WORKSPACE_ADMIN_ROUTES);
        } else if (workspaceId) {
            const wsAccess = await resolveUserWorkspaceAccess(databases, userId, workspaceId);
            if (wsAccess.canDelete) {
                allRouteKeys.push(...WORKSPACE_ADMIN_ROUTES);
            }
        }

        // De-duplicate
        const uniqueRouteKeys = [...new Set(allRouteKeys)];

        return {
            allowedRouteKeys: uniqueRouteKeys,
            allowedPaths: getPathsForRouteKeys(uniqueRouteKeys, workspaceId),
            isOwner: orgAccess.isOwner,
            role: orgAccess.role,
            permissions: orgAccess.permissions,
            orgMemberId: orgAccess.orgMemberId,
            organizationId,
            departmentIds: orgAccess.departmentIds,
            hasDepartmentAccess: orgAccess.hasDepartmentAccess,
        };
    } catch {
        // On error, return base access only
        baseAccess.allowedPaths = getPathsForRouteKeys(baseAccess.allowedRouteKeys, workspaceId);
        return baseAccess;
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if user has a specific permission
 */
export function hasPermission(access: UserAccess, permission: OrgPermissionKey): boolean {
    return access.permissions.includes(permission);
}

/**
 * Check if user can access a specific route key
 */
export function canAccessRouteKey(access: UserAccess, routeKey: AppRouteKey): boolean {
    return access.allowedRouteKeys.includes(routeKey);
}

/**
 * Get user access for PERSONAL accounts (no org)
 * Personal accounts have full access to their own workspaces
 * NOTE: Always include workspace routes for personal accounts - they should always
 * see the navigation items even before workspace context is fully resolved
 */
export function resolvePersonalUserAccess(workspaceId?: string): UserAccess {
    const routeKeys = [
        ...ALWAYS_ACCESSIBLE_ROUTES,
        AppRouteKey.WORKSPACES,
        AppRouteKey.WORKSPACE_CREATE,
        // Personal accounts own their workspace, so they get core pages + Settings
        ...WORKSPACE_CORE_ROUTES,
        ...WORKSPACE_ADMIN_ROUTES,
    ];

    return {
        allowedRouteKeys: routeKeys,
        allowedPaths: getPathsForRouteKeys(routeKeys, workspaceId),
        isOwner: false,
        role: null,
        permissions: [],
        orgMemberId: null,
        organizationId: null,
        departmentIds: [],
        hasDepartmentAccess: false,
    };
}

/**
 * Check if user has any org access (department member or OWNER)
 */
export function hasAnyOrgAccess(access: UserAccess): boolean {
    return access.hasDepartmentAccess;
}
