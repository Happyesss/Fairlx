import { Hono } from "hono";
import { sessionMiddleware } from "@/lib/session-middleware";
import { resolveUserAccess, resolvePersonalUserAccess } from "@/lib/permissions/resolveUserAccess";
import { shouldResolvePersonalNavAccess } from "@/lib/permissions/visible-nav-routes";

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

        // Membership / organizationId wins over prefs.accountType. Prefs can stay
        // PERSONAL after the user already owns or joined an organization, which
        // used to hide the Organization sidebar item for owners.
        if (shouldResolvePersonalNavAccess(organizationId)) {
            const access = resolvePersonalUserAccess(workspaceId);
            return c.json({
                allowedRouteKeys: access.allowedRouteKeys,
                isOwner: false,
                role: null,
                departmentIds: [],
                hasDepartmentAccess: false,
            });
        }

        if (organizationId) {
            const access = await resolveUserAccess(
                databases,
                user.$id,
                organizationId,
                workspaceId
            );

            // Not a member of this org — fall back to personal workspace nav.
            if (!access.orgMemberId && !access.isOwner) {
                const personal = resolvePersonalUserAccess(workspaceId);
                return c.json({
                    allowedRouteKeys: personal.allowedRouteKeys,
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

