'use client';

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import dynamic from "next/dynamic";

// Dynamically import all modals to keep the main bundle light
const CreateProjectModal = dynamic(() => import("@/features/projects/components/create-project-modal").then(mod => mod.CreateProjectModal), { ssr: false });
const CreateWorkspaceModal = dynamic(() => import("@/features/workspaces/components/create-workspace-modal").then(mod => mod.CreateWorkspaceModal), { ssr: false });
const CreateWorkItemModal = dynamic(() => import("@/features/sprints/components/create-work-item-modal").then(mod => mod.CreateWorkItemModal), { ssr: false });
const CreateCustomColumnModalWrapper = dynamic(() => import("@/features/custom-columns/components/create-custom-column-modal-wrapper").then(mod => mod.CreateCustomColumnModalWrapper), { ssr: false });
const ManageColumnsModalWrapper = dynamic(() => import("@/features/custom-columns/components/manage-columns-modal-wrapper").then(mod => mod.ManageColumnsModalWrapper), { ssr: false });
const CreateProgramModal = dynamic(() => import("@/features/programs/components/create-program-modal").then(mod => mod.CreateProgramModal), { ssr: false });
const EditProgramModal = dynamic(() => import("@/features/programs/components/edit-program-modal").then(mod => mod.EditProgramModal), { ssr: false });
const AgentFloatingChat = dynamic(() => import("@/features/agent/components/agent-floating-chat").then(mod => mod.AgentFloatingChat).catch(() => (() => null) as React.FC), { ssr: false });
const CreateSpaceModal = dynamic(() => import("@/features/spaces/components").then(mod => mod.CreateSpaceModal), { ssr: false });
const CreateWorkflowModal = dynamic(() => import("@/features/workflows/components/create-workflow-modal").then(mod => mod.CreateWorkflowModal), { ssr: false });
const CreateLinkModal = dynamic(() => import("@/features/work-item-links/components/create-link-modal").then(mod => mod.CreateLinkModal), { ssr: false });
const CreateTaskModal = dynamic(() => import("@/features/tasks/components/create-task-modal").then(mod => mod.CreateTaskModal), { ssr: false });
const EditTaskModal = dynamic(() => import("@/features/tasks/components/edit-task-modal").then(mod => mod.EditTaskModal), { ssr: false });
const TaskDetailsModalWrapper = dynamic(() => import("@/features/tasks/components/task-details-modal-wrapper").then(mod => mod.TaskDetailsModalWrapper), { ssr: false });
const TaskPreviewModalWrapper = dynamic(() => import("@/features/tasks/components/task-preview-modal").then(mod => mod.TaskPreviewModalWrapper), { ssr: false });
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { ProfileSidebar } from "@/components/ProfileSidebar";

import { LifecycleGuard } from "@/components/lifecycle-guard";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * Inner layout component that renders the actual dashboard content.
 * Guarded by LifecycleGuard - this only renders when lifecycle state is valid.
 * 
 * This is the BYOB variant — identical to Cloud (dashboard)/layout.tsx.
 * sessionMiddleware routes all data operations to the customer's Appwrite automatically.
 */
const DashboardContent = ({ children }: DashboardLayoutProps) => {
  const pathname = usePathname();
  const isProfilePage = pathname === "/profile" || pathname.startsWith("/profile/");
  const workspaceId = useWorkspaceId();
  // Match both Cloud (/workspaces/:id/tasks/:id) and BYOB (/:slug/workspaces/:id/tasks/:id)
  const isTaskDetailPage = /\/workspaces\/[^/]+\/tasks\/[^/]+$/.test(pathname || "");
  const isMainDashboard = /\/workspaces\/[^/]+$/.test(pathname || "");

  return (
    <div className={`min-h-screen ${isMainDashboard ? 'bg-background' : ''}`}>
      <Suspense fallback={null}>
        <CreateWorkspaceModal />
        <CreateProjectModal />
        <CreateWorkItemModal />
        <CreateTaskModal />
        <EditTaskModal />
        <TaskDetailsModalWrapper />
        <TaskPreviewModalWrapper />
        <CreateCustomColumnModalWrapper />
        <ManageColumnsModalWrapper />
        <CreateProgramModal />
        <EditProgramModal />
        {workspaceId && (
          <>
            <CreateSpaceModal />
            <CreateWorkflowModal workspaceId={workspaceId} />
            <CreateLinkModal workspaceId={workspaceId} />
          </>
        )}
      </Suspense>

      <div className="flex w-full h-screen">
        <div className="fixed left-0 top-0 hidden lg:block lg:w-[264px] h-full overflow-y-auto">
          {isProfilePage ? <ProfileSidebar /> : <Sidebar />}
        </div>
        <div className="lg:pl-[264px] w-full flex flex-col min-h-screen">
          <Navbar />
          <div className="flex-1 overflow-y-auto bg-background">
            <div className="mx-auto max-w-screen-2xl">
              <main className={cn(
                "flex flex-col",
                isTaskDetailPage ? "py-0 px-0" : "py-8 px-6"
              )}>
                {children}
              </main>
            </div>
          </div>
        </div>
      </div>

      {/* fairlx Agent — floating chat */}
      <Suspense fallback={null}>
        <AgentFloatingChat />
      </Suspense>
    </div>
  );
};

/**
 * BYOB Dashboard Layout
 * 
 * Identical to Cloud (dashboard)/layout.tsx but placed under [orgSlug]/(dashboard)
 * so that BYOB users can access /{orgSlug}/workspaces/:id routes.
 * All data operations automatically route to customer Appwrite via sessionMiddleware.
 */
const BYOBDashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <LifecycleGuard>
      <DashboardContent>{children}</DashboardContent>
    </LifecycleGuard>
  );
};

export default BYOBDashboardLayout;
