import "server-only";

import { Databases, Query, Models } from "node-appwrite";
import {
    DATABASE_ID,
    ORGANIZATIONS_ID,
    ORGANIZATION_MEMBERS_ID,
    MEMBERS_ID,
    BILLING_ACCOUNTS_ID,
} from "@/config";
import { OrganizationRole, OrgMemberStatus } from "@/features/organizations/types";
import { BillingStatus } from "@/features/billing/types";
import { assertInvariant } from "@/lib/invariants";

// ============================================================================
// LIFECYCLE STATE ENUM
// ============================================================================

/**
 * Single Identity Lifecycle Authority
 * 
 * ALL routing decisions MUST derive from this resolver.
 * This is the ONLY place that determines user lifecycle state.
 */
export enum LifecycleState {
    // Unauthenticated states
    UNAUTHENTICATED = "UNAUTHENTICATED",
    EMAIL_UNVERIFIED = "EMAIL_UNVERIFIED",
    ACCOUNT_TYPE_PENDING = "ACCOUNT_TYPE_PENDING",

    // PERSONAL account states
    PERSONAL_ONBOARDING = "PERSONAL_ONBOARDING",
    PERSONAL_ACTIVE = "PERSONAL_ACTIVE",

    // ORG OWNER states
    ORG_OWNER_ONBOARDING = "ORG_OWNER_ONBOARDING",
    ORG_OWNER_NO_WORKSPACE = "ORG_OWNER_NO_WORKSPACE",
    ORG_OWNER_ACTIVE = "ORG_OWNER_ACTIVE",

    // ORG ADMIN/MODERATOR states
    ORG_ADMIN_NO_WORKSPACE = "ORG_ADMIN_NO_WORKSPACE",
    ORG_ADMIN_ACTIVE = "ORG_ADMIN_ACTIVE",

    // ORG MEMBER states
    ORG_MEMBER_PENDING = "ORG_MEMBER_PENDING",
    ORG_MEMBER_NO_WORKSPACE = "ORG_MEMBER_NO_WORKSPACE",
    ORG_MEMBER_ACTIVE = "ORG_MEMBER_ACTIVE",

    // Error/special states
    SUSPENDED = "SUSPENDED",
    DELETED = "DELETED",
    MUST_RESET_PASSWORD = "MUST_RESET_PASSWORD",
}

// ============================================================================
// RESULT TYPE
// ============================================================================

export interface ResolvedLifecycle {
    state: LifecycleState;
    userId: string | null;
    accountType: "PERSONAL" | "ORG" | null;
    orgId: string | null;
    orgName: string | null;
    orgImageUrl: string | null;
    orgRole: "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER" | null;
    orgMemberStatus: OrgMemberStatus | null;
    workspaceId: string | null;
    hasWorkspace: boolean;
    mustResetPassword: boolean;
    isEmailVerified: boolean;
    billingStatus: BillingStatus | null;
    mustAcceptLegal: boolean;
    legalBlocked: boolean;
    /** True when the org's trial credit has expired (used by UI to show trial-specific banner) */
    isTrialExpired: boolean;
    /** True when the org has been granted a trial credit (even if not yet expired) */
    trialCreditGranted: boolean;
    /** The date when the trial credit expires */
    trialCreditExpiresAt: string | null;
    redirectTo: string | null;
    allowedPaths: string[];
    blockedPaths: string[];
}

// ============================================================================
// PATH CONSTANTS
// ============================================================================

const PUBLIC_ROUTES = [
    "/sign-in",
    "/sign-up",
    "/verify-email",
    "/verify-email-sent",
    "/verify-email-needed",
    "/forgot-password",
    "/reset-password",
    "/oauth",
    "/auth/callback",
];

const ONBOARDING_ROUTES = [
    "/onboarding",
];

const PROFILE_ROUTES = [
    "/profile",
    "/profile/accountinfo",
    "/profile/password",
];

const ORGANIZATION_ROUTES = [
    "/organization",
];

const BILLING_ROUTES = [
    "/organization/billing",
    "/organization/settings/billing",
    "/settings/billing",
    "/billing",
];

// ============================================================================
// ROUTING DERIVATION
// ============================================================================

