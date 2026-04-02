"use client";

import { useState } from "react";
import { Plus, Loader2, ListTodo } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

import { useCreateSubtask } from "../api/use-create-subtask";
import { useGetSubtasks } from "../api/use-get-subtasks";
import { SubtaskItem } from "./subtask-item";
import { SubtaskStatus } from "../types";

interface SubtasksListProps {
  workItemId: string;
  workspaceId: string;
  members?: Array<{ $id: string; name: string }>;
}

export const SubtasksList = ({ workItemId, workspaceId, members = [] }: SubtasksListProps) => {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const { data: subtasksData, isLoading } = useGetSubtasks({ 
    workspaceId, 
    parentTaskId: workItemId 
  });
  const { mutate: createSubtask, isPending: isCreating } = useCreateSubtask();

  const subtasks = subtasksData?.documents || [];
  
  // Calculate progress based on both completed and status
  const completedCount = subtasks.filter((st) => 
    st.isCompleted || st.completed || st.status === SubtaskStatus.DONE
  ).length;
  const inProgressCount = subtasks.filter((st) => 
    st.status === SubtaskStatus.IN_PROGRESS
  ).length;
  const totalCount = subtasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Calculate total estimated hours
  const totalEstimatedHours = subtasks.reduce((acc, st) => acc + (st.estimatedHours || 0), 0);
  const completedEstimatedHours = subtasks
    .filter((st) => st.isCompleted || st.completed || st.status === SubtaskStatus.DONE)
    .reduce((acc, st) => acc + (st.estimatedHours || 0), 0);

  const handleAddSubtask = () => {
    if (newSubtaskTitle.trim()) {
      createSubtask(
        {
          title: newSubtaskTitle.trim(),
          parentTaskId: workItemId,
          workspaceId,
          isCompleted: false,
        },
        {
          onSuccess: () => {
            setNewSubtaskTitle("");
            setIsAdding(false);
          },
        }
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAddSubtask();
    } else if (e.key === "Escape") {
      setNewSubtaskTitle("");
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <ListTodo className="size-4 text-muted-foreground" />
              <span className="font-medium">
                {completedCount} of {totalCount} completed
              </span>
              {inProgressCount > 0 && (
                <span className="text-muted-foreground">
                  ({inProgressCount} in progress)
                </span>
              )}
            </div>
            <span className="text-muted-foreground font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          {totalEstimatedHours > 0 && (
            <div className="text-xs text-muted-foreground">
              Estimated: {completedEstimatedHours}h / {totalEstimatedHours}h
            </div>
          )}
        </div>
      )}

      {/* Subtasks list */}
      <div className="space-y-2">
        {subtasks.map((subtask) => (
          <SubtaskItem
            key={subtask.$id}
            subtask={subtask}
            workspaceId={workspaceId}
            workItemId={workItemId}
            members={members}
            showDetails={true}
          />
        ))}
      </div>

      {/* Add new subtask */}
      {isAdding ? (
        <div className="flex gap-2">
          <Input
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a subtask..."
            className="h-9 text-sm"
            autoFocus
            disabled={isCreating}
          />
          <Button 
            onClick={handleAddSubtask} 
            size="sm" 
            className="h-9"
            disabled={isCreating || !newSubtaskTitle.trim()}
          >
            {isCreating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
          </Button>
          <Button 
            onClick={() => {
              setNewSubtaskTitle("");
              setIsAdding(false);
            }} 
            variant="ghost"
            size="sm" 
            className="h-9"
            disabled={isCreating}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-9 text-sm"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="size-4 mr-2" />
          Add subtask
        </Button>
      )}

      {/* Empty state */}
      {totalCount === 0 && !isAdding && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No subtasks yet. Click the button above to add one.
        </div>
      )}
    </div>
  );
};
