"use client";

import { useState } from "react";
import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { TaskDetailsModal } from "@/components/task-details-modal";
import { useRouter } from "next/navigation";
import { TrashIcon } from "lucide-react";

import { useGetTask } from "@/features/tasks/api/use-get-task";
import { TaskDescription } from "@/features/tasks/components/task-description";
import { TaskOverview } from "@/features/tasks/components/task-overview";
import { TaskHistory } from "@/features/tasks/components/task-history";
import { TaskTimeLogs } from "@/features/time-tracking/components/task-time-logs";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { TaskAttachments } from "@/features/attachments/components/task-attachments";
import { TaskComments } from "@/features/comments/components/task-comments";
import { Button } from "@/components/ui/button";
import { useCurrent } from "@/features/auth/api/use-current";
import { useCurrentTeamMember } from "@/features/teams/hooks/use-current-team-member";
import { cn } from "@/lib/utils";

import { useTaskDetailsModal } from "../hooks/use-task-details-modal";
import { useDeleteTask } from "../api/use-delete-task";
import { useConfirm } from "@/hooks/use-confirm";


export const TaskDetailsModalWrapper = () => {
  const [activeTab, setActiveTab] = useState<"comments" | "history" | "worklog">("comments");
  const { mutate, isPending } = useDeleteTask();
  const [ConfirmDialog, confirm] = useConfirm(
    "Delete task?",
    "This action cannot be undone.",
    "destructive"
  );
  const router = useRouter();

  const { taskId, close } = useTaskDetailsModal();
  const workspaceId = useWorkspaceId();
  const { data, isLoading } = useGetTask({ taskId: taskId || "" });
  const { data: currentUser } = useCurrent();

  // Get team permissions if task has assigned team
  const teamId = data?.assignedTeamId || "";
  const teamPermissions = useCurrentTeamMember({ teamId: teamId || "" });
  const canEditTasks = teamId ? (teamPermissions.canEditTasks ?? false) : false;
  const canDeleteTasks = teamId ? (teamPermissions.canDeleteTasks ?? false) : false;

  const isOpen = !!taskId;

  const handleDeleteTask = async () => {
    const ok = await confirm();
    if (!ok) return;

    mutate(
      { param: { taskId: taskId || "" } },
      {
        onSuccess: () => {
          close(); // Close the modal first
          router.push(`/workspaces/${workspaceId}/tasks`);
        },
      }
    );
  };



  return (
    <>
      <ConfirmDialog />
      <TaskDetailsModal open={isOpen} onOpenChange={close}>
        {isLoading ? (
          <div className="h-[600px] flex items-center justify-center">
            <PageLoader />
          </div>
        ) : !data ? (
          <div className="h-[600px] flex items-center justify-center">
            <PageError message="Task not found." />
          </div>
        ) : (
          <div className="flex h-full">
            {/* Left Section - Main Content */}
            <div className="flex-1 flex flex-col overflow-y-auto">
              {/* Task Title */}
              <div className="p-6 border-b">
                <h1 className="text-2xl font-semibold">{data.name}</h1>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 px-6 py-4 border-b">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm"
                >
                  +
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full w-8 h-8 p-0"
                >
                  @
                </Button>
              </div>

              {/* Description Section */}
              <div className="px-6 py-4 border-b">
                <h3 className="font-semibold mb-2">Description</h3>
                <TaskDescription task={data} canEdit={canEditTasks} />
              </div>

              {/* Subtasks Section */}
              <div className="px-6 py-4 border-b">
                <h3 className="font-semibold mb-2">Subtasks</h3>
                <button className="text-sm text-gray-600">Add subtask</button>
              </div>

              {/* Connected Work Items Section */}
              <div className="px-6 py-4 border-b">
                <h3 className="font-semibold mb-2">Connected work items</h3>
                <button className="text-sm text-gray-600">Add connected work item</button>
              </div>

              {/* Activity Section */}
              <div className="px-6 py-4 flex-1">
                <h3 className="font-semibold mb-4">Activity</h3>
                <div className="flex gap-2 mb-4 border-b">
                  <button
                    className={cn(
                      "px-3 py-2 text-sm transition-colors",
                      activeTab === "comments" && "border-b-2 border-blue-600 text-blue-600"
                    )}
                    onClick={() => setActiveTab("comments")}
                  >
                    Comments
                  </button>
                  <button
                    className={cn(
                      "px-3 py-2 text-sm transition-colors",
                      activeTab === "history" && "border-b-2 border-blue-600 text-blue-600"
                    )}
                    onClick={() => setActiveTab("history")}
                  >
                    History
                  </button>
                  <button
                    className={cn(
                      "px-3 py-2 text-sm transition-colors",
                      activeTab === "worklog" && "border-b-2 border-blue-600 text-blue-600"
                    )}
                    onClick={() => setActiveTab("worklog")}
                  >
                    Work log
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === "comments" && currentUser && (
                  <TaskComments
                    taskId={data.$id}
                    workspaceId={workspaceId}
                    currentUserId={currentUser.$id}
                    isAdmin={canDeleteTasks}
                  />
                )}

                {activeTab === "worklog" && (
                  <TaskTimeLogs
                    taskId={data.$id}
                    taskName={data.name}
                    workspaceId={workspaceId}
                  />
                )}

                {activeTab === "history" && (
                  <TaskHistory
                    task={data}
                    workspaceId={workspaceId}
                  />
                )}
              </div>
            </div>

            {/* Right Section - Details Panel */}
            <div className="w-80 border-l bg-gray-50 flex flex-col overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 pr-5">
                  <h2 className="font-semibold text-lg">Details</h2>
                  {canDeleteTasks && (
                    <Button
                      onClick={handleDeleteTask}
                      disabled={isPending}
                      variant="ghost"
                      size="sm"
                      className=" !text-xs text-red-700 bg-red-50 hover:bg-red-50 hover:text-red-700"
                    >
                      <TrashIcon className="size-4" /> Delete Task
                    </Button>
                  )}
                </div>

                {/* Task Overview in sidebar */}
                <TaskOverview task={data} canEdit={canEditTasks} />

                {/* Attachments */}
                <div className="mt-6 pt-6 border-t">
                  <TaskAttachments
                    taskId={data.$id}
                    workspaceId={workspaceId}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </TaskDetailsModal>
    </>
  );
};
