import "server-only";

import { Databases, Models, Query } from "node-appwrite";
import {
    LifecycleState,
    getLifecycleRouting,
    type ResolvedLifecycle,
} from "@/lib/identity-lifecycle";
import { AccountLifecycleState } from "@/features/auth/types";
import { OrgMemberStatus } from "@/features/organizations/types";

// Collection IDs — same collection names exist on customer Appwrite
import {
    ORGANIZATION_MEMBERS_ID,
    MEMBERS_ID,
    ORGANIZATIONS_ID,
} from "@/config";

/**
 * Resolve lifecycle state for BYOB users.
 *
 * BYOB users have their org and workspace data on the CUSTOMER's Appwrite,
 * not on Fairlx Cloud. The `databases` object here is already connected to
 * the customer's Appwrite by session-middleware.
 *
 * The collection structure on the customer's Appwrite is IDENTICAL to Cloud
 * (set up by the DB initialization script), so the same queries work — we
 * just point them at the customer's DB instance.
 *
 * @param databases - Connected to customer Appwrite (from session-middleware)
 * @param user - Fairlx Cloud user object (auth is always on Cloud)
 * @param databaseId - The customer's database ID (from session-middleware context)
 */
export async function getBYOBLifecycleState(
    databases: Databases,
    user: Models.User<Models.Preferences>,
    databaseId: string
): Promise<{
    legacyState: AccountLifecycleState;
    lifecycle: ResolvedLifecycle;
}> {
    const accountType = "ORG" as const;
    const byobOrgSlug = user.prefs?.byobOrgSlug as string;

    // Query org membership + workspace membership IN PARALLEL
    // These queries hit the CUSTOMER's Appwrite (correct!)
    const [orgMembershipResult, workspaceMembershipResult] = await Promise.all([
        databases.listDocuments(databaseId, ORGANIZATION_MEMBERS_ID, [
            Query.equal("userId", user.$id),
        ]).catch(() => ({ documents: [] as Record<string, unknown>[], total: 0 })),
        databases.listDocuments(databaseId, MEMBERS_ID, [
            Query.equal("userId", user.$id),
            Query.limit(1),
        ]).catch(() => ({ documents: [], total: 0 })),
    ]);

    const hasWorkspace = workspaceMembershipResult.total > 0;
    const workspaceId = hasWorkspace
        ? (workspaceMembershipResult.documents[0].workspaceId as string)
        : null;

    const hasOrg = orgMembershipResult.total > 0;
    let orgId: string | null = null;
    let orgRole: "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER" | null = null;
    let orgMemberStatus: OrgMemberStatus | null = null;

    if (hasOrg) {
        const membership = orgMembershipResult.documents[0];
        orgId = membership.organizationId as string;
        orgRole = membership.role as typeof orgRole;
        orgMemberStatus = membership.status as OrgMemberStatus;
    }

    // Query org doc for name (if we have an org)
    let orgName: string | null = null;
    let orgImageUrl: string | null = null;
    if (hasOrg && orgId) {
        try {
            const orgDoc = await databases.getDocument(databaseId, ORGANIZATIONS_ID, orgId);
            orgName = orgDoc.name || null;
            orgImageUrl = orgDoc.imageUrl || null;
        } catch { /* org doc fetch failed — non-fatal */ }
    }

    // Determine lifecycle state
    let state: LifecycleState;

    if (!hasOrg) {
        // BYOB owner hasn't created their org yet (first login after setup)
        state = LifecycleState.ORG_OWNER_ONBOARDING;
        orgRole = "OWNER"; // BYOB users are always the owner at this stage
    } else if (orgRole === "OWNER") {
        state = hasWorkspace
            ? LifecycleState.ORG_OWNER_ACTIVE
            : LifecycleState.ORG_OWNER_NO_WORKSPACE;
    } else if (orgRole === "ADMIN" || orgRole === "MODERATOR") {
        state = hasWorkspace
            ? LifecycleState.ORG_ADMIN_ACTIVE
            : LifecycleState.ORG_ADMIN_NO_WORKSPACE;
    } else {
        // MEMBER
        if (orgMemberStatus === OrgMemberStatus.INVITED) {
            state = LifecycleState.ORG_MEMBER_PENDING;
        } else {
            state = hasWorkspace
                ? LifecycleState.ORG_MEMBER_ACTIVE
                : LifecycleState.ORG_MEMBER_NO_WORKSPACE;
        }
    }

    const routing = getLifecycleRouting(state);

    // Override redirectTo to use BYOB-namespaced paths
    // CRITICAL: For BYOB users we must ALWAYS provide a BYOB-namespaced redirect.
    // If we leave redirectTo as null, a BYOB user who lands on a Cloud URL
    // (e.g., /welcome after page refresh) won't be redirected to their orgSlug namespace.
    let byobRedirectTo: string | null;

    if (routing.redirectTo === "/onboarding") {
        byobRedirectTo = `/${byobOrgSlug}/onboarding`;
    } else if (routing.redirectTo === "/welcome") {
        byobRedirectTo = `/${byobOrgSlug}/welcome`;
    } else if (routing.redirectTo === null) {
        // Cloud routing says "no redirect needed" — but for BYOB users we need
        // to ensure they're in their orgSlug namespace. Determine the right target:
        if (hasWorkspace && workspaceId) {
            byobRedirectTo = `/${byobOrgSlug}/workspaces/${workspaceId}`;
        } else {
            byobRedirectTo = `/${byobOrgSlug}/welcome`;
        }
    } else {
        // Any other redirectTo — prefix with orgSlug
        byobRedirectTo = `/${byobOrgSlug}${routing.redirectTo}`;
    }

    // Patch allowed paths to include BYOB namespace
    const byobAllowedPaths = [
        ...routing.allowedPaths.map(p => {
            if (p === "/onboarding") return `/${byobOrgSlug}/onboarding`;
            if (p === "/welcome") return `/${byobOrgSlug}/welcome`;
            if (p === "*") return `/${byobOrgSlug}/*`;
            return p;
        }),
        `/${byobOrgSlug}/*`, // Allow all BYOB-namespaced routes
    ];

    // Block Cloud-namespaced paths for BYOB — they should never be on Cloud routes
    const byobBlockedPaths = [
        "/welcome",        // Cloud welcome
        "/onboarding",     // Cloud onboarding
        "/workspaces/*",   // Cloud workspaces
    ];

    const lifecycle: ResolvedLifecycle = {
        state,
        userId: user.$id,
        accountType,
        orgId,
        orgName,
        orgImageUrl,
        orgRole,
        orgMemberStatus,
        workspaceId,
        hasWorkspace,
        mustResetPassword: user.prefs?.mustResetPassword === true,
        isEmailVerified: user.emailVerification,
        billingStatus: null, // BYOB billing not yet implemented
        mustAcceptLegal: false, // BYOB legal managed separately
        legalBlocked: false,
        isTrialExpired: false, // BYOB doesn't use trial credits
        trialCreditGranted: false,
        trialCreditExpiresAt: null,
        redirectTo: byobRedirectTo,
        allowedPaths: byobAllowedPaths,
        blockedPaths: byobBlockedPaths,
    };

    // Convert to legacy state
    const hasOrgForLegacy = [
        LifecycleState.ORG_OWNER_NO_WORKSPACE,
        LifecycleState.ORG_OWNER_ACTIVE,
        LifecycleState.ORG_ADMIN_NO_WORKSPACE,
        LifecycleState.ORG_ADMIN_ACTIVE,
        LifecycleState.ORG_MEMBER_PENDING,
        LifecycleState.ORG_MEMBER_NO_WORKSPACE,
        LifecycleState.ORG_MEMBER_ACTIVE,
    ].includes(state);

    const legacyState: AccountLifecycleState = {
        isLoaded: true,
        isLoading: false,
        isAuthenticated: true,
        hasUser: true,
        isEmailVerified: user.emailVerification,
        hasOrg: hasOrgForLegacy,
        hasWorkspace,
        user: user as AccountLifecycleState["user"],
        accountType,
        activeMember: null,
        activeOrgId: orgId,
        activeOrgName: orgName,
        activeOrgImageUrl: orgImageUrl,
        activeWorkspaceId: workspaceId,
        mustResetPassword: user.prefs?.mustResetPassword === true,
        orgRole,
        mustAcceptLegal: false,
        legalBlocked: false,
        isTrialExpired: false,
        trialCreditGranted: false,
        trialCreditExpiresAt: null,
    };

    return { legacyState, lifecycle };
}
