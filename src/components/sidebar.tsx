import Image from "next/image";
import Link from "next/link";

import { Navigation } from "./navigation";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { Projects } from "./projects";

export const Sidebar = () => {
  return (
    <aside className="h-full bg-neutral-50 w-full overflow-hidden border-r-[1.5px] border-neutral-200 flex flex-col">
      <div className="flex items-center w-full py-5 px-4 border-b-[1.5px] border-neutral-200 flex-shrink-0">
        <Link href="/" >
          <Image src="/Logo.png" className="object-contain " alt="logo" width={80} height={90} />
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
