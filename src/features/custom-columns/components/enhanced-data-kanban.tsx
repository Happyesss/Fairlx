"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { AlertCircle, PlusIcon, X, CalendarIcon, UserPlus, CornerDownLeft, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { PriorityIcon } from "@/features/tasks/components/priority-selector";
import { WorkItemPriority } from "@/features/sprints/types";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/hooks/use-confirm";

import { KanbanCard } from "@/features/tasks/components/kanban-card";
import { KanbanColumnHeader } from "@/features/tasks/components/kanban-column-header";
import { BulkActionsToolbar } from "@/features/tasks/components/bulk-actions-toolbar";
import { useCreateTaskModal } from "@/features/tasks/hooks/use-create-task-modal";

import { Task, TaskStatus } from "@/features/tasks/types";
import { useBulkUpdateTasks } from "@/features/tasks/api/use-bulk-update-tasks";
import { useCreateWorkItem } from "@/features/sprints/api/use-create-work-item";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetProject } from "@/features/projects/api/use-get-project";
import { useGetWorkflowStatuses } from "@/features/workflows/api/use-get-workflow-statuses";
import { useValidateTransition, TransitionValidationResult } from "@/features/workflows/api/use-validate-transition";

import { useGetCustomColumns } from "../api/use-get-custom-columns";
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
  canCreateTasks?: boolean;
  canEditTasks?: boolean;
  canDeleteTasks?: boolean;
  members?: Array<{ $id: string; name: string }>;
  projectId?: string; // Add optional projectId prop
  activeSprintId?: string;
}

