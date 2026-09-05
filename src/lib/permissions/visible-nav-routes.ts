import { AppRouteKey, getOrgRouteKeys, getWorkspaceIndependentRouteKeys } from "./appRouteKeys";

const OWNER_LOADING_ROUTES: AppRouteKey[] = [
    ...getOrgRouteKeys(),
    ...getWorkspaceIndependentRouteKeys(),
];

const MEMBER_LOADING_ROUTES: AppRouteKey[] = [
    AppRouteKey.WORKSPACE_HOME,
    AppRouteKey.WORKSPACE_TASKS,
    AppRouteKey.WORKSPACE_TEAMS,
    AppRouteKey.WORKSPACE_PROGRAMS,
    AppRouteKey.WORKSPACE_TIMELINE,
    AppRouteKey.WORKSPACE_SPACES,
    AppRouteKey.WORKSPACE_PROJECTS,
];

/**
 * Prefs.accountType can stay PERSONAL after the user becomes an org member.
 * When the client already has an organizationId, resolve org access — never
 * the personal allowlist (which omits Organization).
 */
export function shouldResolvePersonalNavAccess(organizationId?: string | null): boolean {
    return !String(organizationId ?? "").trim();
}

/**
 * OWNER always sees organization admin routes. Server allowlists can lag
 * (stale prefs, personal fallback) and must not hide Organization in the sidebar.
 */
export function mergeOwnerOrgRoutes(
    routeKeys: AppRouteKey[],
    options: { hasOrg: boolean; orgRole: string | null },
): AppRouteKey[] {
    if (!options.hasOrg || options.orgRole !== "OWNER") return routeKeys;
    return [...new Set([...routeKeys, ...getOrgRouteKeys()])];
}

export function resolveClientNavRouteKeys(options: {
    isLoading: boolean;
    serverKeys?: AppRouteKey[];
    hasOrg: boolean;
    orgRole: string | null;
}): AppRouteKey[] {
    const base = options.isLoading
        ? (options.orgRole === "OWNER" ? OWNER_LOADING_ROUTES : MEMBER_LOADING_ROUTES)
        : (options.serverKeys ?? []);
    return mergeOwnerOrgRoutes(base, {
        hasOrg: options.hasOrg,
        orgRole: options.orgRole,
    });
}
