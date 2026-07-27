import { redirect } from "next/navigation";
import { getCurrent } from "@/features/auth/queries";
import { WorkflowDetailClient } from "@/app/(dashboard)/workspaces/[workspaceId]/spaces/[spaceId]/workflows/[workflowId]/client";

/**
 * Workspace-scoped workflow editor for workflows that are not tied to a space.
 * Space-scoped workflows should open under /spaces/[spaceId]/workflows/[workflowId].
 */
const WorkspaceWorkflowDetailPage = async () => {
  const user = await getCurrent();
  if (!user) redirect("/sign-in");

  return <WorkflowDetailClient />;
};

export default WorkspaceWorkflowDetailPage;
