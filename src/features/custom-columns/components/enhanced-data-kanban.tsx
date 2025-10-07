"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Settings2Icon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";

import { KanbanCard } from "@/features/tasks/components/kanban-card";
import { KanbanColumnHeader } from "@/features/tasks/components/kanban-column-header";
import { BulkActionsToolbar } from "@/features/tasks/components/bulk-actions-toolbar";
import { useCreateTaskModal } from "@/features/tasks/hooks/use-create-task-modal";

import { Task, TaskStatus } from "@/features/tasks/types";
import { useBulkUpdateTasks } from "@/features/tasks/api/use-bulk-update-tasks";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { useGetCustomColumns } from "../api/use-get-custom-columns";
import { useManageColumnsModal } from "../hooks/use-manage-columns-modal";
import { useDefaultColumns } from "../hooks/use-default-columns";
import { CustomColumnHeader } from "./custom-column-header";
import { CustomColumn } from "../types";
import { useUpdateColumnOrder } from "@/features/default-column-settings/api/use-update-column-order";



type TasksState = {
  [key: string]: Task[]; // Using string to support both TaskStatus and custom column IDs
};

interface ColumnData {
  id: string;
  type: "default" | "custom";
  status?: TaskStatus;
  customColumn?: CustomColumn;
  position: number;
}

interface EnhancedDataKanbanProps {
  data: Task[] | undefined; // Allow undefined data
  onChange: (
    tasks: { $id: string; status: TaskStatus | string; position: number }[]
  ) => void;
  isAdmin?: boolean;
  members?: Array<{ $id: string; name: string }>;
  projectId?: string; // Add optional projectId prop
  showMyTasksOnly?: boolean; // New prop to show column management for all users
}

