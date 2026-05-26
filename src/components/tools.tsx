"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Clock as ClockIcon, Activity, CreditCard, User, Gift } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { useAccountLifecycle } from "@/components/account-lifecycle-provider";
import { useCurrentUserOrgPermissions } from "@/features/org-permissions/api/use-current-user-permissions";
import { OrgPermissionKey } from "@/features/org-permissions/types";

interface ToolItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  orgOnly?: boolean;
  orgAdminOnly?: boolean;
  orgRoute?: boolean;
}

export const Tools = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { lifecycleState: state } = useAccountLifecycle();
  const { hasOrg, activeOrgId, activeWorkspaceId } = state;
  const urlWorkspaceId = useWorkspaceId();

  // Use URL workspaceId if available, fallback to global active workspaceId
  const workspaceId = (urlWorkspaceId || activeWorkspaceId || "") as string;

  const { isAdmin } = useCurrentMember({ workspaceId });

  // Org-level permissions from departments (single source of truth)
  const { hasPermission } = useCurrentUserOrgPermissions({
    orgId: (activeOrgId || "") as string
  });
  const canViewAudit = hasPermission(OrgPermissionKey.AUDIT_VIEW);

  const [isExpanded, setIsExpanded] = useState(true);

  const tools: ToolItem[] = [
    {
      label: "Time Tracking",
      href: "/time-tracking",
      icon: <ClockIcon className="size-4" />,
    },
    {
      label: "Audit Log",
      href: "/audit-logs",
      icon: <Activity className="size-4" />,
    },
    {
      label: "Billing",
      href: "/billing",
      icon: <CreditCard className="size-4" />,
      adminOnly: true,
    },
    {
      label: "Rewards",
      href: "/rewards",
      icon: <Gift className="size-4" />,
    },
    {
      label: "WS Members",
      href: "/members",
      icon: <User className="size-4" />,
    },
  ];

  // Filter tools based on permissions
  const visibleTools = tools.filter(tool => {
    // Workspace-level admin check for general admin tools
    if (tool.adminOnly && !isAdmin) return false;
    if (tool.orgOnly && !hasOrg) return false;
    // Use department-based permissions for org admin checks
    if (tool.orgAdminOnly && !canViewAudit) return false;

    // For org accounts: Hide Billing and Rewards from sidebar
    // These are accessible on the Organization settings page
    if (hasOrg && (tool.label === "Billing" || tool.label === "Rewards")) {
      return false;
    }
    return true;
  });

  // Don't show the section if no tools are visible
  if (visibleTools.length === 0) {
    return null;
  }

  const handleToolClick = (tool: ToolItem) => {
    let fullHref: string;

    if (tool.orgRoute) {
      fullHref = tool.href;
    } else {
      if (!workspaceId) return;
      fullHref = `/workspaces/${workspaceId}${tool.href}`;
    }

    router.push(fullHref);
  };

  const isToolActive = (tool: ToolItem): boolean => {
    let targetPath: string;

    if (tool.orgRoute) {
      targetPath = tool.href;
    } else {
      targetPath = `/workspaces/${workspaceId}${tool.href}`;
    }

    return pathname === targetPath;
  };

  return (
    <div className="flex flex-col px-3 py-3 border-t border-sidebar-border">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-[11px] tracking-wider uppercase font-semibold pl-2.5 text-sidebar-foreground/50 hover:text-sidebar-foreground/70 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          Tools
        </button>
      </div>

      <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-96' : 'max-h-0'}`}>
        <div className="space-y-0.5 mt-2 pl-3">
          {visibleTools.map((tool) => {
            const isActive = isToolActive(tool);
            return (
              <button
                key={tool.label}
                onClick={() => handleToolClick(tool)}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors w-full",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70"
                )}
              >
                <span className={cn("flex-shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/60")}>
                  {tool.icon}
                </span>
                <span className="truncate text-xs font-medium">{tool.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
