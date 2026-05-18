"use client";

import { useState, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Trash2Icon, PlusIcon, EyeIcon, EyeOffIcon, Settings2Icon } from "lucide-react";
import { toast } from "sonner";

import { DottedSeparator } from "@/components/dotted-separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/hooks/use-confirm";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { useGetProject } from "@/features/projects/api/use-get-project";
import { useGetWorkflowStatuses } from "@/features/workflows/api/use-get-workflow-statuses";
import { TaskStatus } from "@/features/tasks/types";

import { createCustomColumnBaseSchema } from "../schemas";
import { useCreateCustomColumn } from "../api/use-create-custom-column";
import { useDeleteCustomColumn } from "../api/use-delete-custom-column";
import { useGetCustomColumns } from "../api/use-get-custom-columns";
import { IconPicker } from "./icon-picker";
import { ColorPicker } from "./color-picker";
import { useDefaultColumns } from "../hooks/use-default-columns";
import { useMoveTasksFromDisabledColumn } from "../hooks/use-move-tasks-from-disabled-column";

interface ManageColumnsFormProps {
  onCancel?: () => void;
}

// Omit workspaceId & projectId; they are injected on submit
const formSchema = createCustomColumnBaseSchema.omit({ workspaceId: true, projectId: true, workflowId: true });
type FormData = z.infer<typeof formSchema>;

export const ManageColumnsForm = ({ onCancel }: ManageColumnsFormProps) => {
  const workspaceId = useWorkspaceId();
  const projectId = useProjectId();
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Get project to find workflow
  const { data: project } = useGetProject({ projectId: projectId || "" });
  
  // Get workflow statuses for the project's assigned workflow
  const { data: workflowStatusesData, isLoading: isLoadingWorkflowStatuses } = useGetWorkflowStatuses({
    workflowId: project?.workflowId || ""
  });

  // Must be declared before workflowColumns useMemo since the memo filters against it
  const { data: customColumns, isLoading: isLoadingColumns } = useGetCustomColumns({
    workspaceId,
    projectId: projectId || ""
  });

  // Create a list of workflow-based columns, excluding any that are already
  // represented as project-level custom columns (auto-synced from workflow statuses).
  const workflowColumns = useMemo(() => {
    if (!workflowStatusesData?.documents) return [];

    // Build a set of custom column names for this project (lower-cased for comparison)
    const customColumnNames = new Set(
      (customColumns?.documents || []).map(col => col.name.toLowerCase())
    );

    return workflowStatusesData.documents
      .filter(status => !customColumnNames.has(status.name.toLowerCase()))
      .map(status => ({
        id: status.key as TaskStatus,
        name: status.name,
        color: status.color,
        statusType: status.statusType,
      }));
  }, [workflowStatusesData, customColumns]);

  // Track pending changes
  const [pendingColumnToggles, setPendingColumnToggles] = useState<Set<TaskStatus>>(new Set());
  const [pendingColumnDeletions, setPendingColumnDeletions] = useState<Set<string>>(new Set());
  const [pendingColumnCreations, setPendingColumnCreations] = useState<FormData[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { mutate: createColumn, isPending: isCreating } = useCreateCustomColumn();
  const { mutate: deleteColumn, isPending: isDeleting } = useDeleteCustomColumn();
  const { mutate: moveTasksFromDisabledColumn } = useMoveTasksFromDisabledColumn();

  const {
    defaultColumns,
    toggleColumn,
  } = useDefaultColumns(workspaceId, projectId);

  const [ConfirmHideDialog, confirmHide] = useConfirm(
    "Hide Column",
    "Are you sure you want to hide this column? All tasks in this column will be moved to 'Todo'.",
    "outline"
  );

  const [ConfirmDeleteDialog, confirmDelete] = useConfirm(
    "Delete Column",
    "Are you sure you want to delete this column? All tasks in this column will be moved to 'Todo'.",
    "destructive"
  );

  const [ConfirmUnsavedDialog, confirmUnsaved] = useConfirm(
    "Unsaved Changes",
    "You have unsaved changes. Do you want to save them before closing?",
    "outline"
  );

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      icon: "FiFlag",
      color: "#3b82f6",
    },
  });

  const onSubmit = (values: FormData) => {
    // Add to pending creations instead of creating immediately
    setPendingColumnCreations(prev => [...prev, values]);
    setHasUnsavedChanges(true);
    form.reset();
    setShowCreateForm(false);
    toast.success("Column added to pending changes");
  };

  const handleDeleteCustomColumn = async (columnId: string) => {
    const ok = await confirmDelete();
    if (!ok) return;

    // Add to pending deletions instead of deleting immediately
    setPendingColumnDeletions(prev => new Set(prev).add(columnId));
    setHasUnsavedChanges(true);
    toast.success("Column deletion added to pending changes");
  };

  const handleToggleDefaultColumn = async (columnId: TaskStatus) => {
    const column = defaultColumns.find(col => col.id === columnId);
    if (!column) return;

    if (column.isEnabled) {
      // Disabling column - confirm first
      const ok = await confirmHide();
      if (!ok) return;
    }

    // Add to pending toggles
    setPendingColumnToggles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(columnId)) {
        newSet.delete(columnId);
      } else {
        newSet.add(columnId);
      }
      return newSet;
    });
    setHasUnsavedChanges(true);
    toast.success("Column visibility change added to pending changes");
  };

  const handleSaveChanges = async () => {
    if (!projectId) {
      toast.error("Project context missing");
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Apply column creations
    for (const columnData of pendingColumnCreations) {
      try {
        await new Promise((resolve, reject) => {
          createColumn(
            {
              json: {
                ...columnData,
                workspaceId,
                projectId,
              },
            },
            {
              onSuccess: () => {
                successCount++;
                resolve(true);
              },
              onError: () => {
                errorCount++;
                reject();
              },
            }
          );
        });
      } catch {
        // Error already counted
      }
    }

    // Apply column deletions
    for (const columnId of pendingColumnDeletions) {
      try {
        await new Promise((resolve, reject) => {
          deleteColumn(
            {
              param: { customColumnId: columnId },
            },
            {
              onSuccess: () => {
                successCount++;
                resolve(true);
              },
              onError: () => {
                errorCount++;
                reject();
              },
            }
          );
        });
      } catch {
        // Error already counted
      }
    }

    // Apply column toggles - collect all columns to disable first, then move tasks in bulk
    const columnsToDisable: TaskStatus[] = [];
    for (const columnId of pendingColumnToggles) {
      const column = defaultColumns.find((col) => col.id === columnId);
      if (column && column.isEnabled) {
        columnsToDisable.push(columnId);
      }
    }

    // Move tasks from all disabled columns
    for (const columnId of columnsToDisable) {
      try {
        await new Promise<void>((resolve, reject) => {
          moveTasksFromDisabledColumn(
            { fromColumn: columnId },
            {
              onSuccess: () => {
                successCount++;
                resolve();
              },
              onError: () => {
                errorCount++;
                reject();
              },
            }
          );
        });
      } catch {
        // Error already counted
      }
    }

    // Apply all toggle settings after tasks have been moved
    for (const columnId of pendingColumnToggles) {
      toggleColumn(columnId);
      if (!columnsToDisable.includes(columnId)) {
        successCount++;
      }
    }

    // Clear pending changes
    setPendingColumnCreations([]);
    setPendingColumnDeletions(new Set());
    setPendingColumnToggles(new Set());
    setHasUnsavedChanges(false);

    if (errorCount > 0) {
      toast.error(`${errorCount} change(s) failed to save`);
    }
    if (successCount > 0) {
      toast.success(`${successCount} change(s) saved successfully`);
    }

    // Close the modal after saving
    onCancel?.();
  };

  const handleClose = async () => {
    if (hasUnsavedChanges) {
      const shouldSave = await confirmUnsaved();
      if (shouldSave) {
        await handleSaveChanges();
      } else {
        // Discard changes and close
        setPendingColumnCreations([]);
        setPendingColumnDeletions(new Set());
        setPendingColumnToggles(new Set());
        setHasUnsavedChanges(false);
        onCancel?.();
      }
    } else {
      onCancel?.();
    }
  };

  if (isLoadingColumns) {
    return (
      <Card className="w-full h-full border-none shadow-none">
        <CardHeader className="flex p-7">
          <CardTitle className="text-xl font-bold">Manage Columns</CardTitle>
        </CardHeader>
        <CardContent className="p-7">
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Loading columns...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ConfirmHideDialog />
      <ConfirmDeleteDialog />
      <ConfirmUnsavedDialog />
      <Card className="w-full h-full border-none shadow-none">
        <CardHeader className="flex p-7">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Settings2Icon className="size-5" />
            Manage Columns
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-200 ml-2">
                Unsaved Changes
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <div className="px-7">
          <DottedSeparator />
        </div>
        <CardContent className="p-7 space-y-6">
          {/* Custom Columns Section - Moved to top */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Custom Columns</h3>
                <Badge variant="secondary" className="text-xs">
                  {customColumns?.documents?.length || 0}
                </Badge>
              </div>
              {!showCreateForm && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setShowCreateForm(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <PlusIcon className="size-4 mr-2" />
                  Add Column
                </Button>
              )}
            </div>

            {/* Create Column Form - Show at top when creating */}
            {showCreateForm && (
              <div className="border rounded-lg p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 mb-4">
                <div className="mb-4">
                  <h4 className="font-medium text-base mb-1">Create New Column</h4>
                  <p className="text-sm text-muted-foreground">Add a custom column to organize your tasks</p>
                </div>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Column Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="e.g., Priority, Status, Review"
                              className="h-11 text-base"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="icon"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Icon</FormLabel>
                            <div className="flex items-center gap-2 h-11">
                              <FormControl>
                                <input type="hidden" {...field} />
                              </FormControl>
                              <IconPicker
                                value={field.value}
                                onChange={field.onChange}
                              />
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="color"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Color</FormLabel>
                            <div className="flex items-center gap-2 h-11">
                              <FormControl>
                                <input type="hidden" {...field} />
                              </FormControl>
                              <ColorPicker
                                value={field.value}
                                onChange={field.onChange}
                              />
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isCreating}
                        className="bg-blue-600 hover:bg-blue-700 px-6"
                      >
                        {isCreating ? "Creating..." : "Create Column"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowCreateForm(false);
                          form.reset();
                        }}
                        disabled={isCreating}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            )}

            {/* Custom Columns List */}
            {customColumns?.documents && customColumns.documents.length > 0 ? (
              <div className="space-y-3">
                {customColumns.documents.map((column) => {
                  const isPendingDeletion = pendingColumnDeletions.has(column.$id);
                  return (
                    <div
                      key={column.$id}
                      className={`flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors ${isPendingDeletion ? 'opacity-50 bg-red-50 dark:bg-red-950/20' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="size-5 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: column.color }}
                        />
                        <span className={`font-medium text-base ${isPendingDeletion ? 'line-through' : ''}`}>{column.name}</span>
                        <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                          Custom
                        </Badge>
                        {isPendingDeletion && (
                          <Badge variant="destructive" className="text-xs">
                            Pending Deletion
                          </Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCustomColumn(column.$id)}
                        disabled={isDeleting || isPendingDeletion}
                        className="hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2Icon className="size-4" />
                        Delete
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              !showCreateForm && (
                <div className="text-center py-12 border-2 border-dashed border-muted-foreground/20 rounded-lg">
                  <div className="flex flex-col items-center gap-3">
                    <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                      <PlusIcon className="size-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">No custom columns yet</p>
                      <p className="text-xs text-muted-foreground">Click &ldquo;Add Column&rdquo; above to get started</p>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* Pending Column Creations */}
            {pendingColumnCreations.length > 0 && (
              <div className="space-y-3 mt-3">
                <p className="text-sm font-medium text-muted-foreground">Pending New Columns:</p>
                {pendingColumnCreations.map((columnData, index) => (
                  <div
                    key={`pending-${index}`}
                    className="flex items-center justify-between p-4 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="size-5 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: columnData.color }}
                      />
                      <span className="font-medium text-base">{columnData.name}</span>
                      <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                        Custom
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
                        Pending Creation
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPendingColumnCreations(prev => prev.filter((_, i) => i !== index));
                        if (pendingColumnCreations.length === 1 && pendingColumnDeletions.size === 0 && pendingColumnToggles.size === 0) {
                          setHasUnsavedChanges(false);
                        }
                      }}
                      className="hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2Icon className="size-4" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DottedSeparator />

          {/* Default Columns Section - Show workflow statuses if available, fallback to hardcoded defaults */}
          {projectId && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-semibold">Default Columns</h3>
                <Badge variant="outline" className="text-xs">
                  {project?.workflowId ? "From Workflow" : "Project-specific"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {project?.workflowId 
                  ? "These columns come from your assigned workflow. Show or hide them for this project."
                  : "Show or hide the default workflow columns for this project. Hidden columns will move all tasks to \"Todo\"."
                }
              </p>
              
              {/* Loading state for workflow statuses */}
              {isLoadingWorkflowStatuses && project?.workflowId && (
                <div className="flex items-center justify-center py-4">
                  <div className="text-sm text-muted-foreground">Loading workflow statuses...</div>
                </div>
              )}
              
              {/* Workflow-based columns (if project has a workflow) */}
              {project?.workflowId && workflowColumns.length > 0 && (
                <div className="space-y-3">
                  {workflowColumns.map((column) => {
                    const isPendingToggle = pendingColumnToggles.has(column.id);
                    // Find if this column has an existing default column setting
                    const existingDefault = defaultColumns.find(dc => dc.id === column.id);
                    const isEnabled = existingDefault ? existingDefault.isEnabled : true;
                    const willBeEnabled = isPendingToggle ? !isEnabled : isEnabled;
                    return (
                      <div
                        key={column.id}
                        className={`flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors ${isPendingToggle ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="size-4 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: column.color || '#6B7280' }}
                          />
                          <span className="font-medium">{column.name}</span>
                          <Badge variant={willBeEnabled ? "default" : "secondary"} className="text-xs">
                            {willBeEnabled ? "Visible" : "Hidden"}
                          </Badge>
                          {isPendingToggle && (
                            <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200">
                              Pending Change
                            </Badge>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleDefaultColumn(column.id)}
                          className={isEnabled ? "hover:bg-orange-50 hover:text-orange-700" : "hover:bg-green-50 hover:text-green-700"}
                        >
                          {isEnabled ? (
                            <EyeOffIcon className="size-4 mr-2" />
                          ) : (
                            <EyeIcon className="size-4 mr-2" />
                          )}
                          {isEnabled ? "Hide" : "Show"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Fallback to default columns if no workflow or no workflow columns */}
              {(!project?.workflowId || workflowColumns.length === 0) && !isLoadingWorkflowStatuses && (
                <div className="space-y-3">
                  {defaultColumns.map((column) => {
                    const isPendingToggle = pendingColumnToggles.has(column.id);
                    const willBeEnabled = isPendingToggle ? !column.isEnabled : column.isEnabled;
                    return (
                      <div
                        key={column.id}
                        className={`flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors ${isPendingToggle ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{column.name}</span>
                          <Badge variant={willBeEnabled ? "default" : "secondary"} className="text-xs">
                            {willBeEnabled ? "Visible" : "Hidden"}
                          </Badge>
                          {isPendingToggle && (
                            <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200">
                              Pending Change
                            </Badge>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleDefaultColumn(column.id)}
                          className={column.isEnabled ? "hover:bg-orange-50 hover:text-orange-700" : "hover:bg-green-50 hover:text-green-700"}
                        >
                          {column.isEnabled ? (
                            <EyeOffIcon className="size-4 mr-2" />
                          ) : (
                            <EyeIcon className="size-4 mr-2" />
                          )}
                          {column.isEnabled ? "Hide" : "Show"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <DottedSeparator />

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isCreating || isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSaveChanges}
              disabled={!hasUnsavedChanges || isCreating || isDeleting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isCreating || isDeleting ? "Saving..." : "Save & Close"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
