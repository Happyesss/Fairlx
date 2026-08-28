import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { ID, Query } from "node-appwrite";

import {
    DATABASE_ID,
    DEPARTMENTS_ID,
    ORG_MEMBER_DEPARTMENTS_ID,
    ORGANIZATION_MEMBERS_ID,
    DEPARTMENT_PERMISSIONS_ID,
} from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";
import { createAdminClient } from "@/lib/appwrite";
// Use department-based permission checks (not role-based)
import { resolveUserOrgAccess, hasOrgPermissionFromAccess, hasAnyOrgAccess } from "@/lib/permissions/resolveUserOrgAccess";
import { OrganizationMember } from "@/features/organizations/types";
import { OrgPermissionKey } from "@/features/org-permissions/types";
import { Department, OrgMemberDepartment, DepartmentPermission, PopulatedDepartment } from "../types";
import {
    createDepartmentSchema,
    updateDepartmentSchema,
    assignMemberToDepartmentSchema,
    addDepartmentPermissionSchema,
} from "../schemas";
import { invalidateCachePattern, CKPattern } from "@/lib/redis";

async function invalidateOrgAccessCache(orgId: string) {
    await invalidateCachePattern(CKPattern.orgPerms(orgId));
}
/**
 * Departments API Routes
 * 
 * GOVERNANCE CONTRACT:
 * DEPARTMENT → PERMISSIONS → ROUTES → NAVIGATION
 * 
 * RULES:
 * - Departments belong to organizations (org-level)
 * - Only OWNER/ADMIN can manage departments (MANAGE_DEPARTMENTS permission)
 * - Departments OWN org-level permissions
 * - Members gain org access ONLY via department membership
 * - Permissions are UNIONed across all departments a member belongs to
 */
