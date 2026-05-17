"use client";

import { Sidebar } from "@/components/sidebar";
import { Navbar } from "@/components/navbar";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex w-full h-screen">
        {/* Sidebar */}
        <div className="fixed left-0 top-0 hidden lg:block lg:w-[264px] h-full overflow-y-auto">
          <Sidebar />
        </div>

        {/* Main content area */}
        <div className="lg:pl-[264px] w-full flex flex-col min-h-screen">
          <Navbar />
          <div className="flex-1 overflow-y-auto bg-background">
            <main className="flex flex-col py-8 px-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
