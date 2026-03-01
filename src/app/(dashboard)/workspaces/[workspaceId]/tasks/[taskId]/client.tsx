"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon, Link, Copy } from "lucide-react";
import { toast } from "sonner";
import IconHelp from "@/components/icon-help";
import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useGetTask } from "@/features/tasks/api/use-get-task";
import { TaskDescription } from "@/features/tasks/components/task-description";
import { TaskDetailsSidebar } from "@/features/tasks/components/task-details-sidebar";
import { TaskHistory } from "@/features/tasks/components/task-history";
import { useTaskId } from "@/features/tasks/hooks/use-task-id";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { TaskAttachments } from "@/features/attachments/components/task-attachments";
import { TaskComments } from "@/features/comments/components/task-comments";
import { TaskTimeLogs } from "@/features/time-tracking/components/task-time-logs";
import { WorkItemLinksSection } from "@/features/work-item-links/components/work-item-links-section";
import { useDeleteTask } from "@/features/tasks/api/use-delete-task";
import { useCurrent } from "@/features/auth/api/use-current";
import { useConfirm } from "@/hooks/use-confirm";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { useProjectPermissions } from "@/hooks/use-project-permissions";
import { useCreateTaskModal } from "@/features/tasks/hooks/use-create-task-modal";
import { SubIssuesList } from "@/features/tasks/components/sub-issues-list";

