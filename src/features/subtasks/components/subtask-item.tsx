"use client";

import { useState } from "react";
import { X, Loader2, Calendar, Clock, User, ChevronDown, AlertCircle } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

import { Subtask, SubtaskStatus, SubtaskPriority } from "../types";
import { useUpdateSubtask } from "../api/use-update-subtask";
import { useDeleteSubtask } from "../api/use-delete-subtask";

interface SubtaskItemProps {
  subtask: Subtask;
  workspaceId: string;
  parentTaskId: string;
  members?: Array<{ $id: string; name: string }>;
  showDetails?: boolean;
}

const statusConfig: Record<SubtaskStatus, { label: string; color: string }> = {
  [SubtaskStatus.TODO]: { label: "To Do", color: "bg-muted text-muted-foreground border-border" },
  [SubtaskStatus.IN_PROGRESS]: { label: "In Progress", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  [SubtaskStatus.DONE]: { label: "Done", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
};

const priorityConfig: Record<SubtaskPriority, { label: string; color: string; icon?: boolean }> = {
  [SubtaskPriority.LOW]: { label: "Low", color: "text-gray-500" },
  [SubtaskPriority.MEDIUM]: { label: "Medium", color: "text-blue-500" },
  [SubtaskPriority.HIGH]: { label: "High", color: "text-orange-500", icon: true },
  [SubtaskPriority.URGENT]: { label: "Urgent", color: "text-red-500", icon: true },
};

export const SubtaskItem = ({
  subtask,
  workspaceId,
  parentTaskId,
  members = [],
  showDetails = true
}: SubtaskItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(subtask.title);
  const [isExpanded, setIsExpanded] = useState(false);

  const { mutate: updateSubtask, isPending: isUpdating } = useUpdateSubtask();
  const { mutate: deleteSubtask, isPending: isDeleting } = useDeleteSubtask();

  const handleToggleComplete = () => {
    const newIsCompleted = !subtask.isCompleted;
    updateSubtask({
      param: { subtaskId: subtask.$id },
      json: {
        isCompleted: newIsCompleted,
        status: newIsCompleted ? "DONE" : (subtask.status === "DONE" ? "TODO" : subtask.status)
      },
    });
  };

  const handleSaveTitle = () => {
    if (title.trim() && title !== subtask.title) {
      updateSubtask({
        param: { subtaskId: subtask.$id },
        json: { title: title.trim() },
      });
    }
    setIsEditing(false);
  };

  const handleUpdateStatus = (status: SubtaskStatus) => {
    updateSubtask({
      param: { subtaskId: subtask.$id },
      json: {
        status,
        isCompleted: status === SubtaskStatus.DONE
      },
    });
  };

  const handleUpdatePriority = (priority: SubtaskPriority) => {
    updateSubtask({
      param: { subtaskId: subtask.$id },
      json: { priority },
    });
  };

  const handleUpdateAssignee = (assigneeId: string | null) => {
    updateSubtask({
      param: { subtaskId: subtask.$id },
      json: { assigneeId },
    });
  };

  const handleUpdateDueDate = (date: Date | undefined) => {
    updateSubtask({
      param: { subtaskId: subtask.$id },
      json: { dueDate: date?.toISOString() || null },
    });
  };

  const handleDelete = () => {
    deleteSubtask({
      param: { subtaskId: subtask.$id },
      context: { workspaceId, parentTaskId },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveTitle();
    } else if (e.key === "Escape") {
      setTitle(subtask.title);
      setIsEditing(false);
    }
  };

  const currentStatus = (subtask.status as SubtaskStatus) || SubtaskStatus.TODO;
  const currentPriority = (subtask.priority as SubtaskPriority) || SubtaskPriority.MEDIUM;
  const assignee = members.find(m => m.$id === subtask.assigneeId);
  const isOverdue = subtask.dueDate && new Date(subtask.dueDate) < new Date() && !subtask.isCompleted;

  return (
    <div className="border rounded-lg p-2 hover:bg-muted/30 group transition-colors">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={subtask.isCompleted}
          onCheckedChange={handleToggleComplete}
          disabled={isUpdating || isDeleting}
          className="size-4"
        />

        {isEditing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm bg-transparent border-b border-border focus:outline-none focus:border-primary"
            autoFocus
          />
        ) : (
          <span
            onClick={() => setIsEditing(true)}
            className={cn(
              "text-sm flex-1 cursor-text",
              (subtask.isCompleted || subtask.completed) && "line-through text-muted-foreground"
            )}
          >
            {subtask.title}
          </span>
        )}

        {/* Quick indicators */}
        <div className="flex items-center gap-1">
          {currentPriority && priorityConfig[currentPriority]?.icon && (
            <AlertCircle className={cn("size-3", priorityConfig[currentPriority].color)} />
          )}
          {isOverdue && (
            <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
              Overdue
            </Badge>
          )}
        </div>

        {showDetails && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <ChevronDown className={cn("size-3 transition-transform", isExpanded && "rotate-180")} />
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <X className="size-3" />
          )}
        </Button>
      </div>

      {/* Expanded details */}
      {showDetails && isExpanded && (
        <div className="mt-2 pl-6 flex flex-wrap items-center gap-2 text-xs">
          {/* Status */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 text-xs">
                <Badge className={cn("text-[10px]", statusConfig[currentStatus].color)}>
                  {statusConfig[currentStatus].label}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {Object.entries(statusConfig).map(([key, config]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => handleUpdateStatus(key as SubtaskStatus)}
                >
                  {config.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Priority */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 text-xs gap-1">
                <AlertCircle className={cn("size-3", priorityConfig[currentPriority].color)} />
                {priorityConfig[currentPriority].label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {Object.entries(priorityConfig).map(([key, config]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => handleUpdatePriority(key as SubtaskPriority)}
                  className={config.color}
                >
                  {config.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Assignee */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 text-xs gap-1">
                <User className="size-3" />
                {assignee ? assignee.name : "Unassigned"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleUpdateAssignee(null)}>
                Unassigned
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {members.map((member) => (
                <DropdownMenuItem
                  key={member.$id}
                  onClick={() => handleUpdateAssignee(member.$id)}
                >
                  {member.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Due Date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(
                "h-6 text-xs gap-1",
                isOverdue && "border-red-300 text-red-600"
              )}>
                <Calendar className="size-3" />
                {subtask.dueDate ? format(new Date(subtask.dueDate), "MMM d") : "No date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarUI
                mode="single"
                selected={subtask.dueDate ? new Date(subtask.dueDate) : undefined}
                onSelect={handleUpdateDueDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* Estimated hours */}
          {subtask.estimatedHours && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Clock className="size-3" />
              {subtask.estimatedHours}h
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};
