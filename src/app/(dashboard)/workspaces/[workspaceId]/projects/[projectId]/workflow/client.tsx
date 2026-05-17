"use client";

import { useParams, useRouter } from "next/navigation";
import { Plus, GitBranch, Settings, Workflow, Info, CheckCircle2, Layers, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";

import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useGetProject } from "@/features/projects/api/use-get-project";
import { useUpdateProject } from "@/features/projects/api/use-update-project";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetWorkflows } from "@/features/workflows/api/use-get-workflows";
import { useGetWorkflow } from "@/features/workflows/api/use-get-workflow";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { useCreateWorkflowModal } from "@/features/workflows/hooks/use-create-workflow-modal";
import { CreateWorkflowModal } from "@/features/workflows/components/create-workflow-modal";

export const ProjectWorkflowClient = () => {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const workspaceId = useWorkspaceId();
  const { open: openCreateWorkflow } = useCreateWorkflowModal();

  const { data: project, isLoading: isLoadingProject } = useGetProject({ projectId });
  const { data: workflowsData, isLoading: isLoadingWorkflows } = useGetWorkflows({ workspaceId });
  const { data: projectWorkflow } = useGetWorkflow({ 
    workflowId: project?.workflowId || "" 
  });
  const { mutate: updateProject, isPending: isUpdating } = useUpdateProject();
  const { isAdmin } = useCurrentMember({ workspaceId });

  const [isSelectWorkflowOpen, setIsSelectWorkflowOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");

  const workflows = useMemo(() => workflowsData?.documents ?? [], [workflowsData]);

  // Get space workflows if project belongs to a space
  const spaceWorkflows = useMemo(() => {
    if (!project?.spaceId) return [];
    return workflows.filter(w => w.spaceId === project.spaceId);
  }, [workflows, project?.spaceId]);

  // Get workspace-level workflows
  const workspaceWorkflows = useMemo(() => {
    return workflows.filter(w => !w.spaceId && !w.projectId);
  }, [workflows]);

  if (isLoadingProject || isLoadingWorkflows) {
    return <PageLoader />;
  }

  if (!project) {
    return <PageError message="Project not found." />;
  }

  const handleAssignWorkflow = () => {
    if (!selectedWorkflowId) return;

    updateProject(
      {
        param: { projectId },
        form: { workflowId: selectedWorkflowId },
      },
      {
        onSuccess: () => {
          setIsSelectWorkflowOpen(false);
          setSelectedWorkflowId("");
        },
      }
    );
  };

  const handleRemoveWorkflow = () => {
    updateProject({
      param: { projectId },
      form: { workflowId: "" },
    });
  };

  const handleCreateProjectWorkflow = () => {
    openCreateWorkflow();
  };

  const handleEditWorkflow = (workflowId: string) => {
    if (project.spaceId) {
      router.push(`/workspaces/${workspaceId}/spaces/${project.spaceId}/workflows/${workflowId}`);
    } else {
      router.push(`/workspaces/${workspaceId}/workflows/${workflowId}`);
    }
  };

  return (
    <div className="flex flex-col gap-y-5 w-full mx-auto">
      <CreateWorkflowModal workspaceId={workspaceId} projectId={projectId} />

      {/* Current Workflow */}
      <Card className="border-none shadow-none">
        <CardHeader>
          <div className="flex items-center w-full justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="size-5 text-primary" />
              <CardTitle>Current Workflow</CardTitle>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                {project.workflowId ? (
                  <>
                    <Button 
                      variant="outline" 
                      size="xs" 
                      onClick={() => handleEditWorkflow(project.workflowId!)}
                      className="gap-2"
                    >
                      <Settings className="size-4" />
                      Edit Workflow
                    </Button>
                    <Button 
                      variant="outline" 
                      size="xs" 
                      onClick={() => setIsSelectWorkflowOpen(true)}
                      className="gap-2"
                    >
                      <Workflow className="size-4" />
                      Change
                    </Button>
                  </>
                ) : (
                  <Button 
                    size="xs" 
                    onClick={() => setIsSelectWorkflowOpen(true)}
                    className="gap-2"
                  >
                    <Plus className="size-4" />
                    Assign Workflow
                  </Button>
                )}
              </div>
            )}
          </div>
          <CardDescription>
            The workflow defines the statuses and transitions for work items in this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {project.workflowId && projectWorkflow ? (
            <div className="space-y-4">
              {/* Workflow Info */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <GitBranch className="size-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{projectWorkflow.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {projectWorkflow.description || "No description"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {projectWorkflow.statuses?.length || 0} Statuses
                  </Badge>
                  {isAdmin && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleRemoveWorkflow}
                      disabled={isUpdating}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              {/* Statuses Preview */}
              {projectWorkflow.statuses && projectWorkflow.statuses.length > 0 && (
                <div className="space-y-3">
                  <h5 className="text-sm font-medium ">Statuses</h5>
                  <div className="flex flex-wrap gap-2">
                    {projectWorkflow.statuses.map((status) => (
                      <div
                        key={status.$id}
                        className="flex items-center gap-2 px-3 py-1 rounded-lg border bg-background"
                        style={{ borderColor: status.color, backgroundColor: `${status.color}20` }}
                      >
                        <div 
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        <span className="text-xs font-medium">{status.name}</span>
                       
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl bg-muted/30">
              <div className="rounded-full bg-muted p-4 mb-4">
                <GitBranch className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Workflow Assigned</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                This project doesn&apos;t have a workflow assigned. Work items will use default statuses.
                {isAdmin && " Assign a workflow to define custom statuses and transitions."}
              </p>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Button size={"xs"} onClick={() => setIsSelectWorkflowOpen(true)} className="gap-2">
                    <Plus className="size-2" />
                    Assign Workflow
                  </Button>
                  <Button variant="outline" size={"xs"} onClick={handleCreateProjectWorkflow} className="gap-2">
                    <Plus className="size-4" />
                    Create New
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How Project Workflows Work */}
      <div className="rounded-xl border border-border/60 bg-gradient-to-br from-muted/40 via-muted/20 to-background p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-1.5 rounded-lg ">
            <Info className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-medium text-sm ">How Project Workflows Work</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            {
              icon: GitBranch,
              title: "Dedicated Workflows",
              text: "Each project can have its own dedicated workflow for full control.",
              color: "text-violet-500",
              bg: "bg-violet-500/10",
            },
            {
              icon: Plus,
              title: "Auto-synced Statuses",
              text: "New statuses created in the project are added to this workflow automatically.",
              color: "text-emerald-500",
              bg: "bg-emerald-500/10",
            },
            {
              icon: Layers,
              title: "Shared Workflows",
              text: "You can use a shared workflow from the space or workspace level.",
              color: "text-blue-500",
              bg: "bg-blue-500/10",
            },
            {
              icon: ArrowRight,
              title: "Controlled Transitions",
              text: "Work items can only transition between statuses defined in the workflow.",
              color: "text-orange-500",
              bg: "bg-orange-500/10",
            },
          ].map(({ icon: Icon, title, text, color, bg }) => (
            <div
              key={title}
              className="flex items-start gap-3 p-3.5 rounded-lg bg-background/70 border border-border/40 hover:bg-background/90 transition-colors"
            >
              <div className={`p-1.5 rounded-md ${bg} shrink-0 mt-0.5`}>
                <Icon className={`size-3.5 ${color}`} />
              </div>
              <div>
                <p className="text-sm font-medium  mb-0.5">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Available Workflows */}
      <Card className="shadow-none">
        <CardHeader className="pb-6">
          <div className="flex items-center gap-2">
            <Workflow className="size-5 text-medium text-primary" />
            <CardTitle className="font-medium tracking-normal">Available Workflows</CardTitle>
          </div>
          <CardDescription>
            Workflows you can assign to this project
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-1">
          {spaceWorkflows.length > 0 && (
            <div className="mb-1 border-t">
              {/* Section header */}
           
              <div className="divide-y divide-border/50">
                {spaceWorkflows.map((workflow) => (
                  <WorkflowRow
                    key={workflow.$id}
                    workflow={workflow}
                    isActive={project.workflowId === workflow.$id}
                    isAdmin={isAdmin}
                    onSelect={() => {
                      setSelectedWorkflowId(workflow.$id);
                      setIsSelectWorkflowOpen(true);
                    }}
                    onEdit={() => handleEditWorkflow(workflow.$id)}
                  />
                ))}
              </div>
            </div>
          )}

          {workspaceWorkflows.length > 0 && (
            <div className="mb-1">
              {/* Section header */}
              <div className="flex items-center gap-2 px-6 py-2 border-y bg-muted/30">
                <Badge variant="outline" className="font-normal text-xs">Workspace</Badge>
                <span className="text-xs text-muted-foreground font-medium">Global Workflows</span>
              </div>
              <div className="divide-y divide-border/50">
                {workspaceWorkflows.map((workflow) => (
                  <WorkflowRow
                    key={workflow.$id}
                    workflow={workflow}
                    isActive={project.workflowId === workflow.$id}
                    isAdmin={isAdmin}
                    onSelect={() => {
                      setSelectedWorkflowId(workflow.$id);
                      setIsSelectWorkflowOpen(true);
                    }}
                    onEdit={() => handleEditWorkflow(workflow.$id)}
                  />
                ))}
              </div>
            </div>
          )}

          {workflows.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm px-6">
              No workflows available. Create one to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Select/Assign Workflow Dialog */}
      <Dialog open={isSelectWorkflowOpen} onOpenChange={setIsSelectWorkflowOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="size-5" />
              Assign Workflow
            </DialogTitle>
            <DialogDescription>
              Select a workflow to use for this project
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Select value={selectedWorkflowId} onValueChange={setSelectedWorkflowId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a workflow..." />
              </SelectTrigger>
              <SelectContent>
                {spaceWorkflows.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Space Workflows
                    </div>
                    {spaceWorkflows.map((workflow) => (
                      <SelectItem key={workflow.$id} value={workflow.$id}>
                        <div className="flex items-center gap-2">
                          <GitBranch className="size-4" />
                          {workflow.name}
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
                {workspaceWorkflows.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Workspace Workflows
                    </div>
                    {workspaceWorkflows.map((workflow) => (
                      <SelectItem key={workflow.$id} value={workflow.$id}>
                        <div className="flex items-center gap-2">
                          <GitBranch className="size-4" />
                          {workflow.name}
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>

            <div className="flex justify-end gap-2 pt-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsSelectWorkflowOpen(false);
                  setSelectedWorkflowId("");
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAssignWorkflow} 
                disabled={!selectedWorkflowId || isUpdating}
                className="gap-2"
              >
                {isUpdating ? "Assigning..." : "Assign Workflow"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Workflow Row Component (list design)
interface WorkflowCardProps {
  workflow: {
    $id: string;
    name: string;
    key: string;
    description?: string | null;
    isDefault?: boolean;
    statusCount?: number;
  };
  isActive: boolean;
  isAdmin: boolean;
  onSelect: () => void;
  onEdit: () => void;
}

const WorkflowRow = ({ workflow, isActive, isAdmin, onSelect, onEdit }: WorkflowCardProps) => {
  return (
    <div
      className={`group flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-muted/30 ${
        isActive ? "bg-primary/5" : ""
      }`}
    >
      {/* Active indicator */}
      <div
        className={`size-2 rounded-full shrink-0 transition-colors ${
          isActive ? "!bg-blue-500" : "bg-muted-foreground/25 group-hover:bg-muted-foreground/40"
        }`}
      />

      {/* Icon */}
      <div className={`p-1.5 rounded-md shrink-0 ${isActive ? "bg-primary/10" : "bg-muted/60"}`}>
        <GitBranch className={`size-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
      </div>

      {/* Name & description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{workflow.name}</span>
          {isActive && (
            <Badge className="text-[10px] bg-blue-500/20 text-blue-600 px-1.5 py-0 h-4 gap-1">
              <CheckCircle2 className="size-2.5" />
              Active
            </Badge>
          )}
          {workflow.isDefault && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              Default
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {workflow.description || "No description"}
        </p>
      </div>

      {/* Key */}
      {workflow.key && (
        <span className="text-xs font-mono text-muted-foreground/60 hidden md:block shrink-0">
          {workflow.key}
        </span>
      )}

      {/* Status count */}
      <Badge variant="outline" className="text-xs text-medium text-green-500 bg-green-200/40 rounded-md border-none shadow-sm shrink-0 hidden sm:flex h-6">
        {workflow.statusCount || 0} statuses
      </Badge>

      {/* Action buttons */}
      <div className="shrink-0">
        {isAdmin && !isActive && (
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className="bg-blue-100/60 text-blue-600 hover:bg-blue-200/50 text-xs h-7 px-3 font-medium"
          >
            Use This
          </Button>
        )}
        {isAdmin && isActive && (
          <Button
            variant="destructive"
            size="xs"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="text-[10px] px-6"
          >
            Edit
          </Button>
        )}
      </div>
    </div>
  );
};
