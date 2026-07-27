"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccountLifecycle } from "@/components/account-lifecycle-provider";
import { AppRouteKey, getOrgRouteKeys, getWorkspaceIndependentRouteKeys } from "@/lib/permissions/appRouteKeys";

/**
 * Hook to get user access (allowed route keys) for client-side navigation
 * 
 * ARCHITECTURE:
 * - Fetches access from the server via API
 * - Caches result in react-query
 * - Returns allowed route keys for navigation filtering
 * 
 * NOTE: This is for client-side UI rendering only.
 * Server-side route guards are the authoritative check.
 */

interface UserAccessResponse {
    allowedRouteKeys: AppRouteKey[];
    isOwner: boolean;
    role: string | null;
    departmentIds: string[];
    hasDepartmentAccess: boolean;
}

export function useUserAccess() {
    const { lifecycleState } = useAccountLifecycle();
    const { activeOrgId, activeWorkspaceId, hasOrg, orgRole } = lifecycleState;

    const query = useQuery<UserAccessResponse>({
        queryKey: ["user-access", activeOrgId, activeWorkspaceId],
        queryFn: async () => {
            // For PERSONAL accounts (no org), return full workspace access
            if (!hasOrg || !activeOrgId) {
                return {
                    allowedRouteKeys: [
                        AppRouteKey.PROFILE,
                        AppRouteKey.PROFILE_ACCOUNT,
                        AppRouteKey.PROFILE_PASSWORD,
                        AppRouteKey.WELCOME,
                        AppRouteKey.WORKSPACES,
                        AppRouteKey.WORKSPACE_CREATE,
                        AppRouteKey.WORKSPACE_HOME,
                        AppRouteKey.WORKSPACE_TASKS,
                        AppRouteKey.WORKSPACE_TEAMS,
                        AppRouteKey.WORKSPACE_PROGRAMS,
                        AppRouteKey.WORKSPACE_TIMELINE,
                        AppRouteKey.WORKSPACE_SETTINGS,
                        AppRouteKey.WORKSPACE_SPACES,
                        AppRouteKey.WORKSPACE_PROJECTS,
                    ],
                    isOwner: false,
                    role: null,
                    departmentIds: [],
                    hasDepartmentAccess: false,
                };
            }

            // Fetch access from server
            const response = await fetch(`/api/user-access?organizationId=${activeOrgId}${activeWorkspaceId ? `&workspaceId=${activeWorkspaceId}` : ""}`);

            if (!response.ok) {
                throw new Error("Failed to fetch user access");
            }

            return response.json();
        },
        staleTime: 5 * 60 * 1000, // 5 minutes — permissions rarely change mid-session
        gcTime: 15 * 60 * 1000, // 15 minutes
        refetchOnWindowFocus: false, // DISABLED — was causing unnecessary reads on alt-tab
        refetchOnReconnect: true, // Auto-refresh on network reconnect
        enabled: true, // Always run, but behavior changes based on account type
    });

    // During loading, provide sensible defaults based on role
    // OWNER always has full access, so this is safe to pre-populate
    // For non-owners, we provide workspace routes as fallback so navigation isn't empty during load
    const loadingDefaults: AppRouteKey[] = orgRole === "OWNER"
        ? [...getOrgRouteKeys(), ...getWorkspaceIndependentRouteKeys()]
        : [
            // Provide basic workspace navigation as fallback during loading
            AppRouteKey.WORKSPACE_HOME,
            AppRouteKey.WORKSPACE_TASKS,
            AppRouteKey.WORKSPACE_TEAMS,
            AppRouteKey.WORKSPACE_PROGRAMS,
            AppRouteKey.WORKSPACE_TIMELINE,
            AppRouteKey.WORKSPACE_SETTINGS,
        ];

    // Loading: optimistic defaults so nav isn't empty.
    // Loaded (including empty []): use server truth — empty means no org route access.
    const resolvedRouteKeys = query.isLoading
        ? loadingDefaults
        : (query.data?.allowedRouteKeys ?? []);

    return {
        allowedRouteKeys: resolvedRouteKeys,
        isOwner: query.data?.isOwner ?? (orgRole === "OWNER"),
        role: query.data?.role ?? orgRole,
        departmentIds: query.data?.departmentIds ?? [],
        hasDepartmentAccess: query.data?.hasDepartmentAccess ?? (orgRole === "OWNER"),
        isLoading: query.isLoading,
        error: query.error,
    };
}

