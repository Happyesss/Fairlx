import { Models } from "node-appwrite";

/**
 * AccountLifecycleState - The single source of truth for account lifecycle.
 * 
 * isLoaded: Distinguishes between initial unresolved state (false) and fully resolved state (true).
 * Once isLoaded === true, no field should be undefined.
 */
export type AccountLifecycleState = {
    isLoaded: boolean;
    isLoading: boolean;
    isAuthenticated: boolean;
    hasUser: boolean;
    isEmailVerified: boolean;
    hasOrg: boolean;
    hasWorkspace: boolean;
    user: Models.User<Models.Preferences> | null;
    accountType: "PERSONAL" | "ORG" | null;
    activeMember: Models.Document | null;
    activeOrgId: string | null;
    /** Organization name (for display, e.g., during first login) */
    activeOrgName: string | null;
    /** Organization image URL (for display, e.g., during first login) */
    activeOrgImageUrl: string | null;
    activeWorkspaceId: string | null;
    /** If true, user must reset password on first login (ORG accounts) */
    mustResetPassword: boolean;
    /** User's role in the active organization (null for PERSONAL accounts) */
    orgRole: "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER" | null;
    /** If true, user must accept legal terms (overlay) */
    mustAcceptLegal: boolean;
    /** If true, user is blocked because org hasn't accepted legal terms */
    legalBlocked: boolean;
    /** True when the org's trial credit has expired */
    isTrialExpired: boolean;
    trialCreditGranted?: boolean;
    trialCreditExpiresAt?: string | null;
};

// Legacy alias for backward compatibility during migration
export type AccountState = AccountLifecycleState;
