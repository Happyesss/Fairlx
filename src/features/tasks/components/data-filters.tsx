import { useMemo } from "react";
import { FolderIcon, ListChecksIcon, UserIcon, AlertTriangleIcon, Settings2Icon } from "lucide-react";

import { useGetMembers } from "@/features/members/api/use-get-members";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { Project } from "@/features/projects/types";

import { DatePicker } from "@/components/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

import { useTaskFilters } from "../hooks/use-task-filters";
import { useGetCustomColumns } from "@/features/custom-columns/api/use-get-custom-columns";
import { CustomColumn } from "@/features/custom-columns/types";
import { statusIconMap } from "@/features/custom-columns/components/status-selector";
import { resolveIconSync } from "@/lib/resolve-icon";
import { TaskStatus, TaskPriority } from "../types";
import { PriorityIcon } from "./priority-selector";
import { LabelFilter } from "./label-management";
import { TaskSearch } from "./task-search";
import { useManageColumnsModal } from "@/features/custom-columns/hooks/use-manage-columns-modal";

interface DataFiltersProps {
  hideProjectFilter?: boolean;
  showMyTasksOnly?: boolean; // New prop to hide assignee filter in My Tasks
  projects?: Project[]; // Passed in My Space mode for cross-workspace filters
  disableManageColumns?: boolean; // Disable when project setup is needed
}

export const DataFilters = ({ hideProjectFilter, showMyTasksOnly, projects: passedProjects, disableManageColumns }: DataFiltersProps) => {
  const workspaceId = useWorkspaceId();
  const currentProjectId = useProjectId();

  // FETCH projects for current workspace if not passed (normal workspace view)
  const { data: projectsData, isLoading: isLoadingProjects } = useGetProjects({
    workspaceId,
  });
  const { data: members, isLoading: isLoadingMembers } = useGetMembers({
    workspaceId,
  });

  const projects = useMemo(() => passedProjects || projectsData?.documents || [], [passedProjects, projectsData?.documents]);

  const isLoading = isLoadingProjects || isLoadingMembers;

  const { open: openManageModal } = useManageColumnsModal();

  const projectOptions = projects?.map((project) => ({
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

  // Dynamically derive available labels from all relevant projects
  const availableLabels = useMemo(() => {
    if (!projects || projects.length === 0) {
      return [
        "frontend", "backend", "bug", "feature", "urgent", "documentation",
        "testing", "design", "security", "performance", "api", "ui/ux"
      ];
    }

    const labelSet = new Set<string>();
    projects.forEach(project => {
      project.customLabels?.forEach(label => {
        if (label.name) labelSet.add(label.name);
      });
    });

    // If no custom labels found in projects, fallback to defaults
    if (labelSet.size === 0) {
      return ["frontend", "backend", "bug", "feature", "urgent", "documentation"];
    }

    return Array.from(labelSet);
  }, [projects]);

  if (isLoading) return null;

  return (
    <div className="flex flex-col px-4 py-6 border-b border lg:flex-row gap-2">
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
          <SelectItem value={TaskStatus.TODO}>
            <div className="flex items-center text-xs gap-x-2">{statusIconMap[TaskStatus.TODO]}To Do</div>
          </SelectItem>
          <SelectItem value={TaskStatus.ASSIGNED}>
            <div className="flex items-center text-xs gap-x-2">{statusIconMap[TaskStatus.ASSIGNED]}Assigned</div>
          </SelectItem>
          <SelectItem value={TaskStatus.IN_PROGRESS}>
            <div className="flex items-center text-xs gap-x-2">{statusIconMap[TaskStatus.IN_PROGRESS]}In Progress</div>
          </SelectItem>
          <SelectItem value={TaskStatus.IN_REVIEW}>
            <div className="flex items-center text-xs gap-x-2">{statusIconMap[TaskStatus.IN_REVIEW]}In Review</div>
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
                const IconComp = c ? resolveIconSync(c.icon) : null;
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
        className="h-8 text-xs text-text w-full lg:w-auto"
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

      <Button
        size="sm"
        onClick={openManageModal}
        disabled={disableManageColumns}
        title={disableManageColumns ? "Complete project setup in Backlog first" : undefined}
        className="h-8 text-xs lg:ml-auto gap-2"
      >
        <Settings2Icon className="size-4 mr-2" />
        Manage Columns
      </Button>
    </div>
  );
};