export function getLifecycleRouting(state: LifecycleState): {
    redirectTo: string | null;
    allowedPaths: string[];
    blockedPaths: string[];
} {
    switch (state) {
        case LifecycleState.UNAUTHENTICATED:
            return {
                redirectTo: "/sign-in",
                allowedPaths: [...PUBLIC_ROUTES],
                blockedPaths: ["*"],
            };

        case LifecycleState.EMAIL_UNVERIFIED:
            return {
                redirectTo: "/verify-email-needed",
                allowedPaths: [...PUBLIC_ROUTES, "/verify-email-needed"],
                blockedPaths: ["/onboarding", "/workspaces", "/organization", "/welcome"],
            };

        case LifecycleState.ACCOUNT_TYPE_PENDING:
            return {
                redirectTo: "/onboarding",
                allowedPaths: [...ONBOARDING_ROUTES, ...PROFILE_ROUTES],
                blockedPaths: ["/workspaces", "/organization", "/welcome"],
            };

        case LifecycleState.PERSONAL_ONBOARDING:
            return {
                redirectTo: "/onboarding",
                allowedPaths: [...ONBOARDING_ROUTES, ...PROFILE_ROUTES],
                blockedPaths: ["/organization"],
            };

        case LifecycleState.PERSONAL_ACTIVE:
            return {
                redirectTo: null,
                allowedPaths: ["*"],
                blockedPaths: ["/onboarding", "/organization", "/welcome"],
            };

        case LifecycleState.ORG_OWNER_ONBOARDING:
            return {
                redirectTo: "/onboarding",
                allowedPaths: [...ONBOARDING_ROUTES, ...PROFILE_ROUTES],
                blockedPaths: ["/workspaces"],
            };

        case LifecycleState.ORG_OWNER_NO_WORKSPACE:
            return {
                redirectTo: null,
                allowedPaths: ["/welcome", ...ORGANIZATION_ROUTES, ...PROFILE_ROUTES, ...BILLING_ROUTES],
                blockedPaths: ["/onboarding", "/workspaces/*"],
            };

        case LifecycleState.ORG_OWNER_ACTIVE:
            return {
                redirectTo: null,
                allowedPaths: ["*"],
                blockedPaths: ["/onboarding", "/welcome"],
            };

        case LifecycleState.ORG_ADMIN_NO_WORKSPACE:
            return {
                redirectTo: "/welcome",
                allowedPaths: ["/welcome", ...ORGANIZATION_ROUTES, ...PROFILE_ROUTES],
                blockedPaths: ["/onboarding", "/workspaces/*"],
            };

        case LifecycleState.ORG_ADMIN_ACTIVE:
            return {
                redirectTo: null,
                allowedPaths: ["*"],
                blockedPaths: ["/onboarding", "/welcome"],
            };

        case LifecycleState.ORG_MEMBER_PENDING:
            return {
                redirectTo: "/welcome",
                allowedPaths: ["/welcome", ...PROFILE_ROUTES, ...ORGANIZATION_ROUTES],
                blockedPaths: ["/onboarding", "/workspaces/*"],
            };

        case LifecycleState.ORG_MEMBER_NO_WORKSPACE:
            return {
                redirectTo: "/welcome",
                allowedPaths: ["/welcome", ...PROFILE_ROUTES, ...ORGANIZATION_ROUTES],
                blockedPaths: ["/onboarding", "/workspaces/*"],
            };

        case LifecycleState.ORG_MEMBER_ACTIVE:
            return {
                redirectTo: null,
                allowedPaths: ["/workspaces/*", ...PROFILE_ROUTES, ...ORGANIZATION_ROUTES],
                blockedPaths: ["/onboarding", "/welcome"],
            };

        case LifecycleState.SUSPENDED:
            return {
                redirectTo: "/organization/billing",
                allowedPaths: [...BILLING_ROUTES, ...PROFILE_ROUTES],
                blockedPaths: ["/workspaces/*", "/onboarding", "/welcome"],
            };

        case LifecycleState.DELETED:
            return {
                redirectTo: "/sign-in",
                allowedPaths: [],
                blockedPaths: ["*"],
            };

        case LifecycleState.MUST_RESET_PASSWORD:
            return {
                redirectTo: null,
                allowedPaths: [],
                blockedPaths: ["*"],
            };

        default:
            return {
                redirectTo: "/sign-in",
                allowedPaths: [...PUBLIC_ROUTES],
                blockedPaths: ["*"],
            };
    }
}

// ============================================================================
// MAIN RESOLVER
// ============================================================================

