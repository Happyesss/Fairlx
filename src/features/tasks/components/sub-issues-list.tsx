"use client";

import { Plus, ChevronDown, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGetTasks } from "../api/use-get-tasks";
import { TaskStatus, PopulatedTask } from "../types";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface SubIssuesListProps {
  parentTaskId: string;
  workspaceId: string;
  onAddSubIssue: () => void;
}

export const SubIssuesList = ({
  parentTaskId,
  workspaceId,
  onAddSubIssue,
}: SubIssuesListProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const router = useRouter();

  const { data: subIssues, isLoading } = useGetTasks({
    workspaceId,
    parentTaskId,
  });

  const subIssueCount = subIssues?.documents?.length || 0;
  const completedCount = subIssues?.documents?.filter(
    (task: PopulatedTask) => task.status === TaskStatus.DONE
  ).length || 0;

  const handleSubIssueClick = (taskId: string) => {
    router.push(`/workspaces/${workspaceId}/tasks/${taskId}`);
  };

  const isCompleted = (status: TaskStatus | string) => {
    return status === TaskStatus.DONE;
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>Sub-issues</span>
          {subIssueCount > 0 && (
            <span className="text-xs text-muted-foreground ml-1">
              ({completedCount}/{subIssueCount})
            </span>
          )}
        </button>
        <button
          onClick={onAddSubIssue}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus size={14} />
          <span>Add</span>
        </button>
      </div>

      {/* Sub-issues list */}
      {isExpanded && (
        <div className="pl-5 space-y-1">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          ) : subIssueCount === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No sub-issues yet
            </p>
          ) : (
            subIssues?.documents?.map((subIssue: PopulatedTask) => (
              <div
                key={subIssue.$id}
                onClick={() => handleSubIssueClick(subIssue.$id)}
                className={cn(
                  "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
                  "hover:bg-muted/50"
                )}
              >
                {/* Status icon */}
                {isCompleted(subIssue.status) ? (
                  <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                ) : (
                  <Circle size={16} className="text-muted-foreground shrink-0" />
                )}
                
                {/* Task key */}
                {subIssue.key && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {subIssue.key}
                  </span>
                )}
                
                {/* Task title */}
                <span
                  className={cn(
                    "text-sm truncate",
                    isCompleted(subIssue.status) && "text-muted-foreground line-through"
                  )}
                >
                  {subIssue.title || subIssue.name}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
