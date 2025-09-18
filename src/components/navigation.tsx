"use client";

import { cn } from "@/lib/utils";
import { SettingsIcon, UsersIcon, ClockIcon } from "lucide-react";
import Link from "next/link";
import {
  GoCheckCircle,
  GoCheckCircleFill,
  GoHome,
  GoHomeFill,
} from "react-icons/go";

import { usePathname } from "next/navigation";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

const routes = [
  {
    label: "Home",
    href: "",
    icon: GoHome,
    activeIcon: GoHomeFill,
  },
  {
    label: "My Tasks",
    href: "/tasks",
    icon: GoCheckCircle,
    activeIcon: GoCheckCircleFill,
  },
  {
    label: "Time Tracking",
    href: "/time-tracking",
    icon: ClockIcon,
    activeIcon: ClockIcon,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: SettingsIcon,
    activeIcon: SettingsIcon,
  },
  {
    label: "Members",
    href: "/members",
    icon: UsersIcon,
    activeIcon: UsersIcon,
  },
];

export const Navigation = () => {
  const workspaceId = useWorkspaceId();
  const pathname = usePathname();

  return (
    <ul className="flex flex-col">
      {routes.map((item) => {
        const fullHref = `/workspaces/${workspaceId}${item.href}`;
        const isActive = pathname === fullHref;
        const Icon = isActive ? item.activeIcon : item.icon;

        return (
          <Link key={item.href} href={fullHref}>
            <div
              className={cn(
                "flex items-center gap-2.5 p-2.5 rounded-md font-medium text-neutral-300 hover:bg-neutral-900 hover:text-neutral-100 transition",
                isActive && "bg-neutral-900 text-neutral-100"
              )}
            >
              <Icon className="size-5 text-neutral-400" />
              {item.label}
            </div>
          </Link>
        );
      })}
    </ul>
  );
};
