import "server-only";

import { Databases, Query } from "node-appwrite";
import {
    DATABASE_ID,
    ORGANIZATION_MEMBERS_ID,
    ORG_MEMBER_DEPARTMENTS_ID,
    DEPARTMENT_PERMISSIONS_ID,
} from "@/config";
import { createAdminClient } from "@/lib/appwrite";
import { OrganizationRole, OrgMemberStatus, OrganizationMember } from "@/features/organizations/types";
import { OrgMemberDepartment, DepartmentPermission } from "@/features/departments/types";
import { OrgPermissionKey } from "@/features/org-permissions/types";
import { AppRouteKey } from "./appRouteKeys";
import { getRouteKeysForPermissions, getPathsForRouteKeys, getAllRouteKeys } from "./permissionRouteMap";
import { assertOwnerHasFullAccess } from "@/lib/invariants";
import { cached, CK, TTL } from "@/lib/redis";

/**
 * Resolve User Org Access (Department-Driven)
 * 
 * Server-side permission resolver that computes the complete org access
 * for a user based on their DEPARTMENT MEMBERSHIPS.
 * 
 * CORE GOVERNANCE CONTRACT:
 * DEPARTMENT → PERMISSIONS → ROUTES → NAVIGATION
 * 
 * RULES:
 * 1. OWNER always gets ALL access (bypass all checks)
 * 2. Permissions come ONLY from departments
 * 3. No department = ZERO org permissions
 * 4. Permissions are UNIONed across all user's departments
 * 
 * INVARIANTS:
 * - No user → org permission mappings (only dept → permission)
 * - No role-name-based implicit grants (except OWNER)
 * - No default org access on invite
 * 
 * This function is the ONLY authority for org-level permission decisions.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface UserOrgAccessResult {
    /** Whether user is org OWNER (super-role bypass) */
    isOwner: boolean;
    /** User's org role */
    role: OrganizationRole | null;
    /** IDs of departments the user belongs to */
    departmentIds: string[];
    /** All permissions user has (from departments) */
    permissions: OrgPermissionKey[];
    /** Route keys the user can access */
    allowedRouteKeys: AppRouteKey[];
    /** Concrete paths the user can access */
    allowedPaths: string[];
    /** Whether user has at least one department (true = has org access) */
    hasDepartmentAccess: boolean;
    /** User's org member ID */
    orgMemberId: string | null;
    /** Organization ID */
    organizationId: string;
}

// ============================================================================
// MAIN RESOLVER
// ============================================================================

/**
 * Resolve user's complete org access based on department memberships
 * 
 * @param databases - Appwrite databases instance
 * @param userId - User ID
 * @param organizationId - Organization ID
 * @param workspaceId - Active workspace ID (optional - for path resolution)
 * @returns Complete UserOrgAccessResult object
 */
export async function resolveUserOrgAccess(
    databases: Databases,
    userId: string,
    organizationId: string,
    workspaceId?: string
): Promise<UserOrgAccessResult> {
    // Cache org access resolution (3-5 Appwrite queries saved per call)
    return cached(
        CK.orgAccess(userId, organizationId),
        () => _resolveUserOrgAccessUncached(databases, userId, organizationId, workspaceId),
        TTL.ORG_ACCESS
    );
}