export const EnhancedDataKanban = ({ 
  data = [], // Default to empty array
  onChange, 
  isAdmin = false,
  members = [],
  projectId,
  showMyTasksOnly = false
}: EnhancedDataKanbanProps) => {
  const workspaceId = useWorkspaceId();
  

  const { data: customColumns, isLoading: isLoadingColumns, error: columnsError } = useGetCustomColumns({ 
    workspaceId, 
    projectId: projectId || "" 
  });
  

  const { open: openManageModal } = useManageColumnsModal();
  const { open: openCreateTask } = useCreateTaskModal();
  const { getEnabledColumns } = useDefaultColumns(workspaceId, projectId);
  const { mutate: updateColumnOrder } = useUpdateColumnOrder();

  // Always call hooks – never inside conditionals/returns
  const [ConfirmDialog] = useConfirm(
    "Move Tasks",
    "Moving tasks from a deleted custom column to 'TODO'. Continue?",
    "outline"
  );

  // Combine enabled default boards with custom columns (safe when loading)
  const allColumns = useMemo(() => {
    const columns: ColumnData[] = [
      ...getEnabledColumns.map(col => ({ 
        id: col.id, 
        type: "default" as const, 
        status: col.id,
        position: col.position || 0
      })),
      ...(customColumns?.documents || []).map(col => ({ 
        id: col.$id, 
        type: "custom" as const, 
        customColumn: col as CustomColumn,
        position: col.position
      }))
    ];
    
    // Sort by position
    return columns.sort((a, b) => a.position - b.position);
  }, [getEnabledColumns, customColumns?.documents]);

  const [tasks, setTasks] = useState<TasksState>({});
  const [orderedColumns, setOrderedColumns] = useState<ColumnData[]>([]);

  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const { mutate: bulkUpdateTasks } = useBulkUpdateTasks();

  // Update ordered columns when allColumns changes
  useEffect(() => {
    setOrderedColumns(allColumns);
  }, [allColumns]);

  // Update tasks when data changes or columns change
  useEffect(() => {
    const newTasks: TasksState = {};
    
    // Initialize all enabled columns
    orderedColumns.forEach(col => {
      newTasks[col.id] = [];
    });

    // Ensure TODO exists as fallback (if it's enabled)
    const todoColumn = orderedColumns.find(col => col.id === TaskStatus.TODO);
    if (!newTasks[TaskStatus.TODO] && todoColumn) {
      newTasks[TaskStatus.TODO] = [];
    }

    // Process data with safety check
    if (Array.isArray(data) && data.length > 0) {
      data.forEach((task) => {
        const taskStatus = task.status;
        
        // Check if task belongs to an enabled column
        if (newTasks[taskStatus]) {
          newTasks[taskStatus].push(task);
          } else {
            // Task is in a disabled/non-existent column, move to TODO if available
            if (newTasks[TaskStatus.TODO]) {
              newTasks[TaskStatus.TODO].push(task);
            } else {
              // If TODO is also disabled, move to first available enabled column
              const firstEnabledColumn = Object.keys(newTasks)[0];
              if (firstEnabledColumn) {
                newTasks[firstEnabledColumn].push(task);
              }
            }
          }
      });
    }

    // Sort tasks by position in each column
    Object.keys(newTasks).forEach((columnId) => {
      newTasks[columnId].sort((a, b) => a.position - b.position);
    });

    setTasks(newTasks);
  }, [data, orderedColumns]);

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

  const handleSelectAll = useCallback((columnId: string, selected: boolean) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      const columnTasks = tasks[columnId];
      
      if (selected) {
        columnTasks.forEach(task => newSet.add(task.$id));
      } else {
        columnTasks.forEach(task => newSet.delete(task.$id));
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

  const handleBulkStatusChange = useCallback((status: TaskStatus | string) => {
    if (selectedTasks.size === 0) return;

    const updates = Array.from(selectedTasks).map(taskId => ({
      $id: taskId,
      status,
    }));

    if (updates.length === 0) return; // Additional guard

    bulkUpdateTasks({
      json: { tasks: updates }
    });

    setSelectedTasks(new Set());
  }, [selectedTasks, bulkUpdateTasks]);

  const handleBulkAssigneeChange = useCallback((assigneeId: string) => {
    if (selectedTasks.size === 0) return;

    const updates = Array.from(selectedTasks).map(taskId => ({
      $id: taskId,
      assigneeId,
    }));

    if (updates.length === 0) return; // Additional guard

    bulkUpdateTasks({
      json: { tasks: updates }
    });

    setSelectedTasks(new Set());
  }, [selectedTasks, bulkUpdateTasks]);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;

      const { source, destination, type } = result;

      // Handle column reordering
      if (type === "column") {
        const sourceIndex = source.index;
        const destIndex = destination.index;

        if (sourceIndex === destIndex) return;

        const newColumns = Array.from(orderedColumns);
        const [movedColumn] = newColumns.splice(sourceIndex, 1);
        newColumns.splice(destIndex, 0, movedColumn);

        // Update local state immediately for smooth UX
        setOrderedColumns(newColumns);

        // Update positions in database
        const updatedColumns = newColumns.map((col, index) => ({
          id: col.id,
          type: col.type,
          position: (index + 1) * 1000,
        }));

        if (projectId) {
          updateColumnOrder({
            json: {
              workspaceId,
              projectId,
              columns: updatedColumns,
            },
          });
        }

        return;
      }

      // Handle task dragging (existing logic)
      const sourceColumnId = source.droppableId;
      const destColumnId = destination.droppableId;

      let updatesPayload: {
        $id: string;
        status: TaskStatus | string;
        position: number;
      }[] = [];

      setTasks((prevTasks) => {
        const newTasks = { ...prevTasks };

        const sourceColumn = [...newTasks[sourceColumnId]];
        const [movedTask] = sourceColumn.splice(source.index, 1);

        if (!movedTask) {
            console.warn("No task found at the source index");
          return prevTasks;
        }

        const updatedMovedTask =
          sourceColumnId !== destColumnId
            ? { ...movedTask, status: destColumnId }
            : movedTask;

        newTasks[sourceColumnId] = sourceColumn;

        const destColumn = [...newTasks[destColumnId]];
        destColumn.splice(destination.index, 0, updatedMovedTask);
        newTasks[destColumnId] = destColumn;

        updatesPayload = [];

        updatesPayload.push({
          $id: updatedMovedTask.$id,
          status: destColumnId,
          position: Math.min((destination.index + 1) * 1000, 1_000_000),
        });

        newTasks[destColumnId].forEach((task, index) => {
          if (task && task.$id !== updatedMovedTask.$id) {
            const newPosition = Math.min((index + 1) * 1000, 1_000_000);
            if (task.position !== newPosition) {
              updatesPayload.push({
                $id: task.$id,
                status: destColumnId,
                position: newPosition,
              });
            }
          }
        });

        if (sourceColumnId !== destColumnId) {
          newTasks[sourceColumnId].forEach((task, index) => {
            if (task) {
              const newPosition = Math.min((index + 1) * 1000, 1_000_000);
              if (task.position !== newPosition) {
                updatesPayload.push({
                  $id: task.$id,
                  status: sourceColumnId,
                  position: newPosition,
                });
              }
            }
          });
        }

        return newTasks;
      });

      // Only call onChange if we have valid updates
      if (Array.isArray(updatesPayload) && updatesPayload.length > 0) {
        onChange(updatesPayload);
      }
    },
    [orderedColumns, onChange, updateColumnOrder, workspaceId, projectId]
  );

  // Derive body content states (keep hooks above regardless of state)
  let body: React.ReactNode = null;

  if (isLoadingColumns) {
    body = (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  } else if (columnsError) {
    body = (
      <div className="flex items-center justify-center h-48">
        <div className="text-red-500">Error loading custom columns</div>
      </div>
    );
  } else {
    body = (
      <>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            {(isAdmin || showMyTasksOnly) && (
              <>
                <Button
                  variant={selectionMode ? "secondary" : "outline"}
                  size="sm"
                  onClick={toggleSelectionMode}
                >
                  {selectionMode ? "Exit Selection" : "Select Tasks"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openManageModal}
                >
                  <Settings2Icon className="size-4 !text-xs mr-2" />
                  Manage Columns
                </Button>
              </>
            )}
            {selectionMode && selectedTasks.size > 0 && (
              <span className="text-sm text-gray-600">
                {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="columns" direction="horizontal" type="column">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="flex overflow-x-auto gap-4 pb-4"
              >
                {orderedColumns.map((column, index) => {
                  const columnTasks = tasks[column.id] || [];
                  const selectedInColumn = columnTasks.filter(task => 
                    selectedTasks.has(task.$id)
                  ).length;

                  return (
                    <Draggable
                      key={column.id}
                      draggableId={`column-${column.id}`}
                      index={index}
                      isDragDisabled={selectionMode}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex-1 bg-gray-50 rounded-xl min-w-[280px] border shadow-sm max-w-[360px] ${
                            snapshot.isDragging ? 'shadow-lg' : ''
                          }`}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className={`${!selectionMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                          >
                            {column.type === "default" ? (
                              <KanbanColumnHeader
                                board={column.status!}
                                taskCount={columnTasks.length}
                                selectedCount={selectedInColumn}
                                onSelectAll={(status, selected) => handleSelectAll(column.id, selected)}
                                showSelection={selectionMode}
                              />
                            ) : (
                              <CustomColumnHeader
                                customColumn={column.customColumn!}
                                taskCount={columnTasks.length}
                                selectedCount={selectedInColumn}
                                onSelectAll={handleSelectAll}
                                showSelection={selectionMode}
                              />
                            )}
                          </div>
                          
                          <Droppable droppableId={column.id} type="task">
                            {(provided) => (
                              <div
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                className="min-h-[500px] px-3 pb-3"
                              >
                                {columnTasks.map((task, index) => (
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
                                        />
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                                {/* Add Task Button */}
                                <Button
                                  onClick={openCreateTask}
                                  variant="ghost"
                                  className="w-full text-xs bg-white border border-gray-200 shadow-sm justify-start text-gray-500  mt-2"
                                >
                                  <PlusIcon className="h-4 w-4 " />
                                  Add Task
                                </Button>
                              </div>
                            )}
                          </Droppable>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <BulkActionsToolbar
          selectedCount={selectedTasks.size}
          onClearSelection={handleClearSelection}
          onStatusChange={handleBulkStatusChange}
          onAssigneeChange={handleBulkAssigneeChange}
          isAdmin={isAdmin}
          assignees={members}
          projectId={projectId}
        />
      </>
    );
  }

  return (
    <>
      <ConfirmDialog />
      {body}
    </>
  );
};
