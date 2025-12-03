"use client";

import { DottedSeparator } from "@/components/dotted-separator";
import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";

import { useGetTask } from "@/features/tasks/api/use-get-task";
import { TaskBreadcrumbs } from "@/features/tasks/components/task-breadcrumbs";
import { TaskDescription } from "@/features/tasks/components/task-description";
import { TaskOverview } from "@/features/tasks/components/task-overview";
import { useTaskId } from "@/features/tasks/hooks/use-task-id";
import { TaskTimeLogs } from "@/features/time-tracking/components/task-time-logs";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { TaskAttachments } from "@/features/attachments/components/task-attachments";
import { useCurrentTeamMember } from "@/features/teams/hooks/use-current-team-member";

export const TaskIdClient = () => {
  const taskId = useTaskId();
  const workspaceId = useWorkspaceId();
  const { data, isLoading } = useGetTask({ taskId });

  // Get team permissions if task has assigned team
  const teamId = data?.assignedTeamId || "";
  const teamPermissions = useCurrentTeamMember({ teamId: teamId || "" });
  const canEditTasks = teamId ? (teamPermissions.canEditTasks ?? false) : false;
  const canDeleteTasks = teamId ? (teamPermissions.canDeleteTasks ?? false) : false;

  if (isLoading) {
    return <PageLoader />;
  }

  if (!data) {
    return <PageError message="Task not found." />;
  }

  return (
    <div className="flex flex-col">
      <TaskBreadcrumbs project={data.project} task={data} canDelete={canDeleteTasks} />
      <DottedSeparator className="my-6" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TaskOverview task={data} canEdit={canEditTasks} />
        <TaskDescription task={data} canEdit={canEditTasks} />
      </div>
      <DottedSeparator className="my-6" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="w-full">
          <TaskTimeLogs
            taskId={data.$id}
            taskName={data.name}
            workspaceId={workspaceId}
          />
        </div>
        <div className="w-full">
          <TaskAttachments
            taskId={data.$id}
            workspaceId={workspaceId}
          />
        </div>
      </div>
    </div>
  );
};
