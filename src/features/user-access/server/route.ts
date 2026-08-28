import { Hono } from "hono";
import { sessionMiddleware } from "@/lib/session-middleware";
import { resolveUserAccess, resolvePersonalUserAccess } from "@/lib/permissions/resolveUserAccess";

/**
 * User Access API
 * 
 * Returns the user's allowed route keys and permissions for navigation.
 * This is the client-accessible endpoint for the permission system.
 * 
 * NOTE: This is for client-side UI rendering only.
 * Server-side route guards are the authoritative check.
 */

const app = new Hono()
    .get("/", sessionMiddleware, async (c) => {
        const user = c.get("user");
        const databases = c.get("databases");

        // Get query params
        const organizationId = c.req.query("organizationId");
        const workspaceId = c.req.query("workspaceId");

        // Check if this is a personal account (no org)
        const prefs = user.prefs || {};
        const isPersonalAccount = prefs.accountType !== "ORG";

        if (isPersonalAccount) {
            // Personal accounts get full workspace access
            const access = resolvePersonalUserAccess(workspaceId);
            return c.json({
                allowedRouteKeys: access.allowedRouteKeys,
                isOwner: false,
                role: null,
                departmentIds: [],
                hasDepartmentAccess: false,
            });
        }

        // SECURITY: For ORG accounts, validate the organizationId belongs to the user
        // If organizationId is provided, verify user is actually a member
        // The resolveUserAccess function will do this implicitly, but we add
        // explicit validation for defense in depth
        if (organizationId) {
            const access = await resolveUserAccess(
                databases,
                user.$id,
                organizationId,
                workspaceId
            );

            // If user is not an org member at all, return empty access.
            // Members without departments still get core workspace pages from resolveUserAccess.
            // This prevents info leakage about org existence for non-members.
            if (!access.orgMemberId && !access.isOwner) {
                return c.json({
                    allowedRouteKeys: [],
                    permissions: [],
                    isOwner: false,
                    role: null,
                    orgMemberId: null,
                    departmentIds: [],
                    hasDepartmentAccess: false,
                });
            }

            return c.json({
                allowedRouteKeys: access.allowedRouteKeys,
                permissions: access.permissions,
                isOwner: access.isOwner,
                role: access.role,
                orgMemberId: access.orgMemberId,
                departmentIds: access.departmentIds,
                hasDepartmentAccess: access.hasDepartmentAccess,
            });
        }

        // Fallback: No organizationId provided
        return c.json({
            allowedRouteKeys: [],
            permissions: [],
            isOwner: false,
            role: null,
            orgMemberId: null,
            departmentIds: [],
            hasDepartmentAccess: false,
        });
    });

export default app;

