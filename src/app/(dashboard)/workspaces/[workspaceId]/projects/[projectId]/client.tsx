"use client";

import { PencilIcon, Layers, Github } from "lucide-react";
import Link from "next/link";

import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";

import { useGetProject } from "@/features/projects/api/use-get-project";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { TaskViewSwitcher } from "@/features/tasks/components/task-view-switcher";
import { useGetProjectAnalytics } from "@/features/projects/api/use-get-project-analytics";

export const ProjectIdClient = () => {
  const projectId = useProjectId();
  const { data: project, isLoading: isLoadingProject } = useGetProject({
    projectId,
  });
  const { isLoading: isLoadingAnalytics } = useGetProjectAnalytics({ projectId });

  const isLoading = isLoadingProject || isLoadingAnalytics;

  if (isLoading) {
    return <PageLoader />;
  }

  if (!project) {
    return <PageError message="Project not found." />;
  }

  // console.log("Project Data:", project);

  return (
    <div className="flex flex-col gap-y-4">

      <div className="flex items-center mb-4 justify-between">


        <div className="flex  gap-x-2 flex-col items-start gap-y-1.5">
          <p className="text-2xl tracking-tight  font-semibold">{project.name} Dashboard</p>
          <p className="text-sm tracking-normal font-medium text-neutral-500">Track your project and goals with full AI Assistance</p>
        </div>


        <div className="flex items-center gap-2">
          <Link href={`/workspaces/${project.workspaceId}/projects/${project.$id}/backlog`} className="!text-sm">
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Layers className="size-4 mr-3" />
              Backlog
            </button>
          </Link>

          <Link href={`/workspaces/${project.workspaceId}/projects/${project.$id}/sprints`} className="!text-sm">
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Layers className="size-4 mr-3" />
              Sprint Board
            </button>
          </Link>

          <Link href={`/workspaces/${project.workspaceId}/projects/${project.$id}/github`} className="!text-sm">
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Github className="size-4 mr-3" />
              GitHub
            </button>
          </Link>

          <Link href={`/workspaces/${project.workspaceId}/projects/${project.$id}/settings`} className="!text-sm">
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <PencilIcon className="size-4 mr-3" />
              Edit Project
            </button>
          </Link>
        </div>


      </div>
      {/* {analytics && <Analytics data={analytics} />} */}

      <TaskViewSwitcher hideProjectFilter={true} />
    </div>
  );
};