async function resolveUserLifecycleStateInternal(
    databases: Databases,
    user: Models.User<Models.Preferences> | null
): Promise<ResolvedLifecycle> {
    if (!user) {
        const routing = getLifecycleRouting(LifecycleState.UNAUTHENTICATED);
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
            ...routing,
        };
    }

    const prefs = user.prefs || {};
    const accountType = prefs.accountType as "PERSONAL" | "ORG" | null;
    const mustResetPassword = prefs.mustResetPassword === true;
    const isEmailVerified = user.emailVerification;

    if (mustResetPassword) {
        const routing = getLifecycleRouting(LifecycleState.MUST_RESET_PASSWORD);
        return {
            state: LifecycleState.MUST_RESET_PASSWORD,
            userId: user.$id,
            accountType,
            orgId: null,
            orgName: null,
            orgImageUrl: null,
            orgRole: null,
            orgMemberStatus: null,
            workspaceId: null,
            hasWorkspace: false,
            mustResetPassword: true,
            isEmailVerified,
            billingStatus: null,
            mustAcceptLegal: false,
            legalBlocked: false,
            isTrialExpired: false,
            trialCreditGranted: false,
            trialCreditExpiresAt: null,
            ...routing,
        };
    }

    if (!isEmailVerified) {
        const routing = getLifecycleRouting(LifecycleState.EMAIL_UNVERIFIED);
        return {
            state: LifecycleState.EMAIL_UNVERIFIED,
            userId: user.$id,
            accountType,
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
            ...routing,
        };
    }

    if (!accountType) {
        const routing = getLifecycleRouting(LifecycleState.ACCOUNT_TYPE_PENDING);
        return {
            state: LifecycleState.ACCOUNT_TYPE_PENDING,
            userId: user.$id,
            accountType: null,
            orgId: null,
            orgName: null,
            orgImageUrl: null,
            orgRole: null,
            orgMemberStatus: null,
            workspaceId: null,
            hasWorkspace: false,
            mustResetPassword: false,
            isEmailVerified: true,
            billingStatus: null,
            mustAcceptLegal: false,
            legalBlocked: false,
            isTrialExpired: false,
            trialCreditGranted: false,
            trialCreditExpiresAt: null,
            ...routing,
        };
    }

    // PERFORMANCE OPTIMIZED: Parallel query resolution
    // Previously: 4 sequential queries (~5-6s total on remote Appwrite)
    // Now: 2 rounds of parallel queries (~2-3s total)

    let orgId: string | null = prefs.primaryOrganizationId || null;
    let orgName: string | null = null;
    let orgImageUrl: string | null = null;
    let orgRole: "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER" | null = null;
    let orgMemberStatus: OrgMemberStatus | null = null;
    let orgLegalAccepted = false;
    let hasOrg = false;
    let hasWorkspace = false;
    let workspaceId: string | null = null;
    let billingStatus: BillingStatus | null = null;

    // ROUND 1: Fetch org membership + workspace membership IN PARALLEL
    // These two are completely independent of each other
    const [orgMembershipResult, workspaceMembershipResult] = await Promise.all([
        // Query 1: Org membership
        accountType === "ORG"
            ? databases.listDocuments(DATABASE_ID, ORGANIZATION_MEMBERS_ID, [Query.equal("userId", user.$id)]).catch(() => ({ documents: [] as Record<string, string>[], total: 0 }))
            : Promise.resolve({ documents: [] as Record<string, string>[], total: 0 }),
        // Query 2: Workspace membership
        databases.listDocuments(DATABASE_ID, MEMBERS_ID, [Query.equal("userId", user.$id), Query.limit(1)]).catch(() => ({ documents: [], total: 0 })),
    ]);

    // Process workspace membership result
    if (workspaceMembershipResult.total > 0) {
        hasWorkspace = true;
        workspaceId = workspaceMembershipResult.documents[0].workspaceId;
    }

    // Process org membership result
    if (accountType === "ORG" && orgMembershipResult.total > 0) {
        const primaryMembership = orgMembershipResult.documents.find(m => m.organizationId === orgId)
            || orgMembershipResult.documents[0];

        hasOrg = true;
        orgId = primaryMembership.organizationId;
        orgRole = primaryMembership.role as typeof orgRole;
        orgMemberStatus = primaryMembership.status as OrgMemberStatus;
    }

    // ROUND 2: Fetch org doc + billing IN PARALLEL
    // Both depend on orgId from Round 1, but are independent of each other
    const orgDocPromise = (accountType === "ORG" && hasOrg && orgId)
        ? databases.getDocument(DATABASE_ID, ORGANIZATIONS_ID, orgId).catch(() => null)
        : Promise.resolve(null);

    const billingPromise = (() => {
        if (accountType === "ORG" && orgId) {
            return databases.listDocuments(DATABASE_ID, BILLING_ACCOUNTS_ID, [Query.equal("organizationId", orgId), Query.limit(1)]).catch(() => ({ documents: [], total: 0 }));
        } else if (accountType === "PERSONAL") {
            return databases.listDocuments(DATABASE_ID, BILLING_ACCOUNTS_ID, [Query.equal("userId", user.$id), Query.limit(1)]).catch(() => ({ documents: [], total: 0 }));
        }
        return Promise.resolve({ documents: [] as { status?: string }[], total: 0 });
    })();

    const [orgDoc, billingResult] = await Promise.all([orgDocPromise, billingPromise]);

    // Process org doc
    if (orgDoc) {
        orgName = orgDoc.name || null;
        orgImageUrl = orgDoc.imageUrl || null;
        if (orgDoc.billingSettings) {
            try {
                const settings = JSON.parse(orgDoc.billingSettings);
                if (settings.legal?.currentVersion === "v1") {
                    orgLegalAccepted = true;
                }
            } catch { }
        }
    }

    // Process billing
    if (billingResult.total > 0) {
        billingStatus = billingResult.documents[0].status as BillingStatus;
    }

    // CHECK LEGAL STATUS
    const CURRENT_LEGAL_VERSION = "v1";
    let mustAcceptLegal = prefs.acceptedTermsVersion !== CURRENT_LEGAL_VERSION;
    let legalBlocked = false;

    if (accountType === "ORG" && hasOrg) {
        const isManagement = orgRole === OrganizationRole.OWNER || orgRole === OrganizationRole.ADMIN;
        if (isManagement) {
            if (!orgLegalAccepted) mustAcceptLegal = true;
        } else {
            if (!orgLegalAccepted) {
                legalBlocked = true;
                mustAcceptLegal = false;
            }
        }
    }

    // CHECK SUSPENSION
    if (billingStatus === BillingStatus.SUSPENDED) {
        const routing = getLifecycleRouting(LifecycleState.SUSPENDED);
        return {
            state: LifecycleState.SUSPENDED,
            userId: user.$id,
            accountType,
            orgId,
            orgName,
            orgImageUrl,
            orgRole,
            orgMemberStatus,
            workspaceId,
            hasWorkspace,
            mustResetPassword: false,
            isEmailVerified: true,
            billingStatus,
            mustAcceptLegal: false,
            legalBlocked: false,
            isTrialExpired: orgDoc?.isTrialExpired === true,
            trialCreditGranted: orgDoc?.trialCreditGranted === true,
            trialCreditExpiresAt: orgDoc?.trialCreditExpiresAt ?? null,
            ...routing,
        };
    }

    // DERIVE FINAL STATE
    if (accountType === "PERSONAL") {
        if (!hasWorkspace) {
            const routing = getLifecycleRouting(LifecycleState.PERSONAL_ONBOARDING);
            return {
                state: LifecycleState.PERSONAL_ONBOARDING,
                userId: user.$id,
                accountType,
                orgId: null,
                orgName: null,
                orgImageUrl: null,
                orgRole: null,
                orgMemberStatus: null,
                workspaceId: null,
                hasWorkspace: false,
                mustResetPassword: false,
                isEmailVerified: true,
                billingStatus,
                mustAcceptLegal,
                legalBlocked: false,
                isTrialExpired: false,
                trialCreditGranted: false,
                trialCreditExpiresAt: null,
                ...routing,
            };
        }

        const routing = getLifecycleRouting(LifecycleState.PERSONAL_ACTIVE);
        return {
            state: LifecycleState.PERSONAL_ACTIVE,
            userId: user.$id,
            accountType,
            orgId: null,
            orgName: null,
            orgImageUrl: null,
            orgRole: null,
            orgMemberStatus: null,
            workspaceId,
            hasWorkspace: true,
            mustResetPassword: false,
            isEmailVerified: true,
            billingStatus,
            mustAcceptLegal,
            legalBlocked: false,
            isTrialExpired: false,
            trialCreditGranted: false,
            trialCreditExpiresAt: null,
            ...routing,
        };
    }

    if (accountType === "ORG") {
        if (!hasOrg) {
            const routing = getLifecycleRouting(LifecycleState.ORG_OWNER_ONBOARDING);
            return {
                state: LifecycleState.ORG_OWNER_ONBOARDING,
                userId: user.$id,
                accountType,
                orgId: null,
                orgName: null,
                orgImageUrl: null,
                orgRole: null,
                orgMemberStatus: null,
                workspaceId: null,
                hasWorkspace: false,
                mustResetPassword: false,
                isEmailVerified: true,
                billingStatus: null,
                mustAcceptLegal,
                legalBlocked,
                isTrialExpired: false,
                trialCreditGranted: false,
                trialCreditExpiresAt: null,
                ...routing,
            };
        }

        if (orgMemberStatus === OrgMemberStatus.INVITED) {
            const routing = getLifecycleRouting(LifecycleState.ORG_MEMBER_PENDING);
            return {
                state: LifecycleState.ORG_MEMBER_PENDING,
                userId: user.$id,
                accountType,
                orgId,
                orgName,
                orgImageUrl,
                orgRole,
                orgMemberStatus,
                workspaceId: null,
                hasWorkspace: false,
                mustResetPassword: false,
                isEmailVerified: true,
                billingStatus,
                mustAcceptLegal,
                legalBlocked,
                isTrialExpired: orgDoc?.isTrialExpired === true,
                trialCreditGranted: orgDoc?.trialCreditGranted === true,
                trialCreditExpiresAt: orgDoc?.trialCreditExpiresAt ?? null,
                ...routing,
            };
        }

        if (orgRole === OrganizationRole.OWNER) {
            if (!hasWorkspace) {
                const routing = getLifecycleRouting(LifecycleState.ORG_OWNER_NO_WORKSPACE);
                return {
                    state: LifecycleState.ORG_OWNER_NO_WORKSPACE,
                    userId: user.$id,
                    accountType,
                    orgId,
                    orgName,
                    orgImageUrl,
                    orgRole,
                    orgMemberStatus,
                    workspaceId: null,
                    hasWorkspace: false,
                    mustResetPassword: false,
                    isEmailVerified: true,
                    billingStatus,
                    mustAcceptLegal,
                    legalBlocked,
                    isTrialExpired: orgDoc?.isTrialExpired === true,
                    trialCreditGranted: orgDoc?.trialCreditGranted === true,
                    trialCreditExpiresAt: orgDoc?.trialCreditExpiresAt ?? null,
                    ...routing,
                };
            }

            const routing = getLifecycleRouting(LifecycleState.ORG_OWNER_ACTIVE);
            return {
                state: LifecycleState.ORG_OWNER_ACTIVE,
                userId: user.$id,
                accountType,
                orgId,
                orgName,
                orgImageUrl,
                orgRole,
                orgMemberStatus,
                workspaceId,
                hasWorkspace: true,
                mustResetPassword: false,
                isEmailVerified: true,
                billingStatus,
                mustAcceptLegal,
                legalBlocked,
                isTrialExpired: orgDoc?.isTrialExpired === true,
                trialCreditGranted: orgDoc?.trialCreditGranted === true,
                trialCreditExpiresAt: orgDoc?.trialCreditExpiresAt ?? null,
                ...routing,
            };
        }

        if (orgRole === OrganizationRole.ADMIN || orgRole === OrganizationRole.MODERATOR) {
            if (!hasWorkspace) {
                const routing = getLifecycleRouting(LifecycleState.ORG_ADMIN_NO_WORKSPACE);
                return {
                    state: LifecycleState.ORG_ADMIN_NO_WORKSPACE,
                    userId: user.$id,
                    accountType,
                    orgId,
                    orgName,
                    orgImageUrl,
                    orgRole,
                    orgMemberStatus,
                    workspaceId: null,
                    hasWorkspace: false,
                    mustResetPassword: false,
                    isEmailVerified: true,
                    billingStatus,
                    mustAcceptLegal,
                    legalBlocked,
                    isTrialExpired: orgDoc?.isTrialExpired === true,
                    trialCreditGranted: orgDoc?.trialCreditGranted === true,
                    trialCreditExpiresAt: orgDoc?.trialCreditExpiresAt ?? null,
                    ...routing,
                };
            }

            const routing = getLifecycleRouting(LifecycleState.ORG_ADMIN_ACTIVE);
            return {
                state: LifecycleState.ORG_ADMIN_ACTIVE,
                userId: user.$id,
                accountType,
                orgId,
                orgName,
                orgImageUrl,
                orgRole,
                orgMemberStatus,
                workspaceId,
                hasWorkspace: true,
                mustResetPassword: false,
                isEmailVerified: true,
                billingStatus,
                mustAcceptLegal,
                legalBlocked,
                isTrialExpired: orgDoc?.isTrialExpired === true,
                trialCreditGranted: orgDoc?.trialCreditGranted === true,
                trialCreditExpiresAt: orgDoc?.trialCreditExpiresAt ?? null,
                ...routing,
            };
        }

        if (!hasWorkspace) {
            const routing = getLifecycleRouting(LifecycleState.ORG_MEMBER_NO_WORKSPACE);
            return {
                state: LifecycleState.ORG_MEMBER_NO_WORKSPACE,
                userId: user.$id,
                accountType,
                orgId,
                orgName,
                orgImageUrl,
                orgRole,
                orgMemberStatus,
                workspaceId: null,
                hasWorkspace: false,
                mustResetPassword: false,
                isEmailVerified: true,
                billingStatus,
                mustAcceptLegal,
                legalBlocked,
                isTrialExpired: orgDoc?.isTrialExpired === true,
                trialCreditGranted: orgDoc?.trialCreditGranted === true,
                trialCreditExpiresAt: orgDoc?.trialCreditExpiresAt ?? null,
                ...routing,
            };
        }

        const routing = getLifecycleRouting(LifecycleState.ORG_MEMBER_ACTIVE);
        return {
            state: LifecycleState.ORG_MEMBER_ACTIVE,
            userId: user.$id,
            accountType,
            orgId,
            orgName,
            orgImageUrl,
            orgRole,
            orgMemberStatus,
            workspaceId,
            hasWorkspace: true,
            mustResetPassword: false,
            isEmailVerified: true,
            billingStatus,
            mustAcceptLegal,
            legalBlocked,
            isTrialExpired: orgDoc?.isTrialExpired === true,
            trialCreditGranted: orgDoc?.trialCreditGranted === true,
            trialCreditExpiresAt: orgDoc?.trialCreditExpiresAt ?? null,
            ...routing,
        };
    }

    const routing = getLifecycleRouting(LifecycleState.UNAUTHENTICATED);
    return {
        state: LifecycleState.UNAUTHENTICATED,
        userId: user.$id,
        accountType,
        orgId: null,
        orgName: null,
        orgImageUrl: null,
        orgRole: null,
        orgMemberStatus: null,
        workspaceId: null,
        hasWorkspace: false,
        mustResetPassword: false,
        isEmailVerified: true,
        billingStatus: null,
        mustAcceptLegal: false,
        legalBlocked: false,
        isTrialExpired: false,
        trialCreditGranted: false,
        trialCreditExpiresAt: null,
        ...routing,
    };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function isPathAllowedForState(
    lifecycle: ResolvedLifecycle,
    path: string
): boolean {
    for (const allowed of lifecycle.allowedPaths) {
        if (allowed === "*") return true;
        if (allowed.endsWith("/*")) {
            const prefix = allowed.slice(0, -2);
            if (path.startsWith(prefix)) return true;
        }
        if (path === allowed || path.startsWith(allowed + "/")) return true;
    }

    for (const blocked of lifecycle.blockedPaths) {
        if (blocked === "*") return false;
        if (blocked.endsWith("/*")) {
            const prefix = blocked.slice(0, -2);
            if (path.startsWith(prefix)) return false;
        }
        if (path === blocked || path.startsWith(blocked + "/")) return false;
    }

    return true;
}