/** Uncached implementation */
async function _resolveUserOrgAccessUncached(
    databases: Databases,
    userId: string,
    organizationId: string,
    workspaceId?: string
): Promise<UserOrgAccessResult> {
    // Default: no access
    const noAccess: UserOrgAccessResult = {
        isOwner: false,
        role: null,
        departmentIds: [],
        permissions: [],
        allowedRouteKeys: [],
        allowedPaths: [],
        hasDepartmentAccess: false,
        orgMemberId: null,
        organizationId,
    };

    try {
        // ============================================================
        // STEP 1: Get user's org membership (to resolve orgMemberId)
        // ============================================================
        const membership = await databases.listDocuments<OrganizationMember>(
            DATABASE_ID,
            ORGANIZATION_MEMBERS_ID,
            [
                Query.equal("organizationId", organizationId),
                Query.equal("userId", userId),
                Query.equal("status", OrgMemberStatus.ACTIVE),
            ]
        );

        if (membership.total === 0) {
            // Not an org member → no access
            return noAccess;
        }

        const member = membership.documents[0];
        const role = member.role as OrganizationRole;

        // ============================================================
        // STEP 2: OWNER SUPER-ROLE BYPASS
        // ============================================================
        // CRITICAL: OWNER has full access to everything, no department required
        if (role === OrganizationRole.OWNER) {
            return {
                isOwner: true,
                role,
                departmentIds: [],
                permissions: Object.values(OrgPermissionKey) as OrgPermissionKey[],
                allowedRouteKeys: getAllRouteKeys(),
                allowedPaths: getPathsForRouteKeys(getAllRouteKeys(), workspaceId),
                hasDepartmentAccess: true,  // Owner always has access
                orgMemberId: member.$id,
                organizationId,
            };
        }

        // ============================================================
        // STEP 3 (for non-owners): Department-based permissions
        // ============================================================
        // Non-owners MUST have department membership to get any access

        // ============================================================
        // STEP 3: Get user's department assignments
        // ============================================================
        const departmentAssignments = await databases.listDocuments<OrgMemberDepartment>(
            DATABASE_ID,
            ORG_MEMBER_DEPARTMENTS_ID,
            [Query.equal("orgMemberId", member.$id)]
        );

        const departmentIds = departmentAssignments.documents.map((d) => d.departmentId);

        // ============================================================
        // STEP 4: NO DEPARTMENTS = ZERO PERMISSIONS (CRITICAL RULE)
        // ============================================================
        if (departmentIds.length === 0) {
            // Non-owners with no departments get NO access
            return {
                isOwner: false,
                role,
                departmentIds: [],
                permissions: [],
                allowedRouteKeys: [],
                allowedPaths: [],
                hasDepartmentAccess: false,
                orgMemberId: member.$id,
                organizationId,
            };
        }

        // ============================================================
        // STEP 5: Get all permissions from user's departments
        // ============================================================
        // Use Admin Client to bypass RLS (user cannot read department permissions directly)
        const { databases: adminDatabases } = await createAdminClient();

        const departmentPermissions = await adminDatabases.listDocuments<DepartmentPermission>(
            DATABASE_ID,
            DEPARTMENT_PERMISSIONS_ID,
            [
                Query.equal("departmentId", departmentIds),
                Query.limit(500),
            ]
        );

        // UNION all permissions
        const permissionSet = new Set<OrgPermissionKey>();
        for (const dp of departmentPermissions.documents) {
            permissionSet.add(dp.permissionKey as OrgPermissionKey);
        }
        const permissions = Array.from(permissionSet);

        // ============================================================
        // STEP 6: Map permissions to route keys
        // Logic: Iterate routes -> Check if user has ANY req permission
        // ============================================================
        const routeKeys = getRouteKeysForPermissions(permissions);

        const result: UserOrgAccessResult = {
            isOwner: false,
            role,
            departmentIds,
            permissions,
            allowedRouteKeys: routeKeys,
            allowedPaths: getPathsForRouteKeys(routeKeys, workspaceId),
            hasDepartmentAccess: true,
            orgMemberId: member.$id,
            organizationId,
        };

        // ============================================================
        // STEP 7: OWNER SAFETY INVARIANT CHECK
        // ============================================================
        // This should NEVER trigger because OWNER returns early above.
        // If it does trigger, we have a logic error that needs immediate fix.
        assertOwnerHasFullAccess(role, result.hasDepartmentAccess, {
            userId,
            organizationId,
            orgMemberId: member.$id,
        });

        return result;
    } catch {
        return noAccess;
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if user has a specific org permission
 * OWNER always returns true, non-owners check department permissions
 */
export function hasOrgPermissionFromAccess(
    access: UserOrgAccessResult,
    permission: OrgPermissionKey
): boolean {
    // OWNER has all permissions
    if (access.isOwner) return true;
    return access.permissions.includes(permission);
}

/**
 * Check if user can access a specific org route key
 * OWNER always returns true, non-owners check allowed route keys
 */
export function canAccessOrgRouteKey(
    access: UserOrgAccessResult,
    routeKey: AppRouteKey
): boolean {
    // OWNER has access to all routes
    if (access.isOwner) return true;
    return access.allowedRouteKeys.includes(routeKey);
}

/**
 * Quick check for org access
 * Returns true if user is OWNER or has at least one department
 */
export function hasAnyOrgAccess(access: UserOrgAccessResult): boolean {
    return access.isOwner || access.hasDepartmentAccess;
}

