"use client";

import { useParams, usePathname } from "next/navigation";
import { ProjectAIChat } from "./project-ai-chat";

export const ProjectAIChatWrapper = () => {
  const params = useParams();
  const pathname = usePathname();

  // Only show the AI chat when on a project page
  const projectId = params?.projectId as string | undefined;
  const workspaceId = params?.workspaceId as string | undefined;

  // Check if we're on a project page (any page under /workspaces/[id]/projects/[id])
  const isProjectPage = pathname?.includes("/projects/") && projectId && workspaceId;

  if (!isProjectPage || !projectId || !workspaceId) {
    return null;
  }

  return <ProjectAIChat projectId={projectId} workspaceId={workspaceId} />;
};