const app = new Hono()
    /**
     * GET /organizations/:orgId/departments
     * List all departments in an organization
     */
    .get("/:orgId", sessionMiddleware, async (c) => {
        const user = c.get("user");
        const databases = c.get("databases");
        const { orgId } = c.req.param();

        // Verify user is org member (via resolver)
        const access = await resolveUserOrgAccess(databases, user.$id, orgId);

        // Minimal requirement: Must be a member of the organization (OWNER or has departments)
        // Note: Users with 0 departments (and not OWNER) have 0 access.
        if (!hasAnyOrgAccess(access)) {
            return c.json({ error: "Unauthorized - not an org member" }, 401);
        }

        // Get all departments
        const departments = await databases.listDocuments<Department>(
            DATABASE_ID,
            DEPARTMENTS_ID,
            [
                Query.equal("organizationId", orgId),
                Query.orderAsc("name"),
            ]
        );

        // OPTIMIZED: Fetch ALL member assignments in ONE query instead of per-department
        const allDepartmentIds = departments.documents.map(d => d.$id);
        const allMemberAssignments = allDepartmentIds.length > 0
            ? await databases.listDocuments(
                DATABASE_ID,
                ORG_MEMBER_DEPARTMENTS_ID,
                [
                    Query.equal("departmentId", allDepartmentIds),
                    Query.limit(5000), // Reasonable limit for org member assignments
                ]
            )
            : { documents: [] };

        // Build a count map: departmentId -> memberCount
        const memberCountMap = new Map<string, number>();
        allMemberAssignments.documents.forEach((assignment) => {
            const deptId = assignment.departmentId;
            memberCountMap.set(deptId, (memberCountMap.get(deptId) || 0) + 1);
        });

        // Populate departments with counts from the map (NO extra queries!)
        const populatedDepartments: PopulatedDepartment[] = departments.documents.map((dept) => ({
            ...dept,
            memberCount: memberCountMap.get(dept.$id) || 0,
        }));

        return c.json({ data: { documents: populatedDepartments, total: departments.total } });
    })

    /**
     * POST /organizations/:orgId/departments
     * Create a new department
     */
    .post(
        "/:orgId",
        sessionMiddleware,
        zValidator("json", createDepartmentSchema),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const { orgId } = c.req.param();
            const { name, description, color } = c.req.valid("json");

            // Check department-based permission (OWNER bypass included)
            const access = await resolveUserOrgAccess(databases, user.$id, orgId);

            if (!hasOrgPermissionFromAccess(access, OrgPermissionKey.DEPARTMENTS_MANAGE)) {
                return c.json({ error: "Forbidden - requires department management permission" }, 403);
            }

            try {
                // Check for duplicate name
                const existing = await databases.listDocuments(
                    DATABASE_ID,
                    DEPARTMENTS_ID,
                    [
                        Query.equal("organizationId", orgId),
                        Query.equal("name", name),
                    ]
                );

                if (existing.total > 0) {
                    return c.json({ error: "Department with this name already exists" }, 400);
                }

                const department = await databases.createDocument<Department>(
                    DATABASE_ID,
                    DEPARTMENTS_ID,
                    ID.unique(),
                    {
                        organizationId: orgId,
                        name,
                        ...(description ? { description } : {}),
                        color: color || "#4F46E5",
                    }
                );

                return c.json({ data: department }, 201);
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to create department";
                return c.json({ error: message }, 500);
            }
        }
    )

    /**
     * PATCH /organizations/:orgId/departments/:departmentId
     * Update a department
     */
    .patch(
        "/:orgId/:departmentId",
        sessionMiddleware,
        zValidator("json", updateDepartmentSchema),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const { orgId, departmentId } = c.req.param();
            const updates = c.req.valid("json");

            // Check department-based permission (OWNER bypass included)
            const access = await resolveUserOrgAccess(databases, user.$id, orgId);

            if (!hasOrgPermissionFromAccess(access, OrgPermissionKey.DEPARTMENTS_MANAGE)) {
                return c.json({ error: "Forbidden - requires department management permission" }, 403);
            }

            // Verify department exists and belongs to org
            const department = await databases.getDocument<Department>(
                DATABASE_ID,
                DEPARTMENTS_ID,
                departmentId
            );

            if (department.organizationId !== orgId) {
                return c.json({ error: "Department not found in this organization" }, 404);
            }

            // Check for duplicate name if updating name
            if (updates.name && updates.name !== department.name) {
                const existing = await databases.listDocuments(
                    DATABASE_ID,
                    DEPARTMENTS_ID,
                    [
                        Query.equal("organizationId", orgId),
                        Query.equal("name", updates.name),
                    ]
                );

                if (existing.total > 0) {
                    return c.json({ error: "Department with this name already exists" }, 400);
                }
            }

            const updated = await databases.updateDocument<Department>(
                DATABASE_ID,
                DEPARTMENTS_ID,
                departmentId,
                {
                    ...(updates.name && { name: updates.name }),
                    ...(updates.description !== undefined && { description: updates.description }),
                    ...(updates.color && { color: updates.color }),
                }
            );

            return c.json({ data: updated });
        }
    )

    /**
     * DELETE /organizations/:orgId/departments/:departmentId
     * Delete a department
     */
    .delete("/:orgId/:departmentId", sessionMiddleware, async (c) => {
        const user = c.get("user");
        const databases = c.get("databases");
        const { orgId, departmentId } = c.req.param();

        // Check department-based permission (OWNER bypass included)
        const access = await resolveUserOrgAccess(databases, user.$id, orgId);

        if (!hasOrgPermissionFromAccess(access, OrgPermissionKey.DEPARTMENTS_MANAGE)) {
            return c.json({ error: "Forbidden - requires department management permission" }, 403);
        }

        // Verify department belongs to org
        const department = await databases.getDocument<Department>(
            DATABASE_ID,
            DEPARTMENTS_ID,
            departmentId
        );

        if (department.organizationId !== orgId) {
            return c.json({ error: "Department not found in this organization" }, 404);
        }

        // Delete all member assignments first
        const assignments = await databases.listDocuments<OrgMemberDepartment>(
            DATABASE_ID,
            ORG_MEMBER_DEPARTMENTS_ID,
            [Query.equal("departmentId", departmentId)]
        );

        await Promise.all(
            assignments.documents.map((a) =>
                databases.deleteDocument(DATABASE_ID, ORG_MEMBER_DEPARTMENTS_ID, a.$id)
            )
        );

        // Delete department permission grants (otherwise orphaned grants linger)
        const { databases: adminDatabases } = await createAdminClient();
        const deptPermissions = await adminDatabases.listDocuments<DepartmentPermission>(
            DATABASE_ID,
            DEPARTMENT_PERMISSIONS_ID,
            [Query.equal("departmentId", departmentId), Query.limit(500)]
        );
        await Promise.all(
            deptPermissions.documents.map((p) =>
                adminDatabases.deleteDocument(DATABASE_ID, DEPARTMENT_PERMISSIONS_ID, p.$id)
            )
        );

        // Delete department
        await databases.deleteDocument(DATABASE_ID, DEPARTMENTS_ID, departmentId);

        await invalidateOrgAccessCache(orgId);

        return c.json({ success: true });
    })

    /**
     * POST /organizations/:orgId/departments/:departmentId/members
     * Assign an org member to a department
     */
    .post(
        "/:orgId/:departmentId/members",
        sessionMiddleware,
        zValidator("json", assignMemberToDepartmentSchema),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const { orgId, departmentId } = c.req.param();
            const { orgMemberId } = c.req.valid("json");

            // Check department-based permission (OWNER bypass included)
            const access = await resolveUserOrgAccess(databases, user.$id, orgId);

            if (!hasOrgPermissionFromAccess(access, OrgPermissionKey.DEPARTMENTS_MANAGE)) {
                return c.json({ error: "Forbidden - requires department management permission" }, 403);
            }

            // Verify department belongs to org
            const department = await databases.getDocument<Department>(
                DATABASE_ID,
                DEPARTMENTS_ID,
                departmentId
            );

            if (department.organizationId !== orgId) {
                return c.json({ error: "Department not found in this organization" }, 404);
            }

            // Verify member belongs to org
            const memberDoc = await databases.getDocument<OrganizationMember>(
                DATABASE_ID,
                ORGANIZATION_MEMBERS_ID,
                orgMemberId
            );

            if (memberDoc.organizationId !== orgId) {
                return c.json({ error: "Member not found in this organization" }, 404);
            }

            // Check if already assigned
            const existing = await databases.listDocuments(
                DATABASE_ID,
                ORG_MEMBER_DEPARTMENTS_ID,
                [
                    Query.equal("orgMemberId", orgMemberId),
                    Query.equal("departmentId", departmentId),
                ]
            );

            if (existing.total > 0) {
                return c.json({ error: "Member is already in this department" }, 400);
            }

            const assignment = await databases.createDocument<OrgMemberDepartment>(
                DATABASE_ID,
                ORG_MEMBER_DEPARTMENTS_ID,
                ID.unique(),
                {
                    orgMemberId,
                    departmentId,
                }
            );

            await invalidateOrgAccessCache(orgId);

            return c.json({ data: assignment }, 201);
        }
    )

    /**
     * DELETE /organizations/:orgId/departments/:departmentId/members/:orgMemberId
     * Remove an org member from a department
     */
    .delete("/:orgId/:departmentId/members/:orgMemberId", sessionMiddleware, async (c) => {
        const user = c.get("user");
        const databases = c.get("databases");
        const { orgId, departmentId, orgMemberId } = c.req.param();

        // Check department-based permission (OWNER bypass included)
        const access = await resolveUserOrgAccess(databases, user.$id, orgId);

        if (!hasOrgPermissionFromAccess(access, OrgPermissionKey.DEPARTMENTS_MANAGE)) {
            return c.json({ error: "Forbidden - requires department management permission" }, 403);
        }

        // Find and delete the assignment
        const assignments = await databases.listDocuments<OrgMemberDepartment>(
            DATABASE_ID,
            ORG_MEMBER_DEPARTMENTS_ID,
            [
                Query.equal("orgMemberId", orgMemberId),
                Query.equal("departmentId", departmentId),
            ]
        );

        if (assignments.total === 0) {
            return c.json({ error: "Member is not in this department" }, 404);
        }

        await databases.deleteDocument(
            DATABASE_ID,
            ORG_MEMBER_DEPARTMENTS_ID,
            assignments.documents[0].$id
        );

        await invalidateOrgAccessCache(orgId);

        return c.json({ success: true });
    })

    /**
     * GET /organizations/:orgId/departments/:departmentId/members
     * List all members in a department
     */
    .get("/:orgId/:departmentId/members", sessionMiddleware, async (c) => {
        const user = c.get("user");
        const databases = c.get("databases");
        const { orgId, departmentId } = c.req.param();

        // Verify user is org member
        const access = await resolveUserOrgAccess(databases, user.$id, orgId);

        if (!hasAnyOrgAccess(access)) {
            return c.json({ error: "Unauthorized" }, 401);
        }

        // Get department assignments
        const assignments = await databases.listDocuments<OrgMemberDepartment>(
            DATABASE_ID,
            ORG_MEMBER_DEPARTMENTS_ID,
            [Query.equal("departmentId", departmentId)]
        );

        if (assignments.total === 0) {
            return c.json({ data: { documents: [], total: 0 } });
        }

        // Get member details
        const orgMemberIds = assignments.documents.map((a) => a.orgMemberId);
        const members = await databases.listDocuments<OrganizationMember>(
            DATABASE_ID,
            ORGANIZATION_MEMBERS_ID,
            [Query.contains("$id", orgMemberIds)]
        );

        return c.json({ data: members });
    })

    // ============================================================================
    // DEPARTMENT PERMISSION ENDPOINTS
    // ============================================================================

    /**
     * GET /organizations/:orgId/departments/:departmentId/permissions
     * List all permissions assigned to a department
     */
    .get("/:orgId/:departmentId/permissions", sessionMiddleware, async (c) => {
        const user = c.get("user");
        const databases = c.get("databases");
        const { orgId, departmentId } = c.req.param();

        // Verify user is org member
        const access = await resolveUserOrgAccess(databases, user.$id, orgId);

        if (!hasAnyOrgAccess(access)) {
            return c.json({ error: "Unauthorized" }, 401);
        }

        // Verify department belongs to org
        const department = await databases.getDocument<Department>(
            DATABASE_ID,
            DEPARTMENTS_ID,
            departmentId
        );

        if (department.organizationId !== orgId) {
            return c.json({ error: "Department not found in this organization" }, 404);
        }

        // Get department permissions using admin client
        // (department_permissions collection may have restricted access)
        const { databases: adminDatabases } = await createAdminClient();
        const permissions = await adminDatabases.listDocuments<DepartmentPermission>(
            DATABASE_ID,
            DEPARTMENT_PERMISSIONS_ID,
            [
                Query.equal("departmentId", departmentId),
                Query.orderAsc("permissionKey"),
            ]
        );

        return c.json({ data: permissions });
    })

    /**
     * POST /organizations/:orgId/departments/:departmentId/permissions
     * Add a permission to a department
     */
    .post(
        "/:orgId/:departmentId/permissions",
        sessionMiddleware,
        zValidator("json", addDepartmentPermissionSchema),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const { orgId, departmentId } = c.req.param();
            const { permissionKey } = c.req.valid("json");

            // Check department-based permission (OWNER bypass included)
            const access = await resolveUserOrgAccess(databases, user.$id, orgId);

            if (!hasOrgPermissionFromAccess(access, OrgPermissionKey.DEPARTMENTS_MANAGE)) {
                return c.json({ error: "Forbidden - requires department management permission" }, 403);
            }

            // Verify department belongs to org
            const department = await databases.getDocument<Department>(
                DATABASE_ID,
                DEPARTMENTS_ID,
                departmentId
            );

            if (department.organizationId !== orgId) {
                return c.json({ error: "Department not found in this organization" }, 404);
            }

            // Use admin client for department_permissions collection
            const { databases: adminDatabases } = await createAdminClient();

            // Check if permission already exists
            const existing = await adminDatabases.listDocuments(
                DATABASE_ID,
                DEPARTMENT_PERMISSIONS_ID,
                [
                    Query.equal("departmentId", departmentId),
                    Query.equal("permissionKey", permissionKey),
                ]
            );

            if (existing.total > 0) {
                return c.json({ error: "Permission already assigned to this department" }, 400);
            }

            // Create the permission assignment
            const permission = await adminDatabases.createDocument<DepartmentPermission>(
                DATABASE_ID,
                DEPARTMENT_PERMISSIONS_ID,
                ID.unique(),
                {
                    departmentId,
                    permissionKey,
                    grantedBy: user.$id,
                    grantedAt: new Date().toISOString(),
                }
            );

            await invalidateOrgAccessCache(orgId);

            return c.json({ data: permission }, 201);
        }
    )

    /**
     * DELETE /organizations/:orgId/departments/:departmentId/permissions/:permKey
     * Remove a permission from a department
     */
    .delete("/:orgId/:departmentId/permissions/:permKey", sessionMiddleware, async (c) => {
        const user = c.get("user");
        const databases = c.get("databases");
        const { orgId, departmentId, permKey } = c.req.param();

        // Check department-based permission (OWNER bypass included)
        const access = await resolveUserOrgAccess(databases, user.$id, orgId);

        if (!hasOrgPermissionFromAccess(access, OrgPermissionKey.DEPARTMENTS_MANAGE)) {
            return c.json({ error: "Forbidden - requires department management permission" }, 403);
        }

        // Use admin client for department_permissions collection
        const { databases: adminDatabases } = await createAdminClient();

        // Find and delete the permission
        const permissions = await adminDatabases.listDocuments<DepartmentPermission>(
            DATABASE_ID,
            DEPARTMENT_PERMISSIONS_ID,
            [
                Query.equal("departmentId", departmentId),
                Query.equal("permissionKey", permKey),
            ]
        );

        if (permissions.total === 0) {
            return c.json({ error: "Permission not found on this department" }, 404);
        }

        await adminDatabases.deleteDocument(
            DATABASE_ID,
            DEPARTMENT_PERMISSIONS_ID,
            permissions.documents[0].$id
        );

        await invalidateOrgAccessCache(orgId);

        return c.json({ success: true });
    });

export default app;
