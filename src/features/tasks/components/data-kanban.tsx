import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { PlusIcon, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { KanbanCard } from "./kanban-card";
import { KanbanColumnHeader } from "./kanban-column-header";
import { BulkActionsToolbar } from "./bulk-actions-toolbar";

import { Task, TaskStatus } from "../types";
import { useBulkUpdateTasks } from "../api/use-bulk-update-tasks";
import { useCreateTaskModal } from "../hooks/use-create-task-modal";
import { useGetProject } from "@/features/projects/api/use-get-project";
import { useValidateTransition, TransitionValidationResult } from "@/features/workflows/api/use-validate-transition";
import { useGetWorkflowStatuses } from "@/features/workflows/api/use-get-workflow-statuses";

const boards: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.ASSIGNED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.DONE,
];

type TasksState = {
  [key in TaskStatus]: Task[];
};

interface DataKanbanProps {
  data: Task[];
  onChange: (
    tasks: { $id: string; status: TaskStatus; position: number }[]
  ) => void;
  canCreateTasks?: boolean;
  canEditTasks?: boolean;
  canDeleteTasks?: boolean;
  members?: Array<{ $id: string; name: string }>;
  projectId?: string;
}

export const DataKanban = ({
  data,
  onChange,
  canCreateTasks = true,
  canEditTasks = true,
  canDeleteTasks = true,
  members = [],
  projectId
}: DataKanbanProps) => {
  const [tasks, setTasks] = useState<TasksState>(() => {
    const initialTasks: TasksState = {
      [TaskStatus.TODO]: [],
      [TaskStatus.ASSIGNED]: [],
      [TaskStatus.IN_PROGRESS]: [],
      [TaskStatus.IN_REVIEW]: [],
      [TaskStatus.DONE]: [],
    };

    data.forEach((task) => {
      // Only add to initialTasks if it's a valid TaskStatus, ignore custom columns
      if (task.status in initialTasks) {
        initialTasks[task.status as TaskStatus].push(task);
      }
    });

    Object.keys(initialTasks).forEach((status) => {
      initialTasks[status as TaskStatus].sort(
        (a, b) => a.position - b.position
      );
    });

    return initialTasks;
  });

  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [sortDirections, setSortDirections] = useState<Record<TaskStatus, 'asc' | 'desc'>>({
    [TaskStatus.TODO]: 'asc',
    [TaskStatus.ASSIGNED]: 'asc',
    [TaskStatus.IN_PROGRESS]: 'asc',
    [TaskStatus.IN_REVIEW]: 'asc',
    [TaskStatus.DONE]: 'asc',
  });

  const { mutate: bulkUpdateTasks } = useBulkUpdateTasks();
  const { open: openCreateTask } = useCreateTaskModal();
  const { mutateAsync: validateTransition } = useValidateTransition();

  // Check if TODO column should be visible (only when tasks are TODO or unassigned)
  const shouldShowTodoColumn = useMemo(() => {
    return data.some(task =>
      task.status === TaskStatus.TODO ||
      !task.assigneeIds ||
      task.assigneeIds.length === 0
    );
  }, [data]);

  // Filter columns based on visibility rules
  const visibleBoards = useMemo(() => {
    return boards.filter(board => {
      if (board === TaskStatus.TODO) {
        return shouldShowTodoColumn;
      }
      return true;
    });
  }, [shouldShowTodoColumn]);

  // Fetch project settings to pass custom options to cards
  const { data: project } = useGetProject({ projectId, enabled: !!projectId });

  useEffect(() => {
    const newTasks: TasksState = {
      [TaskStatus.TODO]: [],
      [TaskStatus.ASSIGNED]: [],
      [TaskStatus.IN_PROGRESS]: [],
      [TaskStatus.IN_REVIEW]: [],
      [TaskStatus.DONE]: [],
    };

    data.forEach((task) => {
      // Only add to newTasks if it's a valid TaskStatus, ignore custom columns
      if (task.status in newTasks) {
        newTasks[task.status as TaskStatus].push(task);
      }
    });

    Object.keys(newTasks).forEach((status) => {
      newTasks[status as TaskStatus].sort((a, b) => a.position - b.position);
    });

    setTasks(newTasks);
  }, [data]);

  const handleTaskSelect = useCallback((taskId: string, selected: boolean) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(taskId);
      } else {
        newSet.delete(taskId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((status: TaskStatus, selected: boolean) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      const statusTasks = tasks[status];

      if (selected) {
        statusTasks.forEach(task => newSet.add(task.$id));
      } else {
        statusTasks.forEach(task => newSet.delete(task.$id));
      }

      return newSet;
    });
  }, [tasks]);

  const handleClearSelection = useCallback(() => {
    setSelectedTasks(new Set());
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => !prev);
    if (selectionMode) {
      setSelectedTasks(new Set());
    }
  }, [selectionMode]);

  const handleClearColumnSelection = useCallback((status: TaskStatus) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      const statusTasks = tasks[status];
      statusTasks.forEach(task => newSet.delete(task.$id));
      return newSet;
    });
  }, [tasks]);

  const handleSortByPriority = useCallback((status: TaskStatus) => {
    // Toggle sort direction
    const newDirection = sortDirections[status] === 'asc' ? 'desc' : 'asc';
    setSortDirections(prev => ({ ...prev, [status]: newDirection }));

    setTasks(prev => {
      const newTasks = { ...prev };
      const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      newTasks[status] = [...newTasks[status]].sort((a, b) => {
        const aPriority = a.priority ? priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4 : 4;
        const bPriority = b.priority ? priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4 : 4;
        const comparison = aPriority - bPriority;
        return newDirection === 'asc' ? comparison : -comparison;
      });

      // Update positions after sorting
      const updates = newTasks[status].map((task, index) => ({
        $id: task.$id,
        status,
        position: Math.min((index + 1) * 1000, 1_000_000),
      }));

      // Persist the new positions
      onChange(updates);

      return newTasks;
    });
  }, [onChange, sortDirections]);

  const handleSortByDueDate = useCallback((status: TaskStatus) => {
    // Toggle sort direction
    const newDirection = sortDirections[status] === 'asc' ? 'desc' : 'asc';
    setSortDirections(prev => ({ ...prev, [status]: newDirection }));

    setTasks(prev => {
      const newTasks = { ...prev };
      newTasks[status] = [...newTasks[status]].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        const comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        return newDirection === 'asc' ? comparison : -comparison;
      });

      // Update positions after sorting
      const updates = newTasks[status].map((task, index) => ({
        $id: task.$id,
        status,
        position: Math.min((index + 1) * 1000, 1_000_000),
      }));

      // Persist the new positions
      onChange(updates);

      return newTasks;
    });
  }, [onChange, sortDirections]);

  const handleBulkStatusChange = useCallback((status: TaskStatus | string) => {
    if (selectedTasks.size === 0) return;

    const updates = Array.from(selectedTasks).map(taskId => ({
      $id: taskId,
      status,
    }));

    bulkUpdateTasks({
      json: { tasks: updates }
    });

    setSelectedTasks(new Set());
  }, [selectedTasks, bulkUpdateTasks]);

  const handleBulkAssigneeChange = useCallback((assigneeId: string) => {
    if (selectedTasks.size === 0) return;

    const updates = Array.from(selectedTasks).map(taskId => ({
      $id: taskId,
      assigneeIds: [assigneeId], // Replace all assignees with the selected one
    }));

    bulkUpdateTasks({
      json: { tasks: updates }
    });

    setSelectedTasks(new Set());
  }, [selectedTasks, bulkUpdateTasks]);

  // Get workflow statuses to find status IDs
  const { data: workflowStatusesData } = useGetWorkflowStatuses({
    workflowId: project?.workflowId || ""
  });

  // Create a map of status keys to status IDs for workflow validation
  const statusKeyToIdMap = useMemo(() => {
    const map = new Map<string, string>();
    if (workflowStatusesData?.documents) {
      workflowStatusesData.documents.forEach((status: { key: string; $id: string }) => {
        map.set(status.key, status.$id);
      });
    }
    return map;
  }, [workflowStatusesData]);

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return;

      const { source, destination } = result;
      
      // If dropped in the same position, do nothing
      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      ) {
        return;
      }

      const sourceStatus = source.droppableId as TaskStatus;
      const destStatus = destination.droppableId as TaskStatus;

      // Early return if no actual movement
      if (sourceStatus === destStatus && source.index === destination.index) {
        return;
      }

      // Get the task being moved
      const movedTask = tasks[sourceStatus]?.[source.index];
      if (!movedTask) {
        return;
      }

      // Store previous state for potential rollback
      const previousTasks = { ...tasks };

      // OPTIMISTIC UPDATE FIRST - update UI immediately for smooth UX
      const updatesPayload: {
        $id: string;
        status: TaskStatus;
        position: number;
      }[] = [];

      setTasks((prevTasks) => {
        const newTasks = { ...prevTasks };

        // Safely remove the task from the source column
        const sourceColumn = [...(newTasks[sourceStatus] || [])];
        const [draggedTask] = sourceColumn.splice(source.index, 1);

        // If there's no moved task (shouldn't happen, but just in case), return the previous state
        if (!draggedTask) {
          return prevTasks;
        }

        // Create a new task object with potentially updated status
        const updatedMovedTask =
          sourceStatus !== destStatus
            ? { ...draggedTask, status: destStatus }
            : draggedTask;

        // Update the source column
        newTasks[sourceStatus] = sourceColumn;

        // Add the task to the destination column
        const destColumn = [...(newTasks[destStatus] || [])];
        destColumn.splice(destination.index, 0, updatedMovedTask);
        newTasks[destStatus] = destColumn;

        // Only update the moved task - not all tasks in the column
        // This dramatically reduces API calls
        updatesPayload.push({
          $id: updatedMovedTask.$id,
          status: destStatus,
          position: Math.min((destination.index + 1) * 1000, 1_000_000),
        });

        return newTasks;
      });

      // ======= WORKFLOW TRANSITION VALIDATION =======
      // If moving to a different column and project has a workflow, validate the transition
      if (sourceStatus !== destStatus && project?.workflowId) {
        const fromStatusId = statusKeyToIdMap.get(sourceStatus);
        const toStatusId = statusKeyToIdMap.get(destStatus);

        // If workflow is active but statuses not found, rollback and block
        if (!fromStatusId || !toStatusId) {
          setTasks(previousTasks);
          toast.error(
            "Cannot validate this transition - status not found in workflow",
            {
              icon: <AlertCircle className="size-4 text-red-500" />,
              duration: 4000,
            }
          );
          return;
        }

        try {
          const validationResult = await validateTransition({
            json: {
              workflowId: project.workflowId,
              fromStatusId,
              toStatusId,
            },
          });

          const data = validationResult.data as TransitionValidationResult;

          if (!data.allowed) {
            // Transition is not allowed - rollback and show error
            setTasks(previousTasks);
            toast.error(
              data.message || "This status transition is not allowed by the workflow",
              {
                icon: <AlertCircle className="size-4 text-red-500" />,
                duration: 4000,
              }
            );
            return;
          }
        } catch {
          // On validation error, rollback (fail-closed for security)
          setTasks(previousTasks);
          toast.error(
            "Failed to validate workflow transition. Please try again.",
            {
              icon: <AlertCircle className="size-4 text-red-500" />,
              duration: 4000,
            }
          );
          return;
        }
      }
      // ======= END WORKFLOW VALIDATION =======

      // Call onChange and handle errors with rollback
      if (updatesPayload.length > 0) {
        try {
          onChange(updatesPayload);
        } catch (error) {
          console.error('Failed to update task positions:', error);
          // Rollback to previous state on error
          setTasks(previousTasks);
        }
      }
    },
    [onChange, project?.workflowId, statusKeyToIdMap, tasks, validateTransition]
  );

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          {canDeleteTasks && (
            <Button
              variant={selectionMode ? "secondary" : "outline"}
              size="xs"
              onClick={toggleSelectionMode}
            >
              {selectionMode ? "Exit Selection" : "Select Tasks"}
            </Button>
          )}
          {selectionMode && selectedTasks.size > 0 && (
            <span className="text-xs text-muted-foreground">
              {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected
            </span>
          )}
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex overflow-x-scroll gap-4 pb-4 kanban-scrollbar">
          {visibleBoards.map((board) => {
            const selectedInColumn = tasks[board].filter(task =>
              selectedTasks.has(task.$id)
            ).length;

            return (
              <div
                key={board}
                className="bg-muted/30 dark:bg-muted/10 rounded-xl min-w-[280px] w-[320px] ring-1 ring-border shrink-0"
              >
                <KanbanColumnHeader
                  board={board}
                  taskCount={tasks[board].length}
                  selectedCount={selectedInColumn}
                  onSelectAll={handleSelectAll}
                  showSelection={selectionMode}
                  onClearSelection={handleClearColumnSelection}
                  onSortByPriority={handleSortByPriority}
                  onSortByDueDate={handleSortByDueDate}
                  canCreateTasks={canCreateTasks}
                  sortDirection={sortDirections[board]}
                />
                <Droppable droppableId={board}>
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="h-[calc(100vh-300px)] max-h-[700px] overflow-y-auto px-3 pb-3"
                    >
                      {tasks[board].map((task, index) => (
                        <Draggable
                          key={task.$id}
                          draggableId={task.$id}
                          index={index}
                          isDragDisabled={selectionMode || !canEditTasks}
                        >
                          {(provided) => (
                            <div
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              ref={provided.innerRef}
                            >
                              <KanbanCard
                                task={task}
                                isSelected={selectedTasks.has(task.$id)}
                                onSelect={handleTaskSelect}
                                showSelection={selectionMode}
                                canEdit={canEditTasks}
                                canDelete={canDeleteTasks}
                                project={project ?? undefined}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {/* Add Task Button */}
                      {canCreateTasks && (
                        <Button
                          onClick={() => openCreateTask()}
                          variant="ghost"
                          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent mt-2"
                        >
                          <PlusIcon className="h-4 w-4 mr-2" />
                          Add Work Item
                        </Button>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      <BulkActionsToolbar
        selectedCount={selectedTasks.size}
        onClearSelection={handleClearSelection}
        onStatusChange={handleBulkStatusChange}
        onAssigneeChange={handleBulkAssigneeChange}
        isAdmin={canDeleteTasks}
        assignees={members}
        projectId={projectId}
      />
    </>
  );
};
