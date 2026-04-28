"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ModeToggle } from "@/components/mode-toggle";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  const pathname = usePathname();
  const isOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/");

  // For onboarding pages, use a completely clean full-screen layout (no header)
  if (isOnboarding) {
    return (
      <main className="min-h-screen">
        {children}
      </main>
    );
  }

  // New Plane-inspired auth layout for sign-in/sign-up pages
  return (
    <main className="flex min-h-screen flex-col bg-background transition-colors duration-300">
      {/* Top Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 md:px-10">
        <Link href="/" className="flex items-center gap-2.5 text-foreground no-underline">
          <Image src="/Logo.png" alt="Fairlx" width={70} height={32} />
        </Link>
        <div className="flex items-center gap-3">
          <ModeToggle />

        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex flex-1 items-center justify-center px-6 ">
        <div className="w-full max-w-[440px]">
          {children}
        </div>
      </div>

    </main>
  );
};

export default AuthLayout;
