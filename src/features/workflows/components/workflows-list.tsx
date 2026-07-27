"use client";

import { GitBranch, Plus, ChevronRight, Settings } from "lucide-react";
import { useRouter } from "next/navigation";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { useGetWorkflows } from "../api/use-get-workflows";
import { useCreateWorkflowModal } from "../hooks/use-create-workflow-modal";
import { Workflow } from "../types";
import { getWorkflowEditorHref } from "../lib/workflow-routes";

interface WorkflowsListProps {
  spaceId?: string;
  projectId?: string;
}

export const WorkflowsList = ({ spaceId, projectId }: WorkflowsListProps) => {
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const { open } = useCreateWorkflowModal();
  const { data, isLoading } = useGetWorkflows({ workspaceId, spaceId, projectId });

  const workflows = data?.documents ?? [];

  const handleWorkflowClick = (workflow: Workflow) => {
    router.push(
      getWorkflowEditorHref({
        workspaceId,
        workflowId: workflow.$id,
        spaceId: workflow.spaceId || spaceId,
      })
    );
  };

  const handleSettingsClick = (e: React.MouseEvent, workflow: Workflow) => {
    e.stopPropagation();
    handleWorkflowClick(workflow);
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <GitBranch className="size-5" />
          Workflows
        </CardTitle>
        <Button variant="teritary" size="sm" onClick={open}>
          <Plus className="size-4 mr-1" />
          New Workflow
        </Button>
      </CardHeader>
      <CardContent>
        {workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <GitBranch className="size-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No workflows yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create a workflow to define status progressions
            </p>
            <Button onClick={open}>
              <Plus className="size-4 mr-1" />
              Create Workflow
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {workflows.map((workflow) => (
              <div
                key={workflow.$id}
                onClick={() => handleWorkflowClick(workflow)}
                className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <GitBranch className="size-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{workflow.name}</span>
                      {workflow.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          Default
                        </Badge>
                      )}
                      {workflow.isSystem && (
                        <Badge variant="outline" className="text-xs">
                          System
                        </Badge>
                      )}
                    </div>
                    {workflow.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {workflow.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={(e) => handleSettingsClick(e, workflow)}
                  >
                    <Settings className="size-4" />
                  </Button>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
