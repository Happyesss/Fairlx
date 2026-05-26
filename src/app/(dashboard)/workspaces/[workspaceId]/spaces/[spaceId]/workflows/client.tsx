"use client";

import { useParams } from "next/navigation";
import { ArrowLeft, Plus, BookOpen } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { WorkflowsList } from "@/features/workflows/components/workflows-list";
import { useCreateWorkflowModal } from "@/features/workflows/hooks/use-create-workflow-modal";
import { CreateWorkflowModal } from "@/features/workflows/components/create-workflow-modal";
import { useGetSpace } from "@/features/spaces/api/use-get-space";

export const WorkflowsClient = () => {
  const params = useParams();
  const spaceId = params.spaceId as string;
  const workspaceId = useWorkspaceId();
  const { isAdmin } = useCurrentMember({ workspaceId });
  const { open } = useCreateWorkflowModal();
  const { data: space } = useGetSpace({ spaceId });

  return (
    <div className="flex flex-col gap-y-4">
      <CreateWorkflowModal workspaceId={workspaceId} spaceId={spaceId} />
      
      <div className="flex items-center gap-4 mb-2">
        <Link href={`/workspaces/${workspaceId}/spaces/${spaceId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-2" />
            Back to {space?.name || "Space"}
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Workflows</h1>
          <p className="text-sm text-muted-foreground">
            Manage workflows and statuses for this space
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/workspaces/${workspaceId}/workflow-guide`}>
              <BookOpen className="size-4 mr-2" />
              Workflow Guide
            </Link>
          </Button>
          {isAdmin && (
            <Button onClick={open}>
              <Plus className="size-4 mr-2" />
              Create Workflow
            </Button>
          )}
        </div>
      </div>

      <WorkflowsList spaceId={spaceId} />
    </div>
  );
};
