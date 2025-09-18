"use client";

import { usePathname } from "next/navigation";
import { SearchIcon, BellIcon, SettingsIcon } from "lucide-react";

import { UserButton } from "@/features/auth/components/user-button";

import { MobileSidebar } from "./mobile-sidebar";
import { ThemeToggle } from "./theme-toggle";
import { Input } from "./ui/input";

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

  const { title, description } = pathnameMap[pathnameKey] || defaultMap;

  return (
    <nav className="pt-4 px-6 flex items-center gap-4 justify-between">
      <div className="flex items-center gap-3">
        <MobileSidebar />
        <div className="hidden lg:flex flex-col">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="flex-1 max-w-xl w-full hidden md:flex items-center">
        <div className="relative w-full">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
          <Input
            placeholder="Search"
            className="pl-9 bg-white border-neutral-200 text-neutral-900 placeholder:text-neutral-500 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-200 dark:placeholder:text-neutral-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
          <BellIcon className="size-5" />
        </button>
        <button className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
          <SettingsIcon className="size-5" />
        </button>
        <UserButton />
      </div>
    </nav>
  );
};
