"use client";

import { UserButton } from "@/features/auth/components/user-button";
import { NotificationBell } from "@/features/notifications";

import { usePathname } from "next/navigation";

import { MobileSidebar } from "./mobile-sidebar";
import { Breadcrumb } from "./breadcrumb";
import { ModeToggle } from "./mode-toggle";

const pathnameMap = {
  tasks: {
    title: "My Tasks",
    description: "View all of your tasks here.",
  },
  projects: {
    title: "My Project",
    description: "View tasks of your project here.",
  },
  "time-tracking": {
    title: "Time Tracking",
    description: "Track time, view timesheets, and analyze estimates vs actuals.",
  },
};

const defaultMap = {
  title: "Home",
  description: "Monitor all of your projects and tasks here.",
};

export const Navbar = () => {
  const pathname = usePathname();
  const pathnameParts = pathname.split("/");
  const pathnameKey = pathnameParts[3] as keyof typeof pathnameMap;

  const { title } = pathnameMap[pathnameKey] || defaultMap;

  return (
    <nav id="navbar" className="h-[73px] px-6 flex items-center border-b border-border sticky top-0 z-10 bg-background justify-between w-full">
      <div className="flex flex-col">
        <div className="hidden lg:flex">
          <Breadcrumb />
        </div>
        <div className="flex lg:hidden">
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
      </div>
      <div id="navbar-actions" className="flex items-center gap-2">
        <MobileSidebar />
        <ModeToggle />
        <NotificationBell />
        <UserButton />
      </div>
    </nav>
  );
};
