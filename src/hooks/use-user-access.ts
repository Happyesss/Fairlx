"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccountLifecycle } from "@/components/account-lifecycle-provider";
import { AppRouteKey } from "@/lib/permissions/appRouteKeys";
import { resolveClientNavRouteKeys } from "@/lib/permissions/visible-nav-routes";

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
        queryKey: ["user-access", "membership-v2", activeOrgId, activeWorkspaceId],
        queryFn: async () => {
            // Resolve org access whenever we have an org id. Prefs/hasOrg can lag
            // behind membership and must not skip the Organization allowlist.
            if (!activeOrgId) {
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

    // Loading: optimistic defaults so nav isn't empty.
    // OWNER always keeps org admin routes even if the access API still
    // thinks the account is personal (prefs lag behind membership).
    const resolvedRouteKeys = resolveClientNavRouteKeys({
        isLoading: query.isLoading,
        serverKeys: query.data?.allowedRouteKeys,
        hasOrg,
        orgRole,
    });

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

