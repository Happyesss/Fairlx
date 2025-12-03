"use client";

import { cn } from "@/lib/utils";
import { Settings, User, FolderKanban, Users2, Calendar, Clock as ClockIcon, Activity } from "lucide-react";
import Link from "next/link";
import {
  GoCheckCircle,
  GoCheckCircleFill,
  GoHome,
  GoHomeFill,
} from "react-icons/go";

import { usePathname } from "next/navigation";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useProjectId } from "@/features/projects/hooks/use-project-id";

const routes = [
  {
    label: "Home",
    href: "",
    icon: GoHome,
    activeIcon: GoHomeFill,
  },
  {
    label: "My Space",
    href: "/tasks",
    icon: GoCheckCircle,
    activeIcon: GoCheckCircleFill,
  },
  {
    label: "Programs",
    href: "/programs",
    icon: FolderKanban,
    activeIcon: FolderKanban,
  },
  {
    label: "Teams",
    href: "/teams",
    icon: Users2,
    activeIcon: Users2,
  },
  {
    label: "Timeline",
    href: "/timeline",
    icon: Calendar,
    activeIcon: Calendar,
  },
  {
    label: "Time Tracking",
    href: "/time-tracking",
    icon: ClockIcon,
    activeIcon: ClockIcon,
  },
  {
    label: "Audit Log",
    href: "/audit-logs",
    icon: Activity,
    activeIcon: Activity,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    activeIcon: Settings,
  },
  {
    label: "Members",
    href: "/members",
    icon: User,
    activeIcon: User,
  },
];

export const Navigation = () => {
  const workspaceId = useWorkspaceId();
  const projectId = useProjectId();
  const pathname = usePathname();
  const { isAdmin } = useCurrentMember({ workspaceId });

  // Filter routes based on permissions
  const visibleRoutes = routes.filter(route => {
    // Hide Settings for non-admins
    if (route.label === "Settings" && !isAdmin) return false;
    return true;
  });

  return (
    <div className="p-3 border-b-[1.5px] border-neutral-200 flex-shrink-0">
      <ul className="flex flex-col ">
        {visibleRoutes.map((item) => {
          // For timeline, pass workspaceId and projectId (if available) as search params for SSR
          const fullHref = item.href === "/timeline"
            ? `/workspaces/${workspaceId}${item.href}?workspaceId=${workspaceId}${projectId ? `&projectId=${projectId}` : ""}`
            : `/workspaces/${workspaceId}${item.href}`;
          const isActive = pathname === `/workspaces/${workspaceId}${item.href}`;
          const Icon = isActive ? item.activeIcon : item.icon;

          return (
            <div key={item.href}>

              <Link href={fullHref}>
                <div
                  className={cn(
                    "flex items-center gap-2.5 p-2.5 rounded-md font-medium  transition text-neutral-500",
                    isActive && "bg-neutral-200 shadow-sm hover:opacity-100 text-primary"
                  )}
                >
                  <Icon className={cn("size-5 text-neutral-500", isActive && "text-primary")} />
                  <p className="text-[13px] tracking-tight font-medium">
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
