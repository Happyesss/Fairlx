"use client";

import Image from "next/image";
import Link from "next/link";

import { Navigation } from "./navigation";
import { Rocket } from "lucide-react";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { Projects } from "./projects";
import { ProjectTools } from "./project-tools";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { Spaces } from "./spaces";
import { Tools } from "./tools";
import { useAccountLifecycle } from "@/components/account-lifecycle-provider";
import { useUserAccess } from "@/hooks/use-user-access";

/**
 * Sidebar Component (Permission-Driven)
 * 
 * ARCHITECTURE:
 * - Fetches user access from useUserAccess hook
 * - Passes allowedRouteKeys to Navigation
 * - No client-side permission logic beyond routing
 * 
 * INVARIANT:
 * - Navigation items shown = routes user can access
 */
export const Sidebar = () => {
  const { lifecycleState: state, isRestrictedOrgMember } = useAccountLifecycle();
  const { hasWorkspace, hasOrg, activeWorkspaceId } = state;
  const urlWorkspaceId = useWorkspaceId();
  const { allowedRouteKeys, isLoading: isAccessLoading } = useUserAccess();

  // Only show workspace content if we have a workspace ID (URL or global)
  const showWorkspaceContent = !!(urlWorkspaceId || activeWorkspaceId);

  // ============================================================
  // LOADING STATE: Show friendly UI while permissions resolve
  // ============================================================
  if (isAccessLoading && hasOrg) {
    return (
      <aside className="h-full bg-sidebar w-full overflow-hidden border-r border-sidebar-border flex flex-col">
        <div className="flex items-center w-full py-5 px-4 border-b border-sidebar-border flex-shrink-0">
          <Link href="/welcome">
            <Image src="/Logo.png" className="object-contain" alt="logo" width={80} height={90} />
          </Link>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden p-4">
          <div className="text-center text-sm text-muted-foreground space-y-2">
            <p className="font-medium">Loading workspace...</p>
            <p className="text-xs">Setting up your navigation</p>
          </div>
        </div>

        <div className="flex-shrink-0">
          <WorkspaceSwitcher />
        </div>
      </aside>
    );
  }

  // ============================================================
  // RESTRICTED ORG MEMBER: Hide ALL workspace UI
  // ============================================================
  if (isRestrictedOrgMember) {
    return (
      <aside className="h-full bg-sidebar w-full overflow-hidden border-r border-sidebar-border flex flex-col">
        <div className="flex items-center w-full py-5 px-4 border-b border-sidebar-border flex-shrink-0">
          <Link href="/welcome">
            <Image src="/Logo.png" className="object-contain" alt="logo" width={80} height={90} />
          </Link>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden p-4">
          <div className="text-center text-sm text-muted-foreground space-y-4">
            <p className="font-medium">Waiting for Access</p>
            <p>An admin will assign you to a workspace soon.</p>
            <Link
              href="/profile"
              className="inline-block mt-4 text-primary hover:underline"
            >
              Complete your profile →
            </Link>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside id="sidebar" className="h-full bg-sidebar w-full overflow-hidden border-r border-sidebar-border flex flex-col">
      <div className="flex items-center w-full py-5 px-4 border-b border-sidebar-border flex-shrink-0">
        <Link href={hasWorkspace ? "/" : "/welcome"} className="flex items-center">
          <Image src="/Logo.png" className="object-contain" alt="logo" width={80} height={90} />
        </Link>
      </div>

      <div id="sidebar-nav" className="flex flex-col flex-1 overflow-hidden overflow-y-auto">
        {/* Navigation: Pass allowed route keys from server */}
        {/* Show navigation if user has org/workspace OR if they're on a workspace URL */}
        {(hasOrg || hasWorkspace || showWorkspaceContent) && (
          <Navigation
            allowedRouteKeys={isAccessLoading ? undefined : allowedRouteKeys}
            hasWorkspaces={hasWorkspace}
            hasOrg={hasOrg}
          />
        )}

        {/* Workspace-scoped content: Only shown when a workspace is active */}
        {showWorkspaceContent && (
          <>
            <Tools />
            <Projects />
            <ProjectTools />
            <Spaces />
          </>
        )}

        {/* Empty state: Only for PERSONAL accounts with no workspaces */}
        {!hasWorkspace && !hasOrg && !showWorkspaceContent && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <p className="mb-2">No workspaces yet</p>
            <p>Create a workspace to get started</p>
          </div>
        )}

        {/* Help & Support */}
        <div className="px-3 pt-6 pb-2">
          <p className="text-[11px] font-semibold tracking-wider uppercase text-sidebar-foreground/50 pl-2.5 mb-2">Help</p>
          <button 
            onClick={() => (window as Window & { startAppTour?: () => void }).startAppTour?.()}
            className="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-md font-medium hover:bg-sidebar-accent hover:text-sidebar-foreground transition text-sidebar-foreground/70"
          >
            <Rocket className="size-[17px]" />
            <p className="text-[12px] tracking-tight font-medium">Restart App Tour</p>
          </button>
        </div>

        {/* ORG OWNER/ADMIN with no workspaces - show guidance */}
        {!hasWorkspace && hasOrg && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <p className="mb-2">Ready to start</p>
            <p>Create a workspace or manage your organization</p>
          </div>
        )}
      </div>

      <div className="flex-shrink-0">
        <WorkspaceSwitcher />
      </div>
    </aside>
  );
};
