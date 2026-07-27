"use client";

import React, { useMemo } from "react";

import { cn } from "@/lib/utils";
import { Settings, FolderKanban, Calendar, Building2 } from "lucide-react";
import Link from "next/link";
import {
  GoCheckCircle,
  GoCheckCircleFill,
  GoHome,
  GoHomeFill,
} from "react-icons/go";

import { usePathname } from "next/navigation";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { useAccountLifecycle } from "@/components/account-lifecycle-provider";
import { useCurrent } from "@/features/auth/api/use-current";
import { useGetWorkspaces } from "@/features/workspaces/api/use-get-workspaces";
import { AppRouteKey } from "@/lib/permissions/appRouteKeys";

/**
 * Navigation Component (Permission-Driven)
 * 
 * ARCHITECTURE:
 * - Routes are filtered by `allowedRouteKeys` received from server
 * - No client-side permission logic - just UI rendering
 * - If a route key is not in allowedRouteKeys, the route is hidden
 * 
 * INVARIANT:
 * - If user can SEE a navigation item, they CAN access the route
 * - Navigation visibility is purely based on allowedRouteKeys
 */

// ============================================================================
// ROUTE CONFIGURATION
// ============================================================================

interface RouteConfig {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  activeIcon: React.ComponentType<{ className?: string }>;
  /** Route key for permission-based filtering */
  routeKey: AppRouteKey;
  /** If true, route uses dashboard-level path (not workspace-prefixed) */
  orgRoute?: boolean;
  /** If true, requires active workspace context */
  workspaceScoped?: boolean;
}

/**
 * Navigation routes with their associated route keys
 */
