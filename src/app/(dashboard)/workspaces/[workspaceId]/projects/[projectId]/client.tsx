"use client";

import { Layers, Github, FileText, Settings, Calendar, UserPlus } from "lucide-react";
import Link from "next/link";
import { format, isPast, differenceInDays } from "date-fns";

import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { Badge } from "@/components/ui/badge";
import { ProjectPermissionGuard } from "@/components/project-permission-guard";
import { ProjectPermissionKey } from "@/lib/permissions/types";

import { useGetProject } from "@/features/projects/api/use-get-project";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const TaskViewSwitcher = dynamic(() => import("@/features/tasks/components/task-view-switcher").then(mod => mod.TaskViewSwitcher), {
  ssr: false,
  loading: () => <Skeleton className="h-[400px] w-full" />
});

export const ProjectIdClient = () => {
  const projectId = useProjectId();
  const workspaceId = useWorkspaceId();
  const { data: project, isLoading: isLoadingProject } = useGetProject({
    projectId,
  });

  if (isLoadingProject) {
    return <PageLoader />;
  }

  if (!project) {
    return <PageError message="Project not found." />;
  }

  const getDeadlineBadge = () => {
    if (!project.deadline) return null;

    const deadlineDate = new Date(project.deadline);
    const isOverdue = isPast(deadlineDate);
    const daysRemaining = differenceInDays(deadlineDate, new Date());

    if (isOverdue) {
      return (
        <Badge variant="destructive" className="text-xs">
          <Calendar className="size-3 mr-1" />
          Overdue
        </Badge>
      );
    }

    if (daysRemaining <= 7) {
      return (
        <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/20">
          <Calendar className="size-3 mr-1" />
          Due in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-xs">
        <Calendar className="size-3 mr-1" />
        Due {format(deadlineDate, "MMM d, yyyy")}
      </Badge>
    );
  };

  return (
    <div id="project-dashboard" className="flex flex-col gap-y-4">

      <div className="flex items-center mb-4 justify-between">

        <div className="flex gap-x-2 flex-col items-start gap-y-1.5">
          <div className="flex items-center gap-3">
            <p className="text-2xl tracking-tight font-semibold">{project.name}</p>
            {getDeadlineBadge()}
          </div>
          <p className="text-sm tracking-normal font-medium text-muted-foreground">
            {project.description || "Track your project and goals with full AI Assistance"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sprint Board - only visible with VIEW_SPRINTS permission */}
          <ProjectPermissionGuard
            permission={ProjectPermissionKey.VIEW_SPRINTS}
            projectId={projectId}
            workspaceId={workspaceId}
          >
            <Link href={`/workspaces/${project.workspaceId}/projects/${project.$id}/sprints`} className="!text-sm">
              <button
                type="button"
                className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
              >
                <Layers className="size-4 mr-3" />
                Sprint Board
              </button>
            </Link>
          </ProjectPermissionGuard>

          <Link href={`/workspaces/${project.workspaceId}/projects/${project.$id}/docs`} className="!text-sm">
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
            >
              <FileText className="size-4 mr-3" />
              Docs
            </button>
          </Link>

          <Link href={`/workspaces/${project.workspaceId}/projects/${project.$id}/github`} className="!text-sm">
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
            >
              <Github className="size-4 mr-3" />
              AI Github
            </button>
          </Link>

          <Link href={`/workspaces/${project.workspaceId}/projects/${project.$id}/members`} className="!text-sm">
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
            >
              <UserPlus className="size-4 mr-3" />
              Teams & Members
            </button>
          </Link>

          {/* Settings link - only visible to users with EDIT_SETTINGS permission */}
          <ProjectPermissionGuard
            permission={ProjectPermissionKey.EDIT_SETTINGS}
            projectId={projectId}
            workspaceId={workspaceId}
          >
            <Link href={`/workspaces/${project.workspaceId}/projects/${project.$id}/settings`} className="!text-sm">
              <button
                type="button"
                className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
              >
                <Settings className="size-4 mr-3" />
                Settings
              </button>
            </Link>
          </ProjectPermissionGuard>
        </div>

      </div>

      <TaskViewSwitcher hideProjectFilter={true} />
    </div>
  );
};
