"use client";

import { LoaderIcon, PlusIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useCallback, useMemo } from "react";

import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { useGetMembers } from "@/features/members/api/use-get-members";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { createColumns } from "./columns";
import { DataCalendar } from "./data-calendar";
import { DataFilters } from "./data-filters";
import { DataTable } from "./data-table";
// Use full EnhancedDataKanban so custom columns show up
import { EnhancedDataKanban } from "@/features/custom-columns/components/enhanced-data-kanban";
import { DataDashboard } from "./data-dashboard";
import { TimelineView } from "@/features/timeline/components/timeline-view";
import { MyBacklogView } from "@/features/personal-backlog/components/my-backlog-view";
import { MySpaceDashboard } from "./my-space-dashboard";
import EnhancedBacklogScreen from "@/features/sprints/components/enhanced-backlog-screen";

import { useGetTasks } from "../api/use-get-tasks";
import { useCreateTaskModal } from "../hooks/use-create-task-modal";
import { useTaskFilters } from "../hooks/use-task-filters";
import { TaskStatus, TaskPriority } from "../types";
import { useBulkUpdateTasks } from "../api/use-bulk-update-tasks";

interface TaskViewSwitcherProps {
  hideProjectFilter?: boolean;
  showMyTasksOnly?: boolean; // New prop to filter by current user
}