export function getLifecycleStateLabel(state: LifecycleState): string {
    const labels: Record<LifecycleState, string> = {
        [LifecycleState.UNAUTHENTICATED]: "Not signed in",
        [LifecycleState.EMAIL_UNVERIFIED]: "Email verification required",
        [LifecycleState.ACCOUNT_TYPE_PENDING]: "Account setup required",
        [LifecycleState.PERSONAL_ONBOARDING]: "Create your workspace",
        [LifecycleState.PERSONAL_ACTIVE]: "Active",
        [LifecycleState.ORG_OWNER_ONBOARDING]: "Create your organization",
        [LifecycleState.ORG_OWNER_NO_WORKSPACE]: "Create your first workspace",
        [LifecycleState.ORG_OWNER_ACTIVE]: "Active",
        [LifecycleState.ORG_ADMIN_NO_WORKSPACE]: "Waiting for workspace assignment",
        [LifecycleState.ORG_ADMIN_ACTIVE]: "Active",
        [LifecycleState.ORG_MEMBER_PENDING]: "Invitation pending",
        [LifecycleState.ORG_MEMBER_NO_WORKSPACE]: "Waiting for workspace assignment",
        [LifecycleState.ORG_MEMBER_ACTIVE]: "Active",
        [LifecycleState.SUSPENDED]: "Account suspended",
        [LifecycleState.DELETED]: "Account deleted",
        [LifecycleState.MUST_RESET_PASSWORD]: "Password reset required",
    };

    return labels[state] || "Unknown";
}

