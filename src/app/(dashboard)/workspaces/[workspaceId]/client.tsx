"use client";

// removed analytics strip
import { OverallProgressCard } from "@/components/dashboard/overall-progress-card";
import { ProjectsOverviewCard } from "@/components/dashboard/projects-overview-card";
import { TeamActivityCard } from "@/components/dashboard/team-activity-card";
import { ProjectTasksCard } from "@/components/dashboard/project-tasks-card";
import { PerformanceAnalytics } from "@/components/dashboard/performance-analytics";
import { WobbleCard } from "@/components/ui/wobble-card";
import { DottedSeparator } from "@/components/dotted-separator";
import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { useGetMembers } from "@/features/members/api/use-get-members";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { Member } from "@/features/members/types";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { useCreateProjectModal } from "@/features/projects/hooks/use-create-project-modal";
import { Project } from "@/features/projects/types";
import { useGetTasks } from "@/features/tasks/api/use-get-tasks";
import { useCreateTaskModal } from "@/features/tasks/hooks/use-create-task-modal";
import { Task } from "@/features/tasks/types";
import { useGetWorkspaceAnalytics } from "@/features/workspaces/api/use-get-workspace-analytics";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { formatDistanceToNow } from "date-fns";
import { CalendarIcon, PlusIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";

export const WorkspaceIdClient = () => {
  const workspaceId = useWorkspaceId();
  const { data: analytics, isLoading: isLoadingAnalytics } =
    useGetWorkspaceAnalytics({ workspaceId });
  const { data: tasks, isLoading: isLoadingTasks } = useGetTasks({
    workspaceId,
  });
  const { data: projects, isLoading: isLoadingProjects } = useGetProjects({
    workspaceId,
  });
  const { data: members, isLoading: isLoadingMembers } = useGetMembers({
    workspaceId,
  });

  const isLoading =
    isLoadingAnalytics ||
    isLoadingTasks ||
    isLoadingProjects ||
    isLoadingMembers;

  if (isLoading) {
    return <PageLoader />;
  }

  if (!analytics || !tasks || !projects || !members) {
    return <PageError message="Failed to load workspace data." />;
  }

  const completion = Math.min(
    100,
    Math.round((analytics.completedTaskCount / Math.max(1, analytics.taskCount)) * 100)
  );

  return (
    <div className="h-full">
      <div className="grid grid-cols-1 md:grid-cols-6 xl:grid-cols-12 gap-3 auto-rows-auto">
        {/* Overall Progress - wider on xl */}
        <WobbleCard containerClassName="md:col-span-3 xl:col-span-7" className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
          <OverallProgressCard
            completedPercent={completion}
            totalProjects={projects.total}
            upcoming={Math.max(0, analytics.incompleteTaskCount - analytics.overdueTaskCount)}
          />
        </WobbleCard>

        {/* Projects Overview - complements progress */}
        <WobbleCard containerClassName="md:col-span-3 xl:col-span-5" className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <ProjectsOverviewCard
            ongoing={projects.documents.slice(0,2).map(p => ({ id: p.$id, title: p.name, progress: 54 }))}
            pending={projects.documents.slice(2,4).map(p => ({ id: p.$id, title: p.name, progress: 0 }))}
          />
        </WobbleCard>

        {/* Team Activity - wider on xl */}
        <WobbleCard containerClassName="md:col-span-3 xl:col-span-7" className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <TeamActivityCard
            items={[
              { id: '1', author: 'Will Logso', role: 'Backend Developer', message: 'How can I buy only the design?', timestamp: '5 min ago' },
              { id: '2', author: 'Sarah Hosten', role: 'Project Manager', message: 'Launched sprint retrospective notes.', timestamp: '1 hour ago' },
            ]}
          />
        </WobbleCard>

        {/* Project Tasks - complements team activity */}
        <WobbleCard containerClassName="md:col-span-3 xl:col-span-5" className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <ProjectTasksCard tasks={tasks.documents} />
        </WobbleCard>

        {/* Performance chart full width on xl */}
        <WobbleCard containerClassName="md:col-span-6 xl:col-span-12" className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <PerformanceAnalytics
            data={[
              { name: 'Mon', value: analytics.taskCount },
              { name: 'Tue', value: analytics.assignedTaskCount },
              { name: 'Wed', value: analytics.completedTaskCount },
              { name: 'Thu', value: analytics.overdueTaskCount },
              { name: 'Fri', value: analytics.incompleteTaskCount },
            ]}
          />
        </WobbleCard>
      </div>
    </div>
  );
};

interface TaskListProps {
  data: Task[];
  total: number;
}

export const TaskList = ({ data, total }: TaskListProps) => {
  const workspaceId = useWorkspaceId();
  const { open: createTask } = useCreateTaskModal();

  return (
    <div className="flex flex-col gap-y-4 col-span-1">
      <div className="bg-muted rounded-lg p-4">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">Tasks ({total})</p>
          <Button variant="muted" size="icon" onClick={createTask}>
            <PlusIcon className="size-4 text-neutral-400" />
          </Button>
        </div>
        <DottedSeparator className="my-4" />
        <ul className="flex flex-col gap-y-4">
          {data.map((task) => (
            <li key={task.$id}>
              <Link href={`/workspaces/${workspaceId}/tasks/${task.$id}`}>
                <Card className="shadow-none rounded-lg hover:opacity-75 transition">
                  <CardContent className="p-4">
                    <p className="text-lg font-medium truncate">{task.name}</p>
                    <div className="flex items-center gap-x-2">
                      <p>{task.project?.name}</p>
                      <div className="size-1 rounded-full bg-neutral-300" />
                      <div className="flex items-center text-sm text-muted-foreground">
                        <CalendarIcon className="size-3 mr-1" />
                        <span className="truncate">
                          {formatDistanceToNow(new Date(task.dueDate))}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
          <li className="text-sm text-muted-foreground text-center hidden first-of-type:block">
            No tasks found
          </li>
        </ul>
        <Button variant="muted" className="mt-4 w-full" asChild>
          <Link href={`/workspaces/${workspaceId}/tasks`}>Show All</Link>
        </Button>
      </div>
    </div>
  );
};

interface ProjectListProps {
  data: Project[];
  total: number;
}

export const ProjectList = ({ data, total }: ProjectListProps) => {
  const workspaceId = useWorkspaceId();
  const { open: createProject } = useCreateProjectModal();

  return (
    <div className="flex flex-col gap-y-4 col-span-1">
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">Projects ({total})</p>
          <Button variant="secondary" size="icon" onClick={createProject}>
            <PlusIcon className="size-4 text-neutral-400" />
          </Button>
        </div>
        <DottedSeparator className="my-4" />
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.map((project) => (
            <li key={project.$id}>
              <Link href={`/workspaces/${workspaceId}/projects/${project.$id}`}>
                <Card className="shadow-none rounded-lg hover:opacity-75 transition">
                  <CardContent className="flex items-center gap-x-2.5 p-4">
                    <ProjectAvatar
                      name={project.name}
                      image={project.imageUrl}
                      className="size-12"
                      fallbackClassName="text-lg"
                    />
                    <p className="text-lg font-medium truncate">
                      {project.name}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
          <li className="text-sm text-muted-foreground text-center hidden first-of-type:block">
            No projects found
          </li>
        </ul>
      </div>
    </div>
  );
};

interface MemberListProps {
  data: Member[];
  total: number;
}

export const MemberList = ({ data, total }: MemberListProps) => {
  const workspaceId = useWorkspaceId();

  return (
    <div className="flex flex-col gap-y-4 col-span-1">
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">Members ({total})</p>
          <Button variant="secondary" size="icon" asChild>
            <Link href={`/workspaces/${workspaceId}/members`}>
              <SettingsIcon className="size-4 text-neutral-400" />
            </Link>
          </Button>
        </div>
        <DottedSeparator className="my-4" />
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((member) => (
            <li key={member.$id}>
              <Card className="shadow-none rounded-lg overflow-hidden">
                <CardContent className="p-3 flex flex-col items-center gap-x-2">
                  <MemberAvatar name={member.name} className="size-12" />
                  <div className="flex flex-col items-center overflow-hidden">
                    <p className="text-lg font-medium line-clamp-1">
                      {member.name}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {member.email}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
          <li className="text-sm text-muted-foreground text-center hidden first-of-type:block">
            No members found
          </li>
        </ul>
      </div>
    </div>
  );
};
