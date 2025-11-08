"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Settings, Home, User } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

interface DashboardSidebarProps {
  className?: string
}

export const DashboardSidebar = ({ className }: DashboardSidebarProps) => {
  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Home,
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
    },
    {
      name: "Profile",
      href: "/profile",
      icon: User,
    },
  ]

  return (
    <div className={cn("pb-12 border-r min-h-screen", className)}>
      <div className="space-y-4 py-4">
        <div className="px-4 py-2">
          <Link href="/">
            <Image src="/logo.svg" width={32} height={32} alt="Logo" />
          </Link>
        </div>
        <div className="px-3">
          <ScrollArea className="h-[calc(100vh-8rem)]">
            <div className="space-y-1">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}