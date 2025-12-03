import { CalendarIcon, MoreHorizontalIcon, FlagIcon, MessageCircle } from "lucide-react";

import { TaskActions } from "./task-actions";
import { LabelBadge } from "./LabelBadge";
import { PriorityBadge } from "./PriorityBadge";
import { AssigneeAvatarGroup } from "./assignee-avatar-group";

import { PopulatedTask } from "../types";
import { useTaskDetailsModal } from "../hooks/use-task-details-modal";

interface KanbanCardProps {
    task: PopulatedTask;
    isSelected?: boolean;
    onSelect?: (taskId: string, selected: boolean) => void;
    showSelection?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
}

export const KanbanCard = ({
    task,
    isSelected = false,
    showSelection = false,
    canEdit = false,
    canDelete = false
}: KanbanCardProps) => {
    const { open } = useTaskDetailsModal();

    const assignees = task.assignees?.length
        ? task.assignees
        : task.assignee
            ? [task.assignee]
            : [];

    const handleCardClick = () => {
        open(task.$id);
    };

    return (
        <div
            onClick={handleCardClick}
            className={`bg-white mb-2.5 rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-blue-500' : ''
                } ${showSelection ? 'hover:bg-gray-50' : ''}`}
        >
            <div className="flex p-4 flex-col items-start justify-between gap-x-2">


                {/* {showSelection && (
          <div className="flex items-center">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelect?.(task.$id, !!checked)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )} */}

                <div className="flex-1 flex w-full justify-between ">

                    <div className="flex gap-2">
                        {task.priority && <PriorityBadge priority={task.priority} />}

                        {task.labels && task.labels.length > 0 && (
                            <div className="flex flex-wrap gap-1 ">
                                {task.labels.slice(0, 2).map((label, index) => (
                                    <LabelBadge key={index} label={label} />
                                ))}

                            </div>
                        )}

                    </div>


                    <div className="flex items-center gap-1">
                        <TaskActions
                            id={task.$id}
                            projectId={task.projectId}
                            flagged={task.flagged}
                            canEdit={canEdit}
                            canDelete={canDelete}
                        >
                            <MoreHorizontalIcon
                                className="size-[18px] stroke-1 shrink-0 text-neutral-700 hover:opacity-75 transition"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </TaskActions>
                    </div>

                </div>

                <div className="flex items-start gap-2 mt-4">
                    {task.flagged && (
                        <FlagIcon className="size-4 fill-red-500 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <h1 className="text-sm line-clamp-2 font-semibold flex-1">{task.name}</h1>
                </div>
                <p className="text-xs text-gray-600 mt-1 line-clamp-3">
                    {(() => {
                        const words = task.description?.split(/\s+/) ?? [];
                        const shouldEllipsize = words.length > 5 || words.some((w) => w.length > 20);
                        const preview = words
                            .slice(0, 5)
                            .map((word) => (word.length > 20 ? word.slice(0, 20) + "..." : word))
                            .join(" ");
                        return preview + (shouldEllipsize ? "....." : "");
                    })()}
                </p>


            </div>






            <div className="flex items-center border-t py-3 px-4 border-gray-200 gap-x-1.5 justify-between">
                <div className="flex items-center gap-x-3">
                    <p className="text-xs flex gap-0.5 items-center text-muted-foreground">
                        <CalendarIcon className="size-[14px] inline-block mr-1 text-gray-500" />
                        {task.dueDate
                            ? new Date(task.dueDate)
                                .toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                })
                                .replace(/ /g, "-")
                            : "No Date"}
                    </p>
                    {(task.commentCount ?? 0) > 0 && (
                        <p className="text-xs flex gap-0.5 items-center text-muted-foreground">
                            <MessageCircle className="size-[14px] text-gray-500" />
                            {task.commentCount}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-x-2">
                    {assignees.length > 0 ? (
                        <AssigneeAvatarGroup
                            assignees={assignees}
                            visibleCount={3}
                            avatarClassName="size-6 border-2 border-white"
                            fallbackClassName="text-xs"
                            extraCountClassName="size-6 rounded-full bg-muted text-xs font-medium flex items-center justify-center border-2 border-white"
                            popoverAlign="end"
                            ariaLabel={`View ${assignees.length} assignees`}
                        />
                    ) : (
                        <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                </div>
            </div>

        </div>
    );
};
