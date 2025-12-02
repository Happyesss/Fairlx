import React, { useCallback, useEffect, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { KanbanCard } from "./kanban-card";
import { KanbanColumnHeader } from "./kanban-column-header";
import { BulkActionsToolbar } from "./bulk-actions-toolbar";

import { Task, TaskStatus } from "../types";
import { useBulkUpdateTasks } from "../api/use-bulk-update-tasks";
import { useCreateTaskModal } from "../hooks/use-create-task-modal";

const boards: TaskStatus[] = [
  TaskStatus.ASSIGNED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.COMPLETED,
  TaskStatus.CLOSED,
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
      [TaskStatus.ASSIGNED]: [],
      [TaskStatus.IN_PROGRESS]: [],
      [TaskStatus.COMPLETED]: [],
      [TaskStatus.CLOSED]: [],
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
  const [columnsOrder] = useState<TaskStatus[]>(boards);
  const [sortDirections, setSortDirections] = useState<Record<TaskStatus, 'asc' | 'desc'>>({
    [TaskStatus.ASSIGNED]: 'asc',
    [TaskStatus.IN_PROGRESS]: 'asc',
    [TaskStatus.COMPLETED]: 'asc',
    [TaskStatus.CLOSED]: 'asc',
  });

  const { mutate: bulkUpdateTasks } = useBulkUpdateTasks();
  const { open: openCreateTask } = useCreateTaskModal();

  useEffect(() => {
    const newTasks: TasksState = {
      [TaskStatus.ASSIGNED]: [],
      [TaskStatus.IN_PROGRESS]: [],
      [TaskStatus.COMPLETED]: [],
      [TaskStatus.CLOSED]: [],
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

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;

      const { source, destination } = result;
      const sourceStatus = source.droppableId as TaskStatus;
      const destStatus = destination.droppableId as TaskStatus;

      let updatesPayload: {
        $id: string;
        status: TaskStatus;
        position: number;
      }[] = [];

      setTasks((prevTasks) => {
        const newTasks = { ...prevTasks };

        // Safely remove the task from the source column
        const sourceColumn = [...newTasks[sourceStatus]];
        const [movedTask] = sourceColumn.splice(source.index, 1);

        // If there's no moved task (shouldn't happen, but just in case), return the previous state
        if (!movedTask) {
          console.warn("No task found at the source index");
          return prevTasks;
        }

        // Create a new task object with potentially updated status
        const updatedMovedTask =
          sourceStatus !== destStatus
            ? { ...movedTask, status: destStatus }
            : movedTask;

        // Update the source column
        newTasks[sourceStatus] = sourceColumn;

        // Add the task to the destination column
        const destColumn = [...newTasks[destStatus]];
        destColumn.splice(destination.index, 0, updatedMovedTask);
        newTasks[destStatus] = destColumn;

        // Prepare minimal update payloads
        updatesPayload = [];

        // Always update the moved task
        updatesPayload.push({
          $id: updatedMovedTask.$id,
          status: destStatus,
          position: Math.min((destination.index + 1) * 1000, 1_000_000),
        });

        // Update positions for affected tasks in the destination column
        newTasks[destStatus].forEach((task, index) => {
          if (task && task.$id !== updatedMovedTask.$id) {
            const newPosition = Math.min((index + 1) * 1000, 1_000_000);
            if (task.position !== newPosition) {
              updatesPayload.push({
                $id: task.$id,
                status: destStatus,
                position: newPosition,
              });
            }
          }
        });

        // If the task moved between columns, update positions in the source column
        if (sourceStatus !== destStatus) {
          newTasks[sourceStatus].forEach((task, index) => {
            if (task) {
              const newPosition = Math.min((index + 1) * 1000, 1_000_000);
              if (task.position !== newPosition) {
                updatesPayload.push({
                  $id: task.$id,
                  status: sourceStatus,
                  position: newPosition,
                });
              }
            }
          });
        }

        return newTasks;
      });

      onChange(updatesPayload);
    },
    [onChange]
  );

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          {canDeleteTasks && (
            <Button
              variant={selectionMode ? "secondary" : "outline"}
              size="sm"
              onClick={toggleSelectionMode}
            >
              {selectionMode ? "Exit Selection" : "Select Tasks"}
            </Button>
          )}
          {selectionMode && selectedTasks.size > 0 && (
            <span className="text-sm text-gray-600">
              {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected
            </span>
          )}
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex overflow-x-auto gap-4 pb-4">
          {columnsOrder.map((board) => {
            const selectedInColumn = tasks[board].filter(task =>
              selectedTasks.has(task.$id)
            ).length;

            return (
              <div
                key={board}
                className="flex-1 bg-gray-50 rounded-xl min-w-[280px] max-w-[320px]"
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
                      className="min-h-[500px] px-3 pb-3"
                    >
                      {tasks[board].map((task, index) => (
                        <Draggable
                          key={task.$id}
                          draggableId={task.$id}
                          index={index}
                          isDragDisabled={selectionMode}
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
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {/* Add Task Button */}
                      {canCreateTasks && (
                        <Button
                          onClick={openCreateTask}
                          variant="ghost"
                          className="w-full justify-start text-gray-500 hover:text-gray-700 hover:bg-gray-100 mt-2"
                        >
                          <PlusIcon className="h-4 w-4 mr-2" />
                          Add Task
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
