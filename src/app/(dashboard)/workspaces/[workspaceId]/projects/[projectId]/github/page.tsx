import { redirect } from "next/navigation";

interface GitHubIntegrationPageProps {
  params: Promise<{
    workspaceId: string;
    projectId: string;
  }>;
}

const GitHubIntegrationPage = async ({ params }: GitHubIntegrationPageProps) => {
  const { workspaceId, projectId } = await params;
  redirect(`/workspaces/${workspaceId}/projects/${projectId}/settings?tab=integrations`);
};

export default GitHubIntegrationPage;