export function isActiveState(state: LifecycleState): boolean {
    return [
        LifecycleState.PERSONAL_ACTIVE,
        LifecycleState.ORG_OWNER_ACTIVE,
        LifecycleState.ORG_ADMIN_ACTIVE,
        LifecycleState.ORG_MEMBER_ACTIVE,
    ].includes(state);
}

export function requiresOnboarding(state: LifecycleState): boolean {
    return [
        LifecycleState.ACCOUNT_TYPE_PENDING,
        LifecycleState.PERSONAL_ONBOARDING,
        LifecycleState.ORG_OWNER_ONBOARDING,
    ].includes(state);
}

export function isRestrictedOrgMember(state: LifecycleState): boolean {
    return [
        LifecycleState.ORG_MEMBER_PENDING,
        LifecycleState.ORG_MEMBER_NO_WORKSPACE,
        LifecycleState.ORG_ADMIN_NO_WORKSPACE,
    ].includes(state);
}

// ============================================================================
// INVARIANT VALIDATION
// ============================================================================

function validateLifecycleInvariant(lifecycle: ResolvedLifecycle) {
    const { state, accountType, hasWorkspace, orgRole } = lifecycle;

    if (state.startsWith("PERSONAL_")) {
        assertInvariant(
            accountType === "PERSONAL",
            "LIFECYCLE_PERSONAL_TYPE_MISMATCH",
            "PERSONAL state requires PERSONAL account type",
            { state, accountType }
        );
    }

    if (state.startsWith("ORG_")) {
        assertInvariant(
            accountType === "ORG",
            "LIFECYCLE_ORG_TYPE_MISMATCH",
            "ORG state requires ORG account type",
            { state, accountType }
        );
    }

    if (state === LifecycleState.ORG_OWNER_ACTIVE ||
        state === LifecycleState.ORG_OWNER_NO_WORKSPACE ||
        state === LifecycleState.ORG_ADMIN_ACTIVE ||
        state === LifecycleState.ORG_MEMBER_ACTIVE) {

        assertInvariant(
            !!lifecycle.orgId,
            "LIFECYCLE_ORG_REQUIRED",
            "This state requires an active organization",
            { state, orgId: lifecycle.orgId }
        );
    }

    if (state.endsWith("_ACTIVE")) {
        assertInvariant(
            hasWorkspace,
            "LIFECYCLE_ACTIVE_WORKSPACE_REQUIRED",
            "ACTIVE state requires hasWorkspace=true",
            { state, hasWorkspace }
        );
    }

    if (state.includes("_NO_WORKSPACE")) {
        assertInvariant(
            !hasWorkspace,
            "LIFECYCLE_NO_WORKSPACE_MISMATCH",
            "NO_WORKSPACE state requires hasWorkspace=false",
            { state, hasWorkspace }
        );
    }

    if (state.startsWith("ORG_OWNER_")) {
        assertInvariant(
            orgRole === "OWNER",
            "LIFECYCLE_OWNER_ROLE_MISMATCH",
            "ORG_OWNER state requires OWNER role",
            { state, orgRole }
        );
    }
}

export function resolveUserLifecycleState(
    databases: Databases,
    user: Models.User<Models.Preferences> | null
): Promise<ResolvedLifecycle> {
    const result = resolveUserLifecycleStateInternal(databases, user);

    if (result instanceof Promise) {
        return result.then(res => {
            validateLifecycleInvariant(res);
            return res;
        });
    }

    validateLifecycleInvariant(result as ResolvedLifecycle);
    return Promise.resolve(result as ResolvedLifecycle);
}