export const TaskIdClient = () => {
  const [activeTab, setActiveTab] = useState<"activity" | "timelogs">("activity");
  const taskId = useTaskId();
  const workspaceId = useWorkspaceId();
  const router = useRouter();
  const { data, isLoading } = useGetTask({ taskId });
  const { data: currentUser } = useCurrent();
  const { mutate, isPending } = useDeleteTask();
  const [ConfirmDialog, confirm] = useConfirm(
    "Delete task?",
    "This action cannot be undone.",
    "destructive"
  );

  // Get workspace admin status
  const { isAdmin } = useCurrentMember({ workspaceId });
  
  // Sub-issue creation modal
  const { open: openCreateTaskModal } = useCreateTaskModal();
  
  // Get project-level task permissions
  const { 
    canEditTasksProject, 
    canDeleteTasksProject
  } = useProjectPermissions({ 
    projectId: data?.projectId || null, 
    workspaceId 
  });
  
  // Effective permissions: Admin OR has project-level permission
  const canEditTasks = isAdmin || canEditTasksProject;
  const canDeleteTasks = isAdmin || canDeleteTasksProject;

  const handleDeleteTask = async () => {
    const ok = await confirm();
    if (!ok) return;

    mutate(
      { param: { taskId: taskId || "" } },
      {
        onSuccess: () => {
          router.push(`/workspaces/${workspaceId}/tasks`);
        },
      }
    );
  };

  if (isLoading) {
    return <PageLoader />;
  }

  if (!data) {
    return <PageError message="Task not found." />;
  }

  return (
    <div className="flex flex-col h-[91vh]">
      <ConfirmDialog />

      {/* Modal-like Content */}
      <div className="flex flex-1 overflow-hidden bg-background">
        {/* Left Section - Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Task Title */}
          <div className="px-6 pt-6 pb-4">
            <h1 className="text-xl font-semibold text-foreground">{data.name}</h1>
          </div>

          {/* Description Section */}
          <div className="px-6 pb-4">
            <span className="text-xs text-muted-foreground mb-3 mt-4 block">Description</span>
            <TaskDescription 
              task={data} 
              canEdit={canEditTasks} 
              workspaceId={workspaceId}
              projectId={data.projectId}
            />
          </div>

          {/* Add Sub-issues */}
          <div className="px-6 pb-6">
            <SubIssuesList 
              parentId={data.$id} 
              workspaceId={workspaceId}
              onAddSubIssue={() => openCreateTaskModal(data.$id)}
            />
          </div>



          {/* Connected Work Items Section */}
          <div className="px-6 pb-4 pt-5 border-t border-border">
            <WorkItemLinksSection workItemId={data.$id} />
          </div>

          {/* Separator */}
          <div className="border-t border-border" />

          {/* Activity Section */}
          <div className="px-6 py-4">
            <div className="flex gap-2 mb-4 border-b border-border">
              <button
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors relative",
                  activeTab === "activity"
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setActiveTab("activity")}
              >
                Activity
                {activeTab === "activity" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
              <button
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors relative",
                  activeTab === "timelogs"
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setActiveTab("timelogs")}
              >
                Time Logs
                {activeTab === "timelogs" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            </div>

            {/* Activity Tab Content */}
            {activeTab === "activity" && (
              <>
                {/* Activity Feed - Comments and History unified with replies */}
                <div className="space-y-4 mb-4">
                  <TaskHistory
                    task={data}
                    workspaceId={workspaceId}
                    currentUserId={currentUser?.$id}
                    isAdmin={canDeleteTasks}
                  />
                </div>

                {/* Comment Input at bottom */}
                {currentUser && (
                  <div className="pt-4 border-t border-border">
                    <TaskComments
                      taskId={data.$id}
                      workspaceId={workspaceId}
                      currentUserId={currentUser.$id}
                      isAdmin={canDeleteTasks}
                    />
                  </div>
                )}
              </>
            )}

            {/* Time Logs Tab Content */}
            {activeTab === "timelogs" && (
              <TaskTimeLogs
                taskId={data.$id}
                taskName={data.name}
                workspaceId={workspaceId}
              />
            )}
          </div>


        </div>

        {/* Right Section - Details Panel */}
        <div className="w-[280px] border-l border-border bg-muted/30 flex flex-col overflow-y-auto">
          <div className="">
            <div className="flex items-center justify-between  pt-2">
              <div className="flex items-center justify-between px-3 pt-2 pb-4 w-full  border-b border-border">
                <h2 className="font-medium text-sm text-foreground">Properties</h2>

                <div className="flex items-center ">
                  <IconHelp content="Copy task URL" side="bottom">
                    <button
                      className="hover:bg-[#cfcfcf89] p-1.5 rounded-sm"
                      onClick={async () => {
                        try {
                          const url = typeof window !== "undefined"
                            ? `${window.location.origin}/workspaces/${workspaceId}/tasks/${data.$id}`
                            : `/workspaces/${workspaceId}/tasks/${data.$id}`;
                          await navigator.clipboard.writeText(url);
                          toast.success("Task URL copied to clipboard.");
                        } catch {
                          toast.error("Failed to copy task URL.");
                        }
                      }}
                    >
                      <Link size={17} strokeWidth={1.5} color="#696969" />
                    </button>
                  </IconHelp>

                  <IconHelp content="Copy task ID" side="bottom">
                    <button
                      className="hover:bg-[#cfcfcf89] p-1.5 rounded-sm"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(data.$id);
                          toast.success("Task ID copied to clipboard.");
                        } catch {
                          toast.error("Failed to copy task ID.");
                        }
                      }}
                    >
                      <Copy size={17} color="#696969" strokeWidth={1.5} />
                    </button>
                  </IconHelp>

                  {canDeleteTasks && (
                    <IconHelp content="Delete Task" side="bottom">

                      <Button
                        onClick={handleDeleteTask}
                        disabled={isPending}
                        variant="ghost"
                        size="sm"
                        className=" text-[#ff0000] p-1.5 rounded-sm"
                      >
                        <TrashIcon className="size-4" color="#ff000089" />
                      </Button>
                    </IconHelp>

                  )}
                </div>


              </div>

            </div>

            {/* Task Overview in sidebar */}
            <TaskDetailsSidebar task={data} workspaceId={workspaceId} canEdit={canEditTasks} />

            {/* Attachments */}
            <div className=" pt-2 border-t pb-1">
              <TaskAttachments
                taskId={data.$id}
                workspaceId={workspaceId}
              />
            </div >


            <div className=" pt-3 border-t">

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