export const TaskViewSwitcher = ({
  hideProjectFilter,
  showMyTasksOnly = false,
}: TaskViewSwitcherProps) => {


  const [{ status, assigneeId, projectId, dueDate, search, priority, labels }] =
    useTaskFilters();
  const workspaceId = useWorkspaceId();
  const paramProjectId = useProjectId();

  // Set default view based on whether we're in a project context
  const defaultView = paramProjectId && hideProjectFilter ? "dashboard" : "myspace";
  const [view, setView] = useQueryState("task-view", { defaultValue: defaultView });
  const { mutate: bulkUpdate } = useBulkUpdateTasks();

  // Get current user data
  const { member: currentMember, isAdmin } = useCurrentMember({ workspaceId });
  const { data: members } = useGetMembers({ workspaceId });

  // Check if user has a project selected
  const hasProjectId = !!paramProjectId || !!projectId;

  console.log("project id", paramProjectId, projectId);

  // Determine the effective assigneeId - if showMyTasksOnly is true, use current member's ID
  const effectiveAssigneeId = showMyTasksOnly && currentMember ? currentMember.$id : assigneeId;

  const { data: tasks, isLoading: isLoadingTasks } = useGetTasks({
    workspaceId,
    projectId: paramProjectId || projectId,
    assigneeId: effectiveAssigneeId,
    status,
    dueDate,
    search: null, // Don't filter on server side
    priority: priority as TaskPriority | null,
    labels,
  });

  // Client-side filtering for search
  const filteredTasks = useMemo(() => {
    if (!tasks?.documents) return undefined;

    let filtered = tasks.documents;

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(task =>
        task.name.toLowerCase().includes(searchLower) ||
        (task.description && task.description.toLowerCase().includes(searchLower))
      );
    }

    return {
      ...tasks,
      documents: filtered,
      total: filtered.length
    };
  }, [tasks, search]);



  const onKanbanChange = useCallback(
    (tasks: { $id: string; status: TaskStatus | string; position: number }[]) => {
      bulkUpdate({ json: { tasks } });
    },
    [bulkUpdate]
  );

  const { open } = useCreateTaskModal();


  return (
    <Tabs
      defaultValue={view}
      onValueChange={setView}
      className="flex-1 w-full border rounded-lg"
    >
      <div className="h-full flex flex-col overflow-auto ">
        <div className="flex flex-col gap-y-2  px-4 py-6 lg:flex-row justify-between items-center">
          <TabsList className="w-full lg:w-auto">
            {!hasProjectId && !showMyTasksOnly && (
              <TabsTrigger className="h-8 w-full text-xs lg:w-auto" value="myspace">
                My Space
              </TabsTrigger>
            )}
            {hasProjectId && (
              <>
                <TabsTrigger className="h-8 w-full text-xs lg:w-auto" value="dashboard">
                  Dashboard
                </TabsTrigger>
                <TabsTrigger className="h-8 w-full text-xs lg:w-auto" value="table">
                  Table
                </TabsTrigger>
                <TabsTrigger className="h-8 w-full text-xs lg:w-auto" value="kanban">
                  Kanban
                </TabsTrigger>
                <TabsTrigger className="h-8 w-full text-xs lg:w-auto" value="timeline">
                  Timeline
                </TabsTrigger>
                <TabsTrigger className="h-8 w-full text-xs lg:w-auto" value="calendar">
                  Calendar
                </TabsTrigger>
                <TabsTrigger className="h-8 w-full text-xs lg:w-auto" value="backlog">
                  Backlog
                </TabsTrigger>
              </>
            )}
            {showMyTasksOnly && (
              <>
                <TabsTrigger className="h-8 w-full text-xs lg:w-auto" value="myspace">
                  My Space
                </TabsTrigger>
                <TabsTrigger className="h-8 w-full text-xs lg:w-auto" value="table">
                  Table
                </TabsTrigger>
                <TabsTrigger className="h-8 w-full text-xs lg:w-auto" value="timeline">
                  Timeline
                </TabsTrigger>
                <TabsTrigger className="h-8 w-full text-xs lg:w-auto" value="my-backlog">
                  My Backlog
                </TabsTrigger>
              </>
            )}
          </TabsList>
          {isAdmin && (
            <Button onClick={open} size="xs" className="w-full font-medium px-3 py-2 tracking-tight !bg-[#2663ec] lg:w-auto">
              <PlusIcon className="size-3 " />
              Add Task
            </Button>
          )}
        </div>


        {hasProjectId && view !== "dashboard" && view !== "timeline" && view !== "backlog" && view !== "myspace" && (
          <DataFilters hideProjectFilter={hideProjectFilter} showMyTasksOnly={showMyTasksOnly} />
        )}


        {isLoadingTasks ? (
          <div className="w-full border rounded-lg h-[200px] flex flex-col items-center justify-center">
            <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <TabsContent value="myspace" className="mt-0 p-0">
              <MySpaceDashboard />
            </TabsContent>
            <TabsContent value="dashboard" className="mt-0 p-4">
              <DataDashboard tasks={filteredTasks?.documents} isLoading={isLoadingTasks} />
            </TabsContent>
            <TabsContent value="table" className="mt-0 p-4">
              <DataTable
                columns={createColumns(isAdmin, isAdmin)}
                data={filteredTasks?.documents ?? []}
              />
            </TabsContent>
            <TabsContent value="kanban" className="mt-0 p-4">
              <EnhancedDataKanban
                data={filteredTasks?.documents ?? []}
                onChange={onKanbanChange}
                canCreateTasks={isAdmin}
                canEditTasks={isAdmin}
                canDeleteTasks={isAdmin}
                members={members?.documents ?? []}
                projectId={paramProjectId || projectId || undefined}
              />
            </TabsContent>
            <TabsContent value="calendar" className="mt-0 h-full p-4 pb-4">
              <DataCalendar data={filteredTasks?.documents ?? []} />
            </TabsContent>
            <TabsContent value="timeline" className="mt-0 h-full">
              <TimelineView
                workspaceId={workspaceId}
                projectId={paramProjectId || projectId || undefined}
              />
            </TabsContent>
            {paramProjectId && (
              <TabsContent value="backlog" className="mt-0 h-full">
                <EnhancedBacklogScreen workspaceId={workspaceId} projectId={paramProjectId} />
              </TabsContent>
            )}
            {showMyTasksOnly && (
              <TabsContent value="my-backlog" className="mt-0 h-full">
                <MyBacklogView workspaceId={workspaceId} />
              </TabsContent>
            )}
          </>
        )}
      </div>
    </Tabs>
  );
};
