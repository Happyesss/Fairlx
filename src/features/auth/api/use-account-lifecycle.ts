"use client";

import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { AccountLifecycleState } from "../types";

/**
 * Lifecycle routing information from the server.
 * This is the authoritative source for routing decisions.
 */
export interface LifecycleRouting {
    /** The computed lifecycle state enum value */
    state: string;
    /** Redirect target (null if no redirect needed) */
    redirectTo: string | null;
    /** Paths allowed in current state */
    allowedPaths: string[];
    /** Paths blocked in current state */
    blockedPaths: string[];
    /** True when the org's trial credit has expired */
    isTrialExpired: boolean;
    /** True when the org has been granted a trial credit (even if not yet expired) */
    trialCreditGranted: boolean;
    /** The date when the trial credit expires */
    trialCreditExpiresAt: string | null;
}

/**
 * Initial unresolved lifecycle state.
 * isLoaded: false indicates state has not been fetched yet.
 */
const INITIAL_LIFECYCLE_STATE: AccountLifecycleState = {
    isLoaded: false,
    isLoading: true,
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

/**
 * Initial routing state during loading.
 * CRITICAL: redirectTo is null to prevent false redirects during hydration.
 * LifecycleGuard will wait for isLoaded before making routing decisions.
 */
const INITIAL_ROUTING: LifecycleRouting = {
    state: "LOADING",
    redirectTo: null, // CRITICAL: No redirect during initial load
    allowedPaths: [],
    blockedPaths: [], // Don't block anything during initial load
    isTrialExpired: false,
    trialCreditGranted: false,
    trialCreditExpiresAt: null,
};


interface LifecycleQueryResult {
    data: AccountLifecycleState;
    lifecycle?: LifecycleRouting;
}

/**
 * Hook to fetch and manage account lifecycle state.
 * 
 * This is the primary hook for accessing lifecycle state on the client.
 * It fetches from /api/auth/lifecycle and caches the result.
 * 
 * Note: The query is disabled during SSR to prevent hydration issues.
 */
export const useGetAccountLifecycle = () => {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["account-lifecycle"],
        queryFn: async (): Promise<LifecycleQueryResult> => {
            const response = await client.api.auth.lifecycle.$get();

            if (!response.ok) {
                // If unauthorized, return unauthenticated state
                return {
                    data: {
                        ...INITIAL_LIFECYCLE_STATE,
                        isLoaded: true,
                        isLoading: false,
                    },
                    lifecycle: INITIAL_ROUTING,
                };
            }

            const result = await response.json();
            return result as LifecycleQueryResult;
        },
        // PERF: 0 staleTime — lifecycle should always be re-verified on significant actions.
        // This ensures that state transitions (like finishing onboarding) reflect immediately.
        staleTime: 0,
        // PERF: Keep previous data across remounts so LifecycleGuard can render
        // children immediately with cached data instead of showing skeleton.
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: true, // Re-verify status when coming back to app
        refetchOnMount: true, // Re-verify on every mount of the provider/hook
        refetchInterval: 1 * 60 * 1000, // Poll every 1 minute for background updates
        refetchIntervalInBackground: false, // Don't poll when tab is not focused
        retry: 1,
        // Disable query during SSR to prevent hydration mismatch
        enabled: typeof window !== "undefined",
    });

    const refreshLifecycle = async () => {
        await queryClient.invalidateQueries({ queryKey: ["account-lifecycle"] });
    };

    // PERF: Treat as "loaded" if we have ANY data (cached or fresh).
    // This lets the dashboard render immediately with cached lifecycle state.
    const hasData = !!query.data?.data;

    return {
        lifecycleState: query.data?.data ?? INITIAL_LIFECYCLE_STATE,
        /** New: Server-derived lifecycle routing */
        lifecycleRouting: query.data?.lifecycle ?? INITIAL_ROUTING,
        isLoaded: hasData,
        isLoading: query.isLoading && !hasData,
        isError: query.isError,
        refreshLifecycle,
    };
};
