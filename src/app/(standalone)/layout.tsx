import Image from "next/image";
import Link from "next/link";

import { UserButton } from "@/features/auth/components/user-button";

interface StandaloneLayoutProps {
  children: React.ReactNode;
}

const StandaloneLayout = ({ children }: StandaloneLayoutProps) => {
  return (
    <main className="bg-neutral-100 min-h-screen">
      <div className="mx-auto max-w-screen-2xl p-4">
        <nav className="flex justify-between items-center h-[73px]">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Image src="/Logo.png" alt="logo" width={50} height={39} />
            </Link>
            <p className="font-bold text-lg">Fairlx</p>
          </div>
          <UserButton />
        </nav>
        <div className="flex flex-col items-center justify-center py-4">
          {children}
        </div>
      </div>
    </main>
  );
};

export default StandaloneLayout;
