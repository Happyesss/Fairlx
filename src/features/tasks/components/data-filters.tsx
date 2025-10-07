import { FolderIcon, ListChecksIcon, UserIcon, AlertTriangleIcon } from "lucide-react";

import { useGetMembers } from "@/features/members/api/use-get-members";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useProjectId } from "@/features/projects/hooks/use-project-id";

import { DatePicker } from "@/components/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useTaskFilters } from "../hooks/use-task-filters";
import { useGetCustomColumns } from "@/features/custom-columns/api/use-get-custom-columns";
import { CustomColumn } from "@/features/custom-columns/types";
import { allIcons, statusIconMap } from "@/features/custom-columns/components/status-selector";
import { TaskStatus, TaskPriority } from "../types";
import { PriorityIcon } from "./priority-selector";
import { LabelFilter } from "./label-management";
import { TaskSearch } from "./task-search";

interface DataFiltersProps {
  hideProjectFilter?: boolean;
  showMyTasksOnly?: boolean; // New prop to hide assignee filter in My Tasks
}

export const DataFilters = ({ hideProjectFilter, showMyTasksOnly }: DataFiltersProps) => {
  const workspaceId = useWorkspaceId();
  const currentProjectId = useProjectId();

  const { data: projects, isLoading: isLoadingProjects } = useGetProjects({
    workspaceId,
  });
  const { data: members, isLoading: isLoadingMembers } = useGetMembers({
    workspaceId,
  });

  const isLoading = isLoadingProjects || isLoadingMembers;

  const projectOptions = projects?.documents.map((project) => ({
    value: project.$id,
    label: project.name,
  }));

  const memberOptions = members?.documents.map((member) => ({
    value: member.$id,
    label: member.name,
  }));

  const [{ status, assigneeId, projectId, dueDate, priority, labels }, setFilters] =
    useTaskFilters();

  const { data: customColumnsData } = useGetCustomColumns({ 
    workspaceId, 
    projectId: currentProjectId 
  });

  const customColumnOptions: { value: string; label: string }[] | undefined =
    customColumnsData?.documents?.map((col) => {
      const c = col as unknown as CustomColumn;
      return { value: c.$id, label: c.name };
    });

  const onStatusChange = (value: string) => {
    if (value === "all") {
      setFilters({ status: null });
    } else {
      setFilters({ status: value as TaskStatus });
    }
  };

  const onAssigneeChange = (value: string) => {
    if (value === "all") {
      setFilters({ assigneeId: null });
    } else {
      setFilters({ assigneeId: value as string });
    }
  };

  const onProjectChange = (value: string) => {
    if (value === "all") {
      setFilters({ projectId: null });
    } else {
      setFilters({ projectId: value as string });
    }
  };

  const onPriorityChange = (value: TaskPriority) => {
    setFilters({ priority: value });
  };

  const onLabelsChange = (newLabels: string[]) => {
    setFilters({ labels: newLabels.length > 0 ? newLabels : null });
  };

  // Mock available labels - in a real app, this would come from an API
  const availableLabels = [
    "frontend", "backend", "bug", "feature", "urgent", "documentation", 
    "testing", "design", "security", "performance", "api", "ui/ux"
  ];

  if (isLoading) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-2">
      <TaskSearch className="w-full text-xs lg:w-64" />
      
      <Select
        value={status ?? "all"}
        onValueChange={(value) => {
          onStatusChange(value);
        }}
      >
        
        <SelectTrigger className="w-full lg:w-auto h-8">
          <div className="flex text-xs items-center pr-2">
            <ListChecksIcon className="size-4 mr-2" />
            <SelectValue placeholder="All statuses" />
          </div>
        </SelectTrigger>


        <SelectContent >
          <SelectItem value="all" className="text-xs">All statuses</SelectItem>
          <SelectSeparator />
          <SelectItem value={TaskStatus.BACKLOG}>
            <div className="flex items-center text-xs gap-x-2">{statusIconMap[TaskStatus.BACKLOG]}Backlog</div>
          </SelectItem>
          <SelectItem value={TaskStatus.IN_PROGRESS}>
            <div className="flex items-center text-xs gap-x-2">{statusIconMap[TaskStatus.IN_PROGRESS]}In Progress</div>
          </SelectItem>
          <SelectItem value={TaskStatus.IN_REVIEW}>
            <div className="flex items-center text-xs gap-x-2">{statusIconMap[TaskStatus.IN_REVIEW]}In Review</div>
          </SelectItem>
          <SelectItem value={TaskStatus.TODO}>
            <div className="flex items-center text-xs gap-x-2">{statusIconMap[TaskStatus.TODO]}Todo</div>
          </SelectItem>
          <SelectItem value={TaskStatus.DONE}>
            <div className="flex items-center text-xs gap-x-2">{statusIconMap[TaskStatus.DONE]}Done</div>
          </SelectItem>

          {customColumnOptions && customColumnOptions.length > 0 && (
            <>
              <SelectSeparator />
              {customColumnOptions.map((col) => {
                const raw = customColumnsData?.documents?.find((d) => d.$id === col.value);
                const c = raw as unknown as CustomColumn | undefined;
                const IconComp = c ? (allIcons[c.icon as keyof typeof allIcons] as React.ComponentType<React.SVGProps<SVGSVGElement>>) : null;
                const icon = IconComp ? (
                  <IconComp className="size-[18px]" style={{ color: c?.color }} />
                ) : (
                  <span className="w-4 h-4 rounded-full" style={{ background: c?.color }} />
                );

                return (
                  <SelectItem key={col.value} value={col.value}>
                    <div className="flex items-center gap-x-2">{icon}{col.label}</div>
                  </SelectItem>
                );
              })}
            </>
          )}
        </SelectContent>
      </Select>
      {!showMyTasksOnly && (
        <Select
          value={assigneeId ?? "all"}
          onValueChange={(value) => {
            onAssigneeChange(value);
          }}
        >
          <SelectTrigger className="w-full lg:w-auto h-8">
            <div className="flex text-xs items-center pr-2">
              <UserIcon className="size-4 mr-2" />
              <SelectValue placeholder="All assignees" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem className="text-xs" value="all">All assignees</SelectItem>
            <SelectSeparator />
            {memberOptions?.map((member) => (
              <SelectItem className="text-xs" key={member.value} value={member.value}>
                {member.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}


      {!hideProjectFilter && (
        <Select
          value={projectId ?? "all"}
          onValueChange={(value) => {
            onProjectChange(value);
          }}
        >
          <SelectTrigger className="w-full lg:w-auto h-8">
            <div className="flex items-center pr-2">
              <FolderIcon className="size-4 mr-2" />
              <SelectValue placeholder="All projects" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            <SelectSeparator />
            {projectOptions?.map((project) => (
              <SelectItem key={project.value} value={project.value}>
                {project.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <DatePicker
        placeholder="Due date"
        className="h-8 text-xs w-full lg:w-auto"
        value={dueDate ? new Date(dueDate) : undefined}
        onChange={(date) => {
          setFilters({ dueDate: date ? date.toISOString() : null });
        }}
      />
      
      <Select
        value={priority ?? "all"}
        onValueChange={(value) => {
          if (value === "all") {
            setFilters({ priority: null });
          } else {
            onPriorityChange(value as TaskPriority);
          }
        }}
      >
        <SelectTrigger className="w-full !text-xs lg:w-auto h-8">
          <div className="flex items-center pr-2">
            <AlertTriangleIcon className="size-4 mr-2" />
            <SelectValue placeholder="All priorities">
              {priority && (
                <div className="flex items-center">
                  <PriorityIcon priority={priority as TaskPriority} className="mr-2" />
                  {priority}
                </div>
              )}
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent className="!text-xs">
          <SelectItem className="text-xs" value="all">All priorities</SelectItem>
          <SelectSeparator />
          {Object.values(TaskPriority).map((priorityValue) => (
            <SelectItem key={priorityValue} value={priorityValue}>
              <div className="flex text-xs items-center">
                <PriorityIcon priority={priorityValue as TaskPriority} className="mr-2" />
                {priorityValue}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="w-full  lg:w-auto">
        <LabelFilter
          selectedLabels={labels ?? []}
          onLabelsChange={onLabelsChange}
          availableLabels={availableLabels}
          placeholder="Filter by labels"
          
        />
      </div>
    </div>
  );
};
