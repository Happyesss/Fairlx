"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  GitBranch, 
  Plus, 
  FolderKanban, 
  ExternalLink,
  Workflow,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useGetWorkflows } from "../api/use-get-workflows";
import { useUpdateWorkflow } from "../api/use-update-workflow";
import { useDeleteWorkflow } from "../api/use-delete-workflow";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useCreateWorkflowModal } from "../hooks/use-create-workflow-modal";
import { CreateWorkflowModal } from "./create-workflow-modal";
import { getWorkflowEditorHref } from "../lib/workflow-routes";

interface SpaceWorkflowsModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  spaceName: string;
  workspaceId: string;
}

export const SpaceWorkflowsModal = ({
  isOpen,
  onClose,
  spaceId,
  spaceName,
  workspaceId,
}: SpaceWorkflowsModalProps) => {
  const router = useRouter();
  const { open: openCreateWorkflow } = useCreateWorkflowModal();
  
  // State for inline editing
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteWorkflowId, setDeleteWorkflowId] = useState<string | null>(null);
  
  const { data: workflowsData, isLoading: isLoadingWorkflows } = useGetWorkflows({ 
    workspaceId, 
    spaceId 
  });
  
  const { data: projectsData, isLoading: isLoadingProjects } = useGetProjects({ 
    workspaceId 
  });

  const { mutate: updateWorkflow, isPending: isUpdating } = useUpdateWorkflow();
  const { mutate: deleteWorkflow, isPending: isDeleting } = useDeleteWorkflow();

  const workflows = useMemo(() => workflowsData?.documents ?? [], [workflowsData?.documents]);
  const allProjects = useMemo(() => projectsData?.documents ?? [], [projectsData?.documents]);

  // Get projects that belong to this space
  const spaceProjects = useMemo(() => {
    return allProjects.filter(project => project.spaceId === spaceId);
  }, [allProjects, spaceId]);

  // Create a map of workflowId -> projects using that workflow
  const workflowProjectsMap = useMemo(() => {
    const map = new Map<string, typeof spaceProjects>();
    
    spaceProjects.forEach(project => {
      if (project.workflowId) {
        const existing = map.get(project.workflowId) ?? [];
        existing.push(project);
        map.set(project.workflowId, existing);
      }
    });
    
    return map;
  }, [spaceProjects]);

  // Get workflow being deleted for confirmation dialog
  const workflowToDelete = useMemo(() => {
    if (!deleteWorkflowId) return null;
    return workflows.find(w => w.$id === deleteWorkflowId);
  }, [deleteWorkflowId, workflows]);

  const handleProjectClick = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/workspaces/${workspaceId}/projects/${projectId}`);
    onClose();
  };

  const handleCreateWorkflow = () => {
    openCreateWorkflow();
  };

  const handleStartEditing = (workflowId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWorkflowId(workflowId);
    setEditingName(currentName);
  };

  const handleCancelEditing = () => {
    setEditingWorkflowId(null);
    setEditingName("");
  };

  const handleSaveEditing = (workflowId: string) => {
    if (!editingName.trim()) return;
    
    updateWorkflow(
      {
        param: { workflowId },
        json: { name: editingName.trim() },
      },
      {
        onSuccess: () => {
          setEditingWorkflowId(null);
          setEditingName("");
        },
      }
    );
  };

  const handleDeleteWorkflow = (workflowId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteWorkflowId(workflowId);
  };

  const confirmDelete = () => {
    if (!deleteWorkflowId) return;
    
    deleteWorkflow(
      { param: { workflowId: deleteWorkflowId } },
      {
        onSuccess: () => {
          setDeleteWorkflowId(null);
        },
      }
    );
  };

  const handleEditWorkflow = (workflowId: string) => {
    router.push(
      getWorkflowEditorHref({
        workspaceId,
        workflowId,
        spaceId,
      })
    );
    onClose();
  };

  const isLoading = isLoadingWorkflows || isLoadingProjects;

  return (
    <>
      <CreateWorkflowModal 
        workspaceId={workspaceId} 
        spaceId={spaceId} 
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteWorkflowId} onOpenChange={(open) => !open && setDeleteWorkflowId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{workflowToDelete?.name}&quot;? 
              This action cannot be undone. Projects using this workflow will be unlinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col gap-0 p-0 [&>button]:hidden">
          {/* Header */}
          <DialogHeader className="px-5 pt-5 pb-4 border-b shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Workflow className="size-4 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold">
                    Space Workflows
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Manage workflows for {spaceName}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleCreateWorkflow} size="sm" className="gap-1.5">
                  <Plus className="size-3.5" />
                  New
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="size-8" 
                  onClick={onClose}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Skeleton className="size-8 rounded-md" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            ) : workflows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <GitBranch className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold mb-1.5">No Workflows Yet</h3>
                <p className="text-sm text-muted-foreground mb-5 max-w-xs">
                  Workflows define how tasks move through statuses.
                </p>
                <Button onClick={handleCreateWorkflow} size="sm" className="gap-1.5">
                  <Plus className="size-3.5" />
                  Create Workflow
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Stats */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground pb-1">
                  <span className="flex items-center gap-1">
                    <Workflow className="size-3.5" />
                    {workflows.length} {workflows.length === 1 ? 'workflow' : 'workflows'}
                  </span>
                  <Separator orientation="vertical" className="h-3" />
                  <span className="flex items-center gap-1">
                    <FolderKanban className="size-3.5" />
                    {spaceProjects.filter(p => p.workflowId).length} linked
                  </span>
                </div>

                {/* Workflow List */}
                <div className="space-y-2">
                  {workflows.map((workflow) => {
                    const linkedProjects = workflowProjectsMap.get(workflow.$id) ?? [];
                    const isEditing = editingWorkflowId === workflow.$id;
                    
                    return (
                      <div
                        key={workflow.$id}
                        className="group p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors cursor-pointer"
                        onClick={() => handleEditWorkflow(workflow.$id)}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className="p-1.5 rounded-md bg-primary/10 mt-0.5">
                            <GitBranch className="size-4 text-primary" />
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Input
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  className="h-8 text-sm"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveEditing(workflow.$id);
                                    if (e.key === "Escape") handleCancelEditing();
                                  }}
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveEditing(workflow.$id);
                                  }}
                                  disabled={isUpdating}
                                >
                                  {isUpdating ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <Check className="size-3.5 text-green-600" />
                                  )}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelEditing();
                                  }}
                                  disabled={isUpdating}
                                >
                                  <X className="size-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="font-medium text-sm truncate">
                                    {workflow.name}
                                  </span>
                                  {workflow.isDefault && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                      Default
                                    </Badge>
                                  )}
                                  {workflow.isSystem && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                      System
                                    </Badge>
                                  )}
                                </div>
                                
                                {/* Linked Projects */}
                                {linkedProjects.length > 0 ? (
                                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                    <FolderKanban className="size-3 text-muted-foreground" />
                                    {linkedProjects.slice(0, 3).map((project) => (
                                      <button
                                        key={project.$id}
                                        onClick={(e) => handleProjectClick(project.$id, e)}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted hover:bg-muted/80 transition-colors"
                                      >
                                        <div 
                                          className="size-1.5 rounded-full"
                                          style={{ backgroundColor: project.color || "#6366f1" }}
                                        />
                                        <span className="truncate max-w-16">{project.name}</span>
                                        <ExternalLink className="size-2.5 opacity-50" />
                                      </button>
                                    ))}
                                    {linkedProjects.length > 3 && (
                                      <span className="text-[10px] text-muted-foreground">
                                        +{linkedProjects.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    No projects linked
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                          
                          {/* Actions */}
                          {!isEditing && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={(e) => handleStartEditing(workflow.$id, workflow.name, e)}>
                                  <Pencil className="size-3.5 mr-2" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={(e) => handleDeleteWorkflow(workflow.$id, e)}
                                  className="text-destructive focus:text-destructive"
                                  disabled={workflow.isSystem}
                                >
                                  <Trash2 className="size-3.5 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Projects using default workflow */}
                {spaceProjects.filter(p => !p.workflowId).length > 0 && (
                  <div className="mt-4 pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-2">
                      {spaceProjects.filter(p => !p.workflowId).length} projects use default workflow
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {spaceProjects.filter(p => !p.workflowId).slice(0, 5).map((project) => (
                        <button
                          key={project.$id}
                          onClick={(e) => handleProjectClick(project.$id, e)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div 
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: project.color || "#6366f1" }}
                          />
                          <span className="truncate max-w-16">{project.name}</span>
                        </button>
                      ))}
                      {spaceProjects.filter(p => !p.workflowId).length > 5 && (
                        <span className="text-[10px] text-muted-foreground px-1">
                          +{spaceProjects.filter(p => !p.workflowId).length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
