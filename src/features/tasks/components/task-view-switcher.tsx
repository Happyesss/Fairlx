"use client";

import { LoaderIcon, PlusIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useCallback, useState } from "react";

import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useCurrent } from "@/features/auth/api/use-current";

import { DottedSeparator } from "@/components/dotted-separator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { columns } from "./columns";
import { DataCalendar } from "./data-calendar";
import { DataFilters } from "./data-filters";
import { DataKanban } from "./data-kanban";
import { DataTable } from "./data-table";
import { SimpleTimeline } from "./simple-timeline";
// Use full EnhancedDataKanban so custom columns show up
import { EnhancedDataKanban } from "@/features/custom-columns/components/enhanced-data-kanban";

import { useGetTasks } from "../api/use-get-tasks";
import { useCreateTaskModal } from "../hooks/use-create-task-modal";
import { useTaskFilters } from "../hooks/use-task-filters";
import { TaskStatus } from "../types";
import { useBulkUpdateTasks } from "../api/use-bulk-update-tasks";
import { EnhancedTimeline } from "./enhanced-timeline";

interface TaskViewSwitcherProps {
  hideProjectFilter?: boolean;
  showMyTasksOnly?: boolean; // New prop to filter by current user
}

export const TaskViewSwitcher = ({
  hideProjectFilter,
  showMyTasksOnly = false,
}: TaskViewSwitcherProps) => {



  const [{ status, assigneeId, projectId, dueDate }] = useTaskFilters();
  const [view, setView] = useQueryState("task-view", { defaultValue: "table" });
  const [timelineView, setTimelineView] = useState<'simple' | 'enhanced'>('enhanced');
  const { mutate: bulkUpdate } = useBulkUpdateTasks();

  const workspaceId = useWorkspaceId();
  const paramProjectId = useProjectId();

  // Get current user data
  const { data: currentUser } = useCurrent();
  const { member: currentMember, isAdmin } = useCurrentMember({ workspaceId });
  const { data: members } = useGetMembers({ workspaceId });

  // Determine the effective assigneeId - if showMyTasksOnly is true, use current member's ID
  const effectiveAssigneeId = showMyTasksOnly && currentMember ? currentMember.$id : assigneeId;

  const { data: tasks, isLoading: isLoadingTasks } = useGetTasks({
    workspaceId,
    projectId: paramProjectId || projectId,
    assigneeId: effectiveAssigneeId,
    status,
    dueDate,
  });





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
      <div className="h-full flex flex-col overflow-auto p-4">
        <div className="flex flex-col gap-y-2 lg:flex-row justify-between items-center">
          <TabsList className="w-full lg:w-auto">
            <TabsTrigger className="h-8 w-full lg:w-auto" value="table">
              Table
            </TabsTrigger>
            <TabsTrigger className="h-8 w-full lg:w-auto" value="kanban">
              Kanban
            </TabsTrigger>
            <TabsTrigger className="h-8 w-full lg:w-auto" value="calendar">
              Calendar
            </TabsTrigger>
            <TabsTrigger className="h-8 w-full lg:w-auto" value="timeline">
              Timeline
            </TabsTrigger>
          </TabsList>
          <Button onClick={open} size="sm" className="w-full lg:w-auto">
            <PlusIcon className="size-4 mr-2" />
            New
          </Button>
        </div>
        <DottedSeparator className="my-4" />
        <DataFilters hideProjectFilter={hideProjectFilter} showMyTasksOnly={showMyTasksOnly} />
        <DottedSeparator className="my-4" />
        {isLoadingTasks ? (
          <div className="w-full border rounded-lg h-[200px] flex flex-col items-center justify-center">
            <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <TabsContent value="table" className="mt-0">
              <DataTable columns={columns} data={tasks?.documents ?? []} />
            </TabsContent>
            <TabsContent value="kanban" className="mt-0">
              <EnhancedDataKanban
                data={tasks?.documents ?? []}
                onChange={onKanbanChange}
                isAdmin={isAdmin}
                members={members?.documents ?? []}
                projectId={paramProjectId || projectId || undefined}
                showMyTasksOnly={showMyTasksOnly}
              />
            </TabsContent>
            <TabsContent value="calendar" className="mt-0 h-full pb-4">
              <DataCalendar data={tasks?.documents ?? []} />
            </TabsContent>
            <TabsContent value="timeline" className="mt-0 h-full pb-4">
              <div className="flex items-center gap-2 mb-4">
                <Button
                  size="sm"
                  variant={timelineView === 'simple' ? 'primary' : 'secondary'}
                  onClick={() => setTimelineView('simple')}
                  className="transition-all"
                >
                  Simple View
                </Button>
                <Button
                  size="sm"
                  variant={timelineView === 'enhanced' ? 'primary' : 'secondary'}
                  onClick={() => setTimelineView('enhanced')}
                  className="transition-all"
                >
                  Enhanced View
                </Button>
              </div>
              {timelineView === 'simple' ? (
                <SimpleTimeline data={tasks?.documents ?? []} />
              ) : (
                // <SimpleTimeline data={tasks?.documents ?? []} />
                <div className="h-screen bg-gray-50 overflow-auto">
                  <EnhancedTimeline data={tasks?.documents ?? []} />
                </div>
              )}
            </TabsContent>
          </>
        )}
      </div>
    </Tabs>
  );
};
