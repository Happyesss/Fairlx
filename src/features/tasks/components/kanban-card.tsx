import { CalendarIcon, MoreHorizontalIcon, FlagIcon, MessageCircle, GitCommit, GitPullRequest } from "lucide-react";
import { Project } from "@/features/projects/types";
import { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { useGetTaskGitHubEvents } from "@/features/github-integration/api/use-github";

import { TaskActions } from "./task-actions";
import { LabelBadge } from "./LabelBadge";
import { PriorityBadge } from "./priority-selector";
import { AssigneeAvatarGroup } from "./assignee-avatar-group";
import { WorkItemIcon } from "@/features/timeline/components/work-item-icon";

import { PopulatedTask } from "../types";
import { useTaskPreviewModal } from "../hooks/use-task-preview-modal";

interface KanbanCardProps {
    task: PopulatedTask;
    isSelected?: boolean;
    onSelect?: (taskId: string, selected: boolean) => void;
    showSelection?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    project?: Project;
    dragHandleProps?: DraggableProvidedDragHandleProps | null;
}

export const KanbanCard = ({
    task,
    isSelected = false,
    showSelection = false,
    canEdit = false,
    canDelete = false,
    project,
    dragHandleProps
}: KanbanCardProps) => {
    const { open: openPreview } = useTaskPreviewModal();

    const { data: githubEvents } = useGetTaskGitHubEvents(task.key || "", !!task.key);
    const commitCount = githubEvents?.commits?.length || 0;
    const prCount = githubEvents?.pullRequests?.length || 0;



    const assignees = task.assignees?.length
        ? task.assignees
        : task.assignee
            ? [task.assignee]
            : [];

    const handleCardClick = () => {
        // Prevent opening if the click originated from actions or other interactive elements
        // (Though stopPropagation on those elements usually handles this, it's good to be safe)
        openPreview(task.$id);
    };

    const customPriority = project?.customPriorities?.find(p => p.key === task.priority);
    const customLabels = project?.customLabels || [];

    return (
        <div
            onClick={handleCardClick}
            {...dragHandleProps}
            className={`bg-card mb-2.5 rounded-xl border border-border shadow-sm group hover:shadow-md transition-shadow relative cursor-grab active:cursor-grabbing ${isSelected ? 'ring-2 ring-primary' : ''
                } ${showSelection ? 'hover:bg-accent' : ''}`}
        >
            <div className="flex p-4 flex-col items-start justify-between gap-x-2">

                {/* Row 1: Work Item Type + Priority + Actions */}
                <div className="flex w-full justify-between items-center">
                    <div className="flex gap-2 items-center">
                        {task.type && (
                            <WorkItemIcon
                                type={task.type}
                                className="size-4"
                                project={project}
                            />
                        )}
                        {task.priority && (
                            <PriorityBadge
                                className="px-1"
                                priority={task.priority}
                                color={customPriority?.color}
                            />
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
                                className="size-[18px] stroke-1 shrink-0 text-muted-foreground hover:opacity-75 transition"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </TaskActions>
                    </div>
                </div>

                {/* Row 2-3: Labels (max 2 rows with overflow +N) */}
                {task.labels && task.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 max-h-[3.25rem] overflow-hidden items-start w-full">
                        {(() => {
                            const maxVisible = 4; // Show up to 4 labels across 2 rows
                            const visibleLabels = task.labels.slice(0, maxVisible);
                            const hiddenCount = task.labels.length - maxVisible;
                            return (
                                <>
                                    {visibleLabels.map((label, index) => {
                                        const customLabel = customLabels.find(l => l.name === label);
                                        return (
                                            <div key={index} className="max-w-full">
                                                <LabelBadge
                                                    label={label}
                                                    color={customLabel?.color}
                                                />
                                            </div>
                                        );
                                    })}
                                    {hiddenCount > 0 && (
                                        <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 border border-border whitespace-nowrap flex-shrink-0">
                                            +{hiddenCount}
                                        </span>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                )}

                <div className="flex items-start gap-2 mt-4 cursor-pointer">
                    {task.flagged && (
                        <FlagIcon className="size-4 fill-red-500 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <h1 className="text-sm line-clamp-2 font-semibold flex-1 mb-1">{task.name}</h1>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                    {(() => {
                        // Strip HTML tags for plain text preview
                        const plainText = task.description
                            ?.replace(/<[^>]*>/g, " ")
                            .replace(/&nbsp;/g, " ")
                            .replace(/\s+/g, " ")
                            .trim() ?? "";
                        const words = plainText.split(/\s+/).filter(Boolean);
                        const shouldEllipsize = words.length > 5 || words.some((w) => w.length > 20);
                        const preview = words
                            .slice(0, 5)
                            .map((word) => (word.length > 20 ? word.slice(0, 20) + "..." : word))
                            .join(" ");
                        return preview + (shouldEllipsize ? "....." : "");
                    })()}
                </p>


            </div>






            <div className="flex items-center border-t py-3 px-4 border-border gap-x-1.5 justify-between bg-muted/50 rounded-b-xl">
                <div className="flex items-center gap-x-3">
                    <p className="text-xs flex gap-0.5 items-center text-muted-foreground">
                        <CalendarIcon className="size-[14px] inline-block mr-1 text-muted-foreground" />
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

                    <p className="text-xs flex gap-0.5 items-center text-muted-foreground">
                        <MessageCircle className="size-[14px] text-muted-foreground" />
                        {task.commentCount ?? 0}
                    </p>

                    {commitCount > 0 && (
                        <p className="text-[11px] flex gap-0.5 items-center text-muted-foreground" title={`${commitCount} linked commits`}>
                            <GitCommit className="size-[14px] text-blue-500" />
                            {commitCount}
                        </p>
                    )}

                    {prCount > 0 && (
                        <p className="text-[11px] flex gap-0.5 items-center text-muted-foreground" title={`${prCount} linked pull requests`}>
                            <GitPullRequest className="size-[14px] text-purple-500" />
                            {prCount}
                        </p>
                    )}

                </div>

                <div className="flex items-center gap-x-2">
                    {assignees.length > 0 ? (
                        <AssigneeAvatarGroup
                            assignees={assignees}
                            visibleCount={3}
                            avatarClassName="size-6 border-2 border-background"
                            fallbackClassName="text-xs"
                            extraCountClassName="size-6 rounded-full bg-muted text-xs font-medium flex items-center justify-center border-2 border-background"
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