export const EnhancedDataKanban = ({
  data = [], // Default to empty array
  onChange,
  canCreateTasks = true,
  canEditTasks = true,
  canDeleteTasks = true,
  members = [],
  projectId,
  activeSprintId,
}: EnhancedDataKanbanProps) => {
  const workspaceId = useWorkspaceId();

  // Get project to find workflow
  const { data: project } = useGetProject({ projectId: projectId || "" });
  
  // Workflow validation hooks
  const { mutateAsync: validateTransition } = useValidateTransition();
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

  const { data: customColumns, isLoading: isLoadingColumns, error: columnsError } = useGetCustomColumns({
    workspaceId,
    projectId: projectId || ""
  });


  useCreateTaskModal();
  const { getEnabledColumns } = useDefaultColumns(workspaceId, projectId);
  const { mutate: updateColumnOrder } = useUpdateColumnOrder();

  // Always call hooks – never inside conditionals/returns
  const [ConfirmDialog] = useConfirm(
    "Move Tasks",
    "Moving tasks from a deleted custom column to 'TODO'. Continue?",
    "outline"
  );

  // Check if TODO column should be visible (only when tasks are TODO or unassigned)
  const shouldShowTodoColumn = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return false;

    return data.some(task =>
      task.status === TaskStatus.TODO ||
      !task.assigneeIds ||
      task.assigneeIds.length === 0
    );
  }, [data]);

  // Combine enabled default boards with custom columns (safe when loading)
  const allColumns = useMemo(() => {
    const columns: ColumnData[] = [
      ...getEnabledColumns
        .filter(col => {
          // Only show TODO column when there are TODO or unassigned tasks
          if (col.id === TaskStatus.TODO) {
            return shouldShowTodoColumn;
          }
          return true;
        })
        .map(col => ({
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
  }, [getEnabledColumns, customColumns?.documents, shouldShowTodoColumn]);

  const [tasks, setTasks] = useState<TasksState>({});
  const [orderedColumns, setOrderedColumns] = useState<ColumnData[]>([]);

  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [sortDirections, setSortDirections] = useState<Record<string, 'asc' | 'desc'>>({});

  const { mutate: bulkUpdateTasks } = useBulkUpdateTasks();
  const { mutate: createWorkItem, isPending: isCreatingWorkItem } = useCreateWorkItem();
  
  const [quickCreateColumnId, setQuickCreateColumnId] = useState<string | null>(null);
  const [quickCreateTitle, setQuickCreateTitle] = useState("");
  const [quickCreateAssigneeIds, setQuickCreateAssigneeIds] = useState<string[]>([]);
  const [quickCreateDueDate, setQuickCreateDueDate] = useState<Date | undefined>(undefined);
  const [quickCreatePriority, setQuickCreatePriority] = useState<string>(WorkItemPriority.MEDIUM);

  const resetQuickCreate = () => {
    setQuickCreateTitle("");
    setQuickCreateAssigneeIds([]);
    setQuickCreateDueDate(undefined);
    setQuickCreatePriority(WorkItemPriority.MEDIUM);
    setQuickCreateColumnId(null);
  };

  const handleQuickCreate = (columnId: string) => {
    if (!quickCreateTitle.trim()) {
      setQuickCreateColumnId(null);
      return;
    }

    if (!projectId) return;

    createWorkItem({
      title: quickCreateTitle,
      status: columnId,
      workspaceId,
      projectId: projectId,
      sprintId: activeSprintId,
      assigneeIds: quickCreateAssigneeIds,
      dueDate: quickCreateDueDate,
      priority: quickCreatePriority,
    }, {
      onSuccess: () => {
        resetQuickCreate();
      }
    });
  };

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

  const handleSortByPriority = useCallback((columnId: string) => {
    // Toggle sort direction
    const newDirection = sortDirections[columnId] === 'asc' ? 'desc' : 'asc';
    setSortDirections(prev => ({ ...prev, [columnId]: newDirection }));

    setTasks(prev => {
      const newTasks = { ...prev };
      const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      newTasks[columnId] = [...newTasks[columnId]].sort((a, b) => {
        const aPriority = a.priority ? priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4 : 4;
        const bPriority = b.priority ? priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4 : 4;
        const comparison = aPriority - bPriority;
        return newDirection === 'asc' ? comparison : -comparison;
      });

      // Update positions after sorting
      const updates = newTasks[columnId].map((task, index) => ({
        $id: task.$id,
        status: columnId,
        position: Math.min((index + 1) * 1000, 1_000_000),
      }));

      // Persist the new positions
      onChange(updates);

      return newTasks;
    });
  }, [onChange, sortDirections]);

  const handleSortByDueDate = useCallback((columnId: string) => {
    // Toggle sort direction
    const newDirection = sortDirections[columnId] === 'asc' ? 'desc' : 'asc';
    setSortDirections(prev => ({ ...prev, [columnId]: newDirection }));

    setTasks(prev => {
      const newTasks = { ...prev };
      newTasks[columnId] = [...newTasks[columnId]].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        const comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        return newDirection === 'asc' ? comparison : -comparison;
      });

      // Update positions after sorting
      const updates = newTasks[columnId].map((task, index) => ({
        $id: task.$id,
        status: columnId,
        position: Math.min((index + 1) * 1000, 1_000_000),
      }));

      // Persist the new positions
      onChange(updates);

      return newTasks;
    });
  }, [onChange, sortDirections]);

  const onDragEnd = useCallback(
    async (result: DropResult) => {
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

      // Early return if no actual movement
      if (sourceColumnId === destColumnId && source.index === destination.index) {
        return;
      }

      // Get the task being moved for optimistic update
      const movedTask = tasks[sourceColumnId]?.[source.index];
      if (!movedTask) {
        return;
      }

      // Store previous state for potential rollback
      const previousTasks = { ...tasks };

      // OPTIMISTIC UPDATE FIRST - update UI immediately for smooth UX
      const updatesPayload: {
        $id: string;
        status: TaskStatus | string;
        position: number;
      }[] = [];

      setTasks((prevTasks) => {
        const newTasks = { ...prevTasks };

        const sourceColumn = [...(newTasks[sourceColumnId] || [])];
        const [draggedTask] = sourceColumn.splice(source.index, 1);

        if (!draggedTask) {
          return prevTasks;
        }

        const updatedMovedTask =
          sourceColumnId !== destColumnId
            ? { ...draggedTask, status: destColumnId }
            : draggedTask;

        newTasks[sourceColumnId] = sourceColumn;

        const destColumn = [...(newTasks[destColumnId] || [])];
        destColumn.splice(destination.index, 0, updatedMovedTask);
        newTasks[destColumnId] = destColumn;

        // Only update the moved task - not all tasks in the column
        // This dramatically reduces API calls
        updatesPayload.push({
          $id: updatedMovedTask.$id,
          status: destColumnId,
          position: Math.min((destination.index + 1) * 1000, 1_000_000),
        });

        return newTasks;
      });

      // ======= WORKFLOW TRANSITION VALIDATION =======
      // If moving to a different column and project has a workflow, validate the transition
      if (sourceColumnId !== destColumnId && project?.workflowId) {
        const fromStatusId = statusKeyToIdMap.get(sourceColumnId);
        const toStatusId = statusKeyToIdMap.get(destColumnId);

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

          const validationData = validationResult.data as TransitionValidationResult;

          if (!validationData.allowed) {
            // Transition is not allowed - rollback and show error
            setTasks(previousTasks);
            toast.error(
              validationData.message || "This status transition is not allowed by the workflow",
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

      // Only call onChange if we have valid updates
      if (updatesPayload.length > 0) {
        try {
          onChange(updatesPayload);
        } catch (error) {
          // Rollback on error
          console.error('Failed to update task positions:', error);
          setTasks(previousTasks);
        }
      }
    },
    [orderedColumns, onChange, updateColumnOrder, workspaceId, projectId, tasks, project?.workflowId, validateTransition, statusKeyToIdMap]
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
          <Droppable droppableId="columns" direction="horizontal" type="column">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="flex overflow-x-scroll gap-4 pb-4 kanban-scrollbar"
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
                          className={`flex-1 bg-muted/20 dark:bg-muted/10 rounded-xl min-w-[280px] border shadow-sm max-w-[360px] ${snapshot.isDragging ? 'shadow-lg border-primary/50' : ''
                            }`}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className={`${!selectionMode ? '' : ''}`}
                          >
                            {column.type === "default" ? (
                              <KanbanColumnHeader
                                board={column.status!}
                                taskCount={columnTasks.length}
                                selectedCount={selectedInColumn}
                                onSelectAll={(status, selected) => handleSelectAll(column.id, selected)}
                                showSelection={selectionMode}
                                canCreateTasks={canCreateTasks}
                                onSortByPriority={() => handleSortByPriority(column.id)}
                                onSortByDueDate={() => handleSortByDueDate(column.id)}
                                sortDirection={sortDirections[column.id] || 'asc'}
                                onQuickCreate={(_status) => {
                                  setQuickCreateColumnId(column.id);
                                  setQuickCreateTitle("");
                                }}
                              />
                            ) : (
                              <CustomColumnHeader
                                customColumn={column.customColumn!}
                                taskCount={columnTasks.length}
                                selectedCount={selectedInColumn}
                                onSelectAll={handleSelectAll}
                                showSelection={selectionMode}
                                onSortByPriority={() => handleSortByPriority(column.id)}
                                onSortByDueDate={() => handleSortByDueDate(column.id)}
                                sortDirection={sortDirections[column.id] || 'asc'}
                                onQuickCreate={(columnId) => {
                                  setQuickCreateColumnId(columnId);
                                  setQuickCreateTitle("");
                                }}
                              />
                            )}
                          </div>

                          <Droppable droppableId={column.id} type="task">
                            {(provided) => (
                              <div
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                className="h-[calc(100vh-300px)] max-h-[700px] overflow-y-auto px-3 pb-3"
                              >
                                {columnTasks.map((task, index) => (
                                  <Draggable
                                    key={task.$id}
                                    draggableId={task.$id}
                                    index={index}
                                    isDragDisabled={selectionMode || !canEditTasks}
                                  >
                                    {(provided) => (
                                      <div
                                        {...provided.draggableProps}
                                        ref={provided.innerRef}
                                      >
                                        <KanbanCard
                                          task={task}
                                          isSelected={selectedTasks.has(task.$id)}
                                          onSelect={handleTaskSelect}
                                          showSelection={selectionMode}
                                          canEdit={canEditTasks}
                                          canDelete={canDeleteTasks}
                                          dragHandleProps={provided.dragHandleProps}
                                        />
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                                                                {canCreateTasks && (
                                  <div className="mt-2 px-1">
                                    {quickCreateColumnId === column.id ? (
                                      <div className="bg-card rounded-xl border-2 border-primary shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <div className="p-3">
                                          <Input
                                            autoFocus
                                            placeholder="What needs to be done?"
                                            value={quickCreateTitle}
                                            onChange={(e) => setQuickCreateTitle(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") handleQuickCreate(column.id);
                                              if (e.key === "Escape") {
                                                setQuickCreateColumnId(null);
                                                setQuickCreateTitle("");
                                              }
                                            }}
                                            className="h-auto p-0 border-none bg-transparent text-sm font-medium focus-visible:ring-0 placeholder:text-muted-foreground/50 mb-3"
                                            disabled={isCreatingWorkItem}
                                          />

                                          {/* Metadata Chips Row */}
                                          {(quickCreateAssigneeIds.length > 0 || quickCreateDueDate || quickCreatePriority !== WorkItemPriority.MEDIUM) && (
                                            <div className="flex flex-wrap gap-1.5 mb-3 animate-in fade-in slide-in-from-left-2 duration-300">
                                              {/* Assignee Chips */}
                                              {quickCreateAssigneeIds.map((id) => {
                                                const member = members.find(m => m.$id === id);
                                                if (!member) return null;
                                                return (
                                                  <Badge 
                                                    key={id} 
                                                    variant="secondary" 
                                                    className="pl-1 pr-1.5 h-6 gap-1.5 text-[10px] font-medium bg-primary/5 hover:bg-primary/10 border-primary/10 transition-colors"
                                                  >
                                                    <MemberAvatar name={member.name} className="size-4" />
                                                    <span className="max-w-[80px] truncate">{member.name}</span>
                                                    <X 
                                                      className="size-3 cursor-pointer text-muted-foreground hover:text-destructive transition-colors" 
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setQuickCreateAssigneeIds(prev => prev.filter(aid => aid !== id));
                                                      }} 
                                                    />
                                                  </Badge>
                                                );
                                              })}

                                              {/* Date Chip */}
                                              {quickCreateDueDate && (
                                                <Badge 
                                                  variant="secondary" 
                                                  className="h-6 gap-1.5 px-2 text-[10px] font-medium bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/10 text-amber-600 transition-colors"
                                                >
                                                  <CalendarIcon className="size-3" />
                                                  {format(quickCreateDueDate, "MMM d")}
                                                  <X 
                                                    className="size-3 cursor-pointer opacity-60 hover:opacity-100 transition-opacity" 
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setQuickCreateDueDate(undefined);
                                                    }} 
                                                  />
                                                </Badge>
                                              )}

                                              {/* Priority Chip */}
                                              {quickCreatePriority !== WorkItemPriority.MEDIUM && (
                                                <Badge 
                                                  variant="secondary" 
                                                  className="h-6 gap-1.5 px-2 text-[10px] font-medium bg-muted/50 border-border/50 transition-colors"
                                                >
                                                  <PriorityIcon priority={quickCreatePriority} className="size-3" />
                                                  {quickCreatePriority.charAt(0) + quickCreatePriority.slice(1).toLowerCase()}
                                                  <X 
                                                    className="size-3 cursor-pointer opacity-60 hover:opacity-100 transition-opacity" 
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setQuickCreatePriority(WorkItemPriority.MEDIUM);
                                                    }} 
                                                  />
                                                </Badge>
                                              )}
                                            </div>
                                          )}

                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1">
                                              <TooltipProvider delayDuration={300}>
                                                {/* Assignee Selector */}
                                                <Popover>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <PopoverTrigger asChild>
                                                        <Button 
                                                          variant="ghost" 
                                                          size="icon" 
                                                          className={cn(
                                                            "size-7 rounded-md hover:bg-accent",
                                                            quickCreateAssigneeIds.length > 0 ? "text-primary" : "text-muted-foreground"
                                                          )} 
                                                          disabled={isCreatingWorkItem}
                                                        >
                                                          {quickCreateAssigneeIds.length === 1 ? (
                                                            <MemberAvatar 
                                                              name={members.find(m => m.$id === quickCreateAssigneeIds[0])?.name || ""} 
                                                              imageUrl={undefined}
                                                              className="size-5"
                                                            />
                                                          ) : quickCreateAssigneeIds.length > 1 ? (
                                                            <div className="size-5 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-bold">
                                                              {quickCreateAssigneeIds.length}
                                                            </div>
                                                          ) : (
                                                            <UserPlus className="size-3.5" />
                                                          )}
                                                        </Button>
                                                      </PopoverTrigger>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom" className="text-[10px]">
                                                      {quickCreateAssigneeIds.length > 0 
                                                        ? `${quickCreateAssigneeIds.length} Assignee${quickCreateAssigneeIds.length > 1 ? 's' : ''}` 
                                                        : "Add Assignee"}
                                                    </TooltipContent>
                                                  </Tooltip>
                                                  <PopoverContent className="p-0 w-60" align="start">
                                                    <div className="p-2 border-b">
                                                      <p className="text-xs font-semibold px-2 py-1">Assign to...</p>
                                                    </div>
                                                    <div className="max-h-60 overflow-y-auto p-1">
                                                      {members.map((member) => (
                                                        <div
                                                          key={member.$id}
                                                          className="flex items-center justify-between px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer transition-colors"
                                                          onClick={() => {
                                                            setQuickCreateAssigneeIds(prev => 
                                                              prev.includes(member.$id) 
                                                                ? prev.filter(id => id !== member.$id)
                                                                : [...prev, member.$id]
                                                            );
                                                          }}
                                                        >
                                                          <div className="flex items-center gap-2">
                                                            <MemberAvatar name={member.name} className="size-6" />
                                                            <span className="text-sm">{member.name}</span>
                                                          </div>
                                                          {quickCreateAssigneeIds.includes(member.$id) && (
                                                            <Check className="size-4 text-primary" />
                                                          )}
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </PopoverContent>
                                                </Popover>
                                                
                                                {/* Date Selector */}
                                                <Popover>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <PopoverTrigger asChild>
                                                        <Button 
                                                          variant="ghost" 
                                                          size="icon" 
                                                          className={cn(
                                                            "size-7 rounded-md hover:bg-accent",
                                                            quickCreateDueDate ? "text-primary" : "text-muted-foreground"
                                                          )} 
                                                          disabled={isCreatingWorkItem}
                                                        >
                                                          <CalendarIcon className="size-3.5" />
                                                        </Button>
                                                      </PopoverTrigger>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom" className="text-[10px]">
                                                      {quickCreateDueDate ? format(quickCreateDueDate, "PPP") : "Set Due Date"}
                                                    </TooltipContent>
                                                  </Tooltip>
                                                  <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                      mode="single"
                                                      selected={quickCreateDueDate}
                                                      onSelect={setQuickCreateDueDate}
                                                      initialFocus
                                                    />
                                                    <div className="p-2 border-t flex justify-end">
                                                      <Button variant="ghost" size="xs" onClick={() => setQuickCreateDueDate(undefined)}>
                                                        Clear
                                                      </Button>
                                                    </div>
                                                  </PopoverContent>
                                                </Popover>
                                                
                                                {/* Priority Selector */}
                                                <DropdownMenu>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <DropdownMenuTrigger asChild>
                                                        <Button 
                                                          variant="ghost" 
                                                          size="icon" 
                                                          className="size-7 rounded-md hover:bg-accent" 
                                                          disabled={isCreatingWorkItem}
                                                        >
                                                          <PriorityIcon priority={quickCreatePriority} className="size-3.5" />
                                                        </Button>
                                                      </DropdownMenuTrigger>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom" className="text-[10px]">
                                                      Priority: {quickCreatePriority}
                                                    </TooltipContent>
                                                  </Tooltip>
                                                  <DropdownMenuContent align="start" className="w-40">
                                                    <DropdownMenuLabel className="text-xs">Set Priority</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    {Object.values(WorkItemPriority).map((priority) => (
                                                      <DropdownMenuItem 
                                                        key={priority}
                                                        onClick={() => setQuickCreatePriority(priority)}
                                                        className="flex items-center gap-2 cursor-pointer"
                                                      >
                                                        <PriorityIcon priority={priority} className="size-3.5" />
                                                        <span className="text-sm">{priority}</span>
                                                        {quickCreatePriority === priority && (
                                                          <Check className="size-4 ml-auto text-primary" />
                                                        )}
                                                      </DropdownMenuItem>
                                                    ))}
                                                  </DropdownMenuContent>
                                                </DropdownMenu>
                                              </TooltipProvider>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                               <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={resetQuickCreate}
                                                className="size-7 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                                                disabled={isCreatingWorkItem}
                                              >
                                                <X className="size-3.5" />
                                              </Button>
                                              <Button 
                                                size="sm" 
                                                onClick={() => handleQuickCreate(column.id)} 
                                                disabled={isCreatingWorkItem || !quickCreateTitle.trim()}
                                                className="h-7 px-2.5 text-[11px] gap-1.5 rounded-md shadow-sm"
                                              >
                                                {isCreatingWorkItem ? (
                                                  <div className="size-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                                ) : (
                                                  <>
                                                    Save
                                                    <CornerDownLeft className="size-3 opacity-60" />
                                                  </>
                                                )}
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent/50 h-9 text-[12px] px-3 group transition-all duration-200 rounded-lg border border-transparent hover:border-border/50"
                                        onClick={() => {
                                          setQuickCreateColumnId(column.id);
                                          setQuickCreateTitle("");
                                        }}
                                      >
                                        <PlusIcon className="h-4 w-4 mr-2 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                                        <span className="font-medium">Add Work Item</span>
                                      </Button>
                                    )}
                                  </div>
                                )}
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
          isAdmin={canDeleteTasks}
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
