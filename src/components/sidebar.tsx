"use client"

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Navigation } from "./navigation";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { Projects } from "./projects";
import { LayoutDashboard, Settings, User } from "lucide-react";
import { Button } from "./ui/button";

export const Sidebar = () => {
  const pathname = usePathname();
  const isDashboardPage = pathname === "/dashboard";

  const dashboardNavItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Settings",
      href: "/settings",
      icon: Settings,
    },
    {
      title: "Profile",
      href: "/profile",
      icon: User,
    },
  ];

  if (isDashboardPage) {
    return (
      <aside className="h-full bg-neutral-50 w-full overflow-hidden border-r-[1.5px] border-neutral-200 flex flex-col">
        <div className="flex items-center w-full py-5 px-4 border-b-[1.5px] border-neutral-200 flex-shrink-0">
          <Link href="/" >
            <Image src="/Logo.png" className="object-contain" alt="logo" width={80} height={90} />
          </Link>
        </div>

        <div className="flex flex-col flex-1 p-4 space-y-2">
          {dashboardNavItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={pathname === item.href ? "primary" : "ghost"}
                className="w-full justify-start gap-2"
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Button>
            </Link>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="h-full bg-neutral-50 w-full overflow-hidden border-r-[1.5px] border-neutral-200 flex flex-col">
      <div className="flex items-center w-full py-5 px-4 border-b-[1.5px] border-neutral-200 flex-shrink-0">
        <Link href="/" >
          <Image src="/Logo.png" className="object-contain" alt="logo" width={80} height={90} />
        </Link>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        <Navigation />
        <Projects />
      </div>

      <div className="flex-shrink-0">
        <WorkspaceSwitcher />
      </div>
    </aside>
  );
};
