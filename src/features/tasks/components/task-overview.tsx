import { PencilIcon } from "lucide-react";

import { DottedSeparator } from "@/components/dotted-separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { snakeCaseToTitleCase } from "@/lib/utils";

import { MemberAvatar } from "@/features/members/components/member-avatar";
import { AssigneeAvatarGroup } from "./assignee-avatar-group";

import { OverviewProperty } from "./overview-property";
import { TaskDate } from "./task-date";

import { useEditTaskModal } from "../hooks/use-edit-task-modal";
import { TaskStatus, PopulatedTask } from "../types";

interface TaskOverviewProps {
  task: PopulatedTask;
  canEdit?: boolean;
}

export const TaskOverview = ({ task, canEdit = true }: TaskOverviewProps) => {
  const { open } = useEditTaskModal();

  return (
    <div className="flex flex-col gap-y-4 col-span-1">
      <div className="bg-muted rounded-lg p-4">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">Overview</p>
          {canEdit && (
            <Button onClick={() => open(task.$id)} size="sm" variant="secondary">
              <PencilIcon className="size-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
        <DottedSeparator className="my-4" />
        <div className="flex flex-col gap-y-4">
          <OverviewProperty label={task.assignees && task.assignees.length > 1 ? "Assignees" : "Assignee"}>
            {task.assignees && task.assignees.length > 0 ? (
              <div className="flex items-center gap-x-2">
                <AssigneeAvatarGroup
                  assignees={task.assignees}
                  visibleCount={3}
                  avatarClassName="size-6 border-2 border-white"
                  fallbackClassName="text-xs"
                  extraCountClassName="size-6 bg-muted border-2 border-white rounded-full flex items-center justify-center text-xs font-medium"
                  popoverAlign="start"
                  ariaLabel={`View ${task.assignees.length} assignees`}
                />
                <div className="flex flex-col">
                  <p className="text-sm font-medium">
                    {task.assignees.length === 1
                      ? task.assignees[0].name || task.assignees[0].email || "Unknown member"
                      : `${task.assignees.length} assignees`}
                  </p>
                  {task.assignees.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      {task.assignees
                        .slice(0, 2)
                        .map((a) => a.name || a.email || "Unknown member")
                        .join(", ")}
                      {task.assignees.length > 2 && "..."}
                    </p>
                  )}
                </div>
              </div>
            ) : task.assignee ? (
              <>
                <MemberAvatar
                  name={task.assignee.name}
                  className="size-6"
                  imageUrl={task.assignee.profileImageUrl}
                />
                <p className="text-sm font-medium">{task.assignee.name}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No assignee</p>
            )}
          </OverviewProperty>
          <OverviewProperty label="Due Date">
            <TaskDate value={task.dueDate} className="text-sm font-medium" />
          </OverviewProperty>
          <OverviewProperty label="Status">
            <Badge variant={Object.values(TaskStatus).includes(task.status as TaskStatus) ? task.status as TaskStatus : "secondary"}>
              {snakeCaseToTitleCase(task.status)}
            </Badge>
          </OverviewProperty>
          {task.estimatedHours && (
            <OverviewProperty label="Estimated Hours">
              <p className="text-sm font-medium">{task.estimatedHours}h</p>
            </OverviewProperty>
          )}
        </div>
      </div>
    </div>
  );
};