const routes: RouteConfig[] = [
  {
    label: "Home",
    href: "",
    icon: GoHome,
    activeIcon: GoHomeFill,
    routeKey: AppRouteKey.WORKSPACE_HOME,
    workspaceScoped: true,
  },
  {
    label: "My Spaces",
    href: "/tasks",
    icon: GoCheckCircle,
    activeIcon: GoCheckCircleFill,
    routeKey: AppRouteKey.WORKSPACE_TASKS,
    workspaceScoped: true,
  },
  {
    label: "Programs",
    href: "/programs",
    icon: FolderKanban,
    activeIcon: FolderKanban,
    routeKey: AppRouteKey.WORKSPACE_PROGRAMS,
    workspaceScoped: true,
  },
  // Teams removed - now project-scoped via project header
  {
    label: "Timeline",
    href: "/timeline",
    icon: Calendar,
    activeIcon: Calendar,
    routeKey: AppRouteKey.WORKSPACE_TIMELINE,
    workspaceScoped: true,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    activeIcon: Settings,
    routeKey: AppRouteKey.WORKSPACE_SETTINGS,
    workspaceScoped: true,
  },
  {
    label: "Organization",
    href: "/organization",
    icon: Building2,
    activeIcon: Building2,
    routeKey: AppRouteKey.ORG_DASHBOARD,
    orgRoute: true, // Dashboard-level route
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export interface NavigationProps {
  /** Route keys the user is allowed to access (from server) */
  allowedRouteKeys?: AppRouteKey[];
  /** Whether user has any workspaces (for workspace-scoped routes) */
  hasWorkspaces?: boolean;
  /** Whether user has an org account */
  hasOrg?: boolean;
}

const NavigationInner = ({
  allowedRouteKeys,
  hasWorkspaces = true,
  hasOrg = false,
}: NavigationProps) => {
  const urlWorkspaceId = useWorkspaceId();
  const { lifecycleState: state } = useAccountLifecycle();
  const { activeWorkspaceId, hasOrg: contextHasOrg } = state;
  const { data: user } = useCurrent();
  const { data: workspacesData } = useGetWorkspaces();

  // Get user's default workspace preference
  const userPrefs = user?.prefs as { defaultWorkspaceId?: string } | undefined;
  const defaultWorkspaceId = userPrefs?.defaultWorkspaceId;

  // Use props if provided, otherwise fall back to context
  const effectiveHasOrg = hasOrg || contextHasOrg;

  // Determine the workspace ID to use for navigation:
  // Priority: 1) URL workspace ID, 2) User's default workspace, 3) First workspace, 4) Active workspace from context
  const selectedWorkspaceId = useMemo(() => {
    const wsList = workspacesData?.documents || [];
    if (urlWorkspaceId) return urlWorkspaceId;

    if (defaultWorkspaceId) {
      // Validate that default workspace exists
      const defaultExists = wsList.some(w => w.$id === defaultWorkspaceId);
      if (defaultExists) return defaultWorkspaceId;
    }

    if (wsList.length > 0) {
      return wsList[0].$id;
    }

    return activeWorkspaceId || "";
  }, [urlWorkspaceId, defaultWorkspaceId, workspacesData, activeWorkspaceId]);

  const projectId = useProjectId();
  const pathname = usePathname();

  // Determine if workspace context is available
  // Use selectedWorkspaceId (URL or context) as the source of truth, not just hasWorkspaces prop
  // This fixes the issue where hasWorkspaces might be false during loading but URL has workspace ID
  const hasWorkspaceContext = hasWorkspaces || !!selectedWorkspaceId;

  // STRICT AUTHORITY: Use allowedRouteKeys provided by server.
  // We do NOT implement client-side overrides for Owners here.
  // The server implementation of resolveUserAccess handles Owner permissions correctly.

  // MEMOIZED: Filter routes based on allowed route keys (STRICT MODE - no fallback)
  const visibleRoutes = useMemo(() => routes.filter((route: RouteConfig) => {
    // When server returned access (including empty []), enforce allowlist strictly.
    // undefined = still resolving — hide workspace-scoped routes as a safe fallback.
    if (allowedRouteKeys !== undefined) {
      if (!allowedRouteKeys.includes(route.routeKey)) return false;
    } else if (route.workspaceScoped) {
      return false;
    }

    // Workspace-scoped routes require workspace context (from URL or lifecycle)
    if (route.workspaceScoped && !hasWorkspaceContext) return false;

    // Org routes only show for org accounts
    if (route.orgRoute && !effectiveHasOrg) return false;

    return true;
  }), [allowedRouteKeys, hasWorkspaceContext, effectiveHasOrg]);

  return (
    <div className="px-3 pt-4 pb-2 flex-shrink-0">
      <p className="text-[11px] font-semibold tracking-wider uppercase text-sidebar-foreground/50 pl-2.5 mb-2">Core Pages</p>
      <ul className="flex flex-col gap-0.5">
        {visibleRoutes.map((item) => {
          // Determine the correct href based on route type
          let fullHref: string;
          let isActive: boolean;

          if (item.orgRoute) {
            // Org-level routes: dashboard-level, no workspace prefix
            fullHref = item.href;
            isActive = pathname === item.href || pathname?.startsWith(item.href + "/") || false;
          } else {
            // Workspace-scoped routes require an ID
            if (!selectedWorkspaceId) return null;

            if (item.href === "/timeline") {
              // Timeline: pass workspaceId and projectId as search params for SSR
              fullHref = `/workspaces/${selectedWorkspaceId}${item.href}?workspaceId=${selectedWorkspaceId}${projectId ? `&projectId=${projectId}` : ""}`;
            } else {
              // Standard workspace-scoped routes
              fullHref = `/workspaces/${selectedWorkspaceId}${item.href}`;
            }
            isActive = pathname === `/workspaces/${selectedWorkspaceId}${item.href}`;
          }

          const Icon = isActive ? item.activeIcon : item.icon;

          return (
            <div key={item.routeKey}>
              <Link href={fullHref} prefetch>
                <div
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-md font-medium hover:bg-sidebar-accent hover:text-sidebar-foreground transition text-sidebar-foreground/70",
                    isActive && "bg-sidebar-accent shadow-sm hover:opacity-100 text-sidebar-foreground"
                  )}
                >
                  <Icon className={cn("size-[17px]", isActive && "text-primary")} />
                  <p className="text-[12px] tracking-tight font-medium">
                    {item.label}
                  </p>
                </div>
              </Link>
            </div>
          );
        })}
      </ul>
    </div>
  );
};

export const Navigation = React.memo(NavigationInner);
