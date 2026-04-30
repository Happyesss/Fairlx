"use server";

import { createSessionClient } from "@/lib/appwrite";
import { AccountLifecycleState } from "../types";
import {
    resolveUserLifecycleState,
    LifecycleState,
    type ResolvedLifecycle
} from "@/lib/identity-lifecycle";

/**
 * Resolves the full account lifecycle state for routing guards.
 * This is the SINGLE SOURCE OF TRUTH for: Has User -> Has Org -> Has Workspace.
 * 
 * All routing decisions in the app should be based on this resolved state.
 * 
 * @deprecated Use resolveUserLifecycleState from @/lib/identity-lifecycle directly
 *             for new code. This function maintains backward compatibility.
 */
export async function resolveAccountLifecycleState(): Promise<AccountLifecycleState> {
    try {
        const { account, databases } = await createSessionClient();

        // 1. Get User
        let user = null;
        try {
            user = await account.get();
        } catch {
            // Not authenticated
        }

        // 2. Use the new lifecycle resolver (SINGLE AUTHORITY)
        const lifecycle = await resolveUserLifecycleState(databases, user);

        // 3. Convert to legacy format for backward compatibility
        return convertToLegacyState(lifecycle, user);
    } catch {
        // If unauthenticated or error
        return {
            isLoaded: true,
            isLoading: false,
            isAuthenticated: false,
            hasUser: false,
            isEmailVerified: false,
            hasOrg: false,
            hasWorkspace: false,
            user: null,
            accountType: null,
            activeMember: null,
            activeOrgId: null,
            activeOrgName: null,
            activeOrgImageUrl: null,
            activeWorkspaceId: null,
            mustResetPassword: false,
            orgRole: null,
            mustAcceptLegal: false,
            legalBlocked: false,
            isTrialExpired: false,
            trialCreditGranted: false,
            trialCreditExpiresAt: null,
        };
    }
}

/**
 * Convert new lifecycle format to legacy AccountLifecycleState.
 * This maintains backward compatibility during migration.
 */
function convertToLegacyState(
    lifecycle: ResolvedLifecycle,
    user: { $id: string; emailVerification: boolean; prefs?: Record<string, unknown> } | null
): AccountLifecycleState {
    // Map new state to legacy hasOrg logic
    const hasOrg = [
        LifecycleState.ORG_OWNER_NO_WORKSPACE,
        LifecycleState.ORG_OWNER_ACTIVE,
        LifecycleState.ORG_ADMIN_NO_WORKSPACE,
        LifecycleState.ORG_ADMIN_ACTIVE,
        LifecycleState.ORG_MEMBER_PENDING,
        LifecycleState.ORG_MEMBER_NO_WORKSPACE,
        LifecycleState.ORG_MEMBER_ACTIVE,
    ].includes(lifecycle.state);

    return {
        isLoaded: true,
        isLoading: false,
        isAuthenticated: lifecycle.state !== LifecycleState.UNAUTHENTICATED,
        hasUser: lifecycle.userId !== null,
        isEmailVerified: lifecycle.isEmailVerified,
        hasOrg,
        hasWorkspace: lifecycle.hasWorkspace,
        user: user as AccountLifecycleState["user"],
        accountType: lifecycle.accountType,
        activeMember: null, // Legacy field - deprecated
        activeOrgId: lifecycle.orgId,
        activeOrgName: lifecycle.orgName,
        activeOrgImageUrl: lifecycle.orgImageUrl,
        activeWorkspaceId: lifecycle.workspaceId,
        mustResetPassword: lifecycle.mustResetPassword,
        orgRole: lifecycle.orgRole,
        mustAcceptLegal: lifecycle.mustAcceptLegal,
        legalBlocked: lifecycle.legalBlocked,
        isTrialExpired: lifecycle.isTrialExpired,
        trialCreditGranted: lifecycle.trialCreditGranted,
        trialCreditExpiresAt: lifecycle.trialCreditExpiresAt,
    };
}

/**
 * Get the new lifecycle state directly.
 * Use this for new code that needs the full lifecycle resolution.
 */
export async function getLifecycleState(): Promise<ResolvedLifecycle> {
    try {
        const { account, databases } = await createSessionClient();

        let user = null;
        try {
            user = await account.get();
        } catch {
            // Not authenticated
        }

        return resolveUserLifecycleState(databases, user);
    } catch {
        // Return unauthenticated state
        return {
            state: LifecycleState.UNAUTHENTICATED,
            userId: null,
            accountType: null,
            orgId: null,
            orgName: null,
            orgImageUrl: null,
            orgRole: null,
            orgMemberStatus: null,
            workspaceId: null,
            hasWorkspace: false,
            mustResetPassword: false,
            isEmailVerified: false,
            billingStatus: null,
            mustAcceptLegal: false,
            legalBlocked: false,
            isTrialExpired: false,
            trialCreditGranted: false,
            trialCreditExpiresAt: null,
            redirectTo: "/sign-in",
            allowedPaths: ["/sign-in", "/sign-up", "/oauth"],
            blockedPaths: ["*"],
        };
    }
}

/**
 * OPTIMIZED: Single resolver that returns BOTH legacy + new lifecycle state.
 * This eliminates the duplicate resolveUserLifecycleState() call that was
 * causing ~12 DB reads per lifecycle poll (now ~6).
 * 
 * Used by the /api/auth/lifecycle endpoint.
 */
export async function getLifecycleStateWithLegacy(): Promise<{
    legacyState: AccountLifecycleState;
    lifecycle: ResolvedLifecycle;
}> {
    try {
        const { account, databases } = await createSessionClient();

        let user = null;
        try {
            user = await account.get();
        } catch {
            // Not authenticated
        }

        // SINGLE call to the resolver — the key optimization
        const lifecycle = await resolveUserLifecycleState(databases, user);
        const legacyState = convertToLegacyState(lifecycle, user);

        return { legacyState, lifecycle };
    } catch {
        const lifecycle: ResolvedLifecycle = {
            state: LifecycleState.UNAUTHENTICATED,
            userId: null,
            accountType: null,
            orgId: null,
            orgName: null,
            orgImageUrl: null,
            orgRole: null,
            orgMemberStatus: null,
            workspaceId: null,
            hasWorkspace: false,
            mustResetPassword: false,
            isEmailVerified: false,
            billingStatus: null,
            mustAcceptLegal: false,
            legalBlocked: false,
            isTrialExpired: false,
            trialCreditGranted: false,
            trialCreditExpiresAt: null,
            redirectTo: "/sign-in",
            allowedPaths: ["/sign-in", "/sign-up", "/oauth"],
            blockedPaths: ["*"],
        };
        return {
            legacyState: {
                isLoaded: true,
                isLoading: false,
                isAuthenticated: false,
                hasUser: false,
                isEmailVerified: false,
                hasOrg: false,
                hasWorkspace: false,
                user: null,
                accountType: null,
                activeMember: null,
                activeOrgId: null,
                activeOrgName: null,
                activeOrgImageUrl: null,
                activeWorkspaceId: null,
                mustResetPassword: false,
                orgRole: null,
                mustAcceptLegal: false,
                legalBlocked: false,
                isTrialExpired: false,
                trialCreditGranted: false,
                trialCreditExpiresAt: null,
            },
            lifecycle,
        };
    }
}

// Legacy alias for backward compatibility during migration
export const resolveAccountState = resolveAccountLifecycleState;
