'use client';
import { usePathname } from "next/navigation";
import { CreateProjectModal } from "@/features/projects/components/create-project-modal";
import { CreateWorkspaceModal } from "@/features/workspaces/components/create-workspace-modal";
import { CreateTaskModal } from "@/features/tasks/components/create-task-modal";
import { EditTaskModal } from "@/features/tasks/components/edit-task-modal";
import { TaskDetailsModalWrapper } from "@/features/tasks/components/task-details-modal-wrapper";
import { CreateCustomColumnModalWrapper } from "@/features/custom-columns/components/create-custom-column-modal-wrapper";
import { ManageColumnsModalWrapper } from "@/features/custom-columns/components/manage-columns-modal-wrapper";
import { CreateTeamModal } from "@/features/teams/components/create-team-modal";
import { EditTeamModal } from "@/features/teams/components/edit-team-modal";
import { CreateProgramModal } from "@/features/programs/components/create-program-modal";
import { EditProgramModal } from "@/features/programs/components/edit-program-modal";
import { ProjectAIChatWrapper } from "@/features/project-docs/components";

import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { ProfileSidebar } from "@/components/ProfileSidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const pathname = usePathname();
  const isProfilePage = pathname === "/profile" || pathname.startsWith("/profile/");

  return (
    <div className="min-h-screen">
      <CreateWorkspaceModal />
      <CreateProjectModal />
      <CreateTaskModal />
      <EditTaskModal />
      <TaskDetailsModalWrapper />
      <CreateCustomColumnModalWrapper />
      <ManageColumnsModalWrapper />
      <CreateTeamModal />
      <EditTeamModal />
      <CreateProgramModal />
      <EditProgramModal />

      <div className="flex w-full h-screen">
        <div className="fixed left-0 top-0 hidden lg:block lg:w-[264px] h-full overflow-y-auto">
          {isProfilePage ? <ProfileSidebar /> : <Sidebar />}
        </div>
        <div className="lg:pl-[264px] w-full h-full flex flex-col">
          <Navbar />
          <div className="flex-1 overflow-y-scroll">
            <div className="mx-auto max-w-screen-2xl">
              <main className="py-8 px-6 flex flex-col overflow-y-scroll">
                {children}
              </main>
            </div>
          </div>
        </div>
      </div>

      {/* Project AI Chat - floating button, only shows on project pages */}
      <ProjectAIChatWrapper />
    </div>
  );
};

export default DashboardLayout;
