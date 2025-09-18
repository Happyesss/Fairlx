import Image from "next/image";
import Link from "next/link";

import { DottedSeparator } from "./dotted-separator";
import { Navigation } from "./navigation";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { Projects } from "./projects";

export const Sidebar = () => {
  return (
    <aside className="h-full bg-neutral-950 border-r border-neutral-900 p-4 w-full text-neutral-300">
      <div className="flex items-center gap-2">
        <Link href="/">
          <Image src="/logo.png" alt="logo" width={50} height={39} />
        </Link>
        <p className="font-bold text-lg text-neutral-100">Scrumty</p>
      </div>
      <DottedSeparator className="my-4 opacity-20" />
      <WorkspaceSwitcher />
      <DottedSeparator className="my-4 opacity-20" />
      <Navigation />
      <DottedSeparator className="my-4 opacity-20" />
      <Projects />
    </aside>
  );
};
