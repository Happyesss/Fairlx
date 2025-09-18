"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ImageCarousel } from "@/components/auth/image-carousel";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  const pathname = usePathname();
  const isSignIn = pathname === "/sign-in";

  return (
    <main className="min-h-screen 
    bg-gradient-to-tr from-[rgb(15,15,15)] via-[rgb(0,0,0)] to-[rgb(40,40,40)] flex items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="w-full max-w-[1400px] h-[calc(100vh-2rem)] sm:h-[calc(100vh-3rem)] md:h-[calc(100vh-4rem)]">
        {/* <nav className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="logo" width={50} height={39} />
            <p className="font-bold text-lg">Scrumty</p>
          </div>
          <Button asChild variant="secondary">
            <Link href={isSignIn ? "/sign-up" : "/sign-in"}>
              {isSignIn ? "Sign Up" : "Login"}
            </Link>
          </Button>
        </nav> */}
        <div className="h-full">
          <div className="grid h-full md:grid-cols-[65fr_35fr] rounded-2xl sm:rounded-[24px] md:rounded-[32px] bg-white overflow-hidden">
            <div className="hidden md:block h-full relative">
              <ImageCarousel />
            </div>
            <div className="flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-10">
              <div className="w-full max-w-[420px]">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AuthLayout;
