"use client";

import { useParams, useRouter } from "next/navigation";
import {
  Settings,
  Workflow,
  Plus,
  FolderKanban,
  FolderPlus,
  X,
  GitBranch,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { SpaceWorkflowsModal } from "@/features/workflows/components/space-workflows-modal";

import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useGetSpace } from "@/features/spaces/api/use-get-space";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useCreateProjectModal } from "@/features/projects/hooks/use-create-project-modal";
import { CreateProjectModal } from "@/features/projects/components/create-project-modal";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { useUpdateProject } from "@/features/projects/api/use-update-project";
import { useConfirm } from "@/hooks/use-confirm";
import { MasterBadge } from "@/features/spaces/components/space-role-badge";
import { useGetWorkflows } from "@/features/workflows/api/use-get-workflows";
// import { useGetTeams } from "@/features/teams/api/use-get-teams";
// import { useUpdateTeam } from "@/features/teams/api/use-update-team";
import { useGetMembers } from "@/features/members/api/use-get-members";
// import { useGetTeamMembers } from "@/features/teams/api/use-get-team-members";

export const SpaceIdClient = () => {
  const router = useRouter();
  const params = useParams();
  const spaceId = params.spaceId as string;
  const workspaceId = useWorkspaceId();
  const { open: openCreateProject } = useCreateProjectModal();
  const { mutate: updateProject, isPending: isUpdatingProject } = useUpdateProject();

  const [ConfirmProjectDialog, confirmProjectRemove] = useConfirm(
    "Remove Project",
    "Are you sure you want to remove this project from the space? The project will not be deleted, just unassigned from this space.",
    "destructive"
  );

  const { data: space, isLoading: isLoadingSpace } = useGetSpace({ spaceId });
  const { data: projectsData, isLoading: isLoadingProjects } = useGetProjects({ workspaceId });
  const { data: membersData } = useGetMembers({ workspaceId });
  const { data: workflowsData } = useGetWorkflows({ workspaceId, spaceId });
  const { isAdmin } = useCurrentMember({ workspaceId });

  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const [isWorkflowsModalOpen, setIsWorkflowsModalOpen] = useState(false);

  // Workspace admins are treated as space masters
  const isMaster = isAdmin;

  // Create a map of workflow IDs to names
  const workflowMap = useMemo(() => {
    const map = new Map<string, string>();
    if (workflowsData?.documents) {
      for (const workflow of workflowsData.documents) {
        map.set(workflow.$id, workflow.name);
      }
    }
    return map;
  }, [workflowsData]);

  // Get the space owner from members
  const spaceOwner = useMemo(() => {
    if (!space?.ownerId || !membersData?.documents) return null;
    return membersData.documents.find(member => member.userId === space.ownerId);
  }, [space?.ownerId, membersData?.documents]);

  // Filter projects that belong to this space
  const spaceProjects = useMemo(() => {
    if (!projectsData?.documents) return [];
    return projectsData.documents.filter(project => project.spaceId === spaceId);
  }, [projectsData, spaceId]);

  // Get all projects without a space (available to add)
  const availableProjects = useMemo(() => {
    if (!projectsData?.documents) return [];
    return projectsData.documents.filter(project => {
      const hasNoSpace = !project.spaceId ||
        project.spaceId === null ||
        project.spaceId === undefined ||
        project.spaceId === "" ||
        project.spaceId === "null" ||
        project.spaceId === "undefined" ||
        (typeof project.spaceId === 'string' && project.spaceId.trim() === "");
      return hasNoSpace;
    });
  }, [projectsData]);

  if (isLoadingSpace || isLoadingProjects) {
    return <PageLoader />;
  }

  if (!space) {
    return <PageError message="Space not found." />;
  }

  const handleProjectClick = (projectId: string) => {
    router.push(`/workspaces/${workspaceId}/projects/${projectId}`);
  };

  const handleWorkflowClick = (projectId: string, projectWorkflowId: string | undefined, e: React.MouseEvent) => {
    e.stopPropagation();
    // If project has a workflow assigned, go directly to the workflow editor
    if (projectWorkflowId) {
      router.push(`/workspaces/${workspaceId}/spaces/${spaceId}/workflows/${projectWorkflowId}`);
    } else {
      // Otherwise, go to the project workflow setup page
      router.push(`/workspaces/${workspaceId}/projects/${projectId}/workflow`);
    }
  };

  const handleCreateProject = () => {
    openCreateProject(spaceId);
  };

  const handleAddExistingProject = (projectId: string) => {
    updateProject(
      {
        param: { projectId },
        form: { spaceId },
      },
      {
        onSuccess: () => {
          setIsAddProjectOpen(false);
        },
      }
    );
  };

  const handleRemoveProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirmProjectRemove();
    if (!ok) return;

    updateProject(
      {
        param: { projectId },
        form: { spaceId: "" },
      }
    );
  };

  /* Legacy Team Handlers Removed */

  return (
    <div className="flex flex-col ">
      <ConfirmProjectDialog />
      <CreateProjectModal />

      {/* Space Workflows Modal */}
      <SpaceWorkflowsModal
        isOpen={isWorkflowsModalOpen}
        onClose={() => setIsWorkflowsModalOpen(false)}
        spaceId={spaceId}
        spaceName={space.name}
        workspaceId={workspaceId}
      />

      {/* Professional Header */}
      <div className="py-2 px-3">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          {/* Left: Space Info */}
          <div className="flex items-start gap-4">
     
            <div className="space-y-2">
              <div className="flex flex-col  gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{space.name}</h1>
                <div className="flex flex-col  gap-2 ">

                  <div className="flex items-center gap-2">
                         <div className="px-2 py-0.5 rounded text-xs font-medium bg-muted/100 text-muted-foreground border border-muted/100">
                          <p className="text-[10px]">{space.key}</p> 

                     </div>
                    {isMaster && <MasterBadge size="sm" />}
                  </div>
                    
                  <div>

                     {spaceOwner && (
                <div className="flex items-center mt-1 gap-2 ">
                  <div className="flex items-center gap-2 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md">
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-500">
                      Space Master:
                    </span>
                  
                    <span className="text-xs font-medium">{spaceOwner.name}</span>
                  </div>
                </div>
              )}
                  </div>

                </div>

                
              </div>
             

             
            </div>
           
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="xs"
              className="gap-2"
              onClick={() => setIsWorkflowsModalOpen(true)}
            >
              <Workflow className="size-4" />
              Workflows
            </Button>
            {isMaster && (
              <Link href={`/workspaces/${workspaceId}/spaces/${spaceId}/settings`}>
                <Button variant="outline" size="xs" className="gap-2">
                  <Settings className="size-4" />
                  Settings
                </Button>
              </Link>
            )}
          </div>
        </div>

          <p className="text-muted-foreground  text-sm tracking-normal mt-4">
                {space.description || "No description provided"}
              </p>

      
      </div>

      {/* Projects Section */}
      <Card className=" mt-8 shadow-none border-none rounded-lg">
        <CardHeader className="pb-6 border-t  mb-6">
          <div className="flex items-center  justify-between">
            <div className="flex items-center gap-3">
             
              <div>
                <CardTitle className="text-lg">Projects</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage projects in {space.name}
                </p>
              </div>
            </div>
            {isMaster && (
              <div className="flex items-center gap-2">
                <Button onClick={handleCreateProject} size="xs" className="gap-2">
                  <Plus className="size-4" />
                  Create Project
                </Button>
                <Button onClick={() => setIsAddProjectOpen(true)} size="xs" variant="outline" className="gap-2">
                  <FolderPlus className="size-4" />
                  Add Existing
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {spaceProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl bg-muted/30">
              <div className="rounded-full bg-muted p-4 mb-4">
                <FolderKanban className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Projects Yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                Projects help you organize work items and track progress.
                {isMaster && " Create a new project to get started!"}
              </p>
              {isMaster && (
                <Button onClick={handleCreateProject} className="gap-2">
                  <Plus className="size-4" />
                  Create First Project
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {spaceProjects.map((project) => (
                <Card
                  key={project.$id}
                  className="group cursor-pointer transition-all duration-200 border border-border/60  bg-card"
                  onClick={() => handleProjectClick(project.$id)}
                >
                  <CardContent className="p-5">
                    {/* Top Row: Avatar + Action Buttons */}
                    <div className="flex items-start justify-between mb-5">
                      <ProjectAvatar
                        name={project.name}
                        image={project.imageUrl}
                        className="size-12 rounded-full flex-shrink-0"
                      />
                      <div className="flex items-center gap-1.5">
                        {/* Workflow Button */}
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="xs"
                                variant={project.workflowId ? "secondary" : "outline"}
                                className="h-8 px-3 gap-1.5 text-xs font-medium rounded-lg"
                                onClick={(e) => handleWorkflowClick(project.$id, project.workflowId, e)}
                              >
                                <GitBranch className="size-3.5" />
                                {project.workflowId ? "Workflow" : "Add Workflow"}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent size="xs" side="top">
                              <p>Project Workflow</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {/* Remove Button */}
                        {isMaster && (
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg"
                                  disabled={isUpdatingProject}
                                  onClick={(e) => handleRemoveProject(project.$id, e)}
                                >
                                  <X className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" size="xs">
                                <p>Remove from space</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>

                    {/* Project Key + Name */}
                    <div className="mb-4">
                      {project.key && (
                        <p className="text-xs font-medium text-muted-foreground mb-1.5 tracking-widest uppercase">
                          {project.key}
                        </p>
                      )}
                      <h4 className="font-semibold text-xl leading-snug tracking-tight group-hover:text-primary transition-colors line-clamp-2">
                        {project.name}
                      </h4>

                       <p className="text-xs text-muted-foreground  tracking-normal leading-relaxed mt-2 line-clamp-3 ">
                          {project.description || "No description provided"}
                        </p>
                    </div>

                    {/* Tags */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-xs font-medium text-muted-foreground border border-border/40">
                        <GitBranch className="size-3" />
                        {project.workflowId
                          ? workflowMap.get(project.workflowId) || "Custom Workflow"
                          : "Default Workflow"}
                      </span>

                  
                    </div>

                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Existing Project Dialog */}
      <Dialog open={isAddProjectOpen} onOpenChange={setIsAddProjectOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <FolderPlus className="size-5" />
              Add Existing Project
            </DialogTitle>
            <DialogDescription>
              Select a project to assign to {space.name}. Only unassigned projects are shown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2">
            {availableProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <FolderKanban className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">No Available Projects</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  All projects are already assigned to spaces.
                </p>
              </div>
            ) : (
              <>
                <div className="text-sm text-muted-foreground px-1 pb-2">
                  {availableProjects.length} {availableProjects.length === 1 ? 'project' : 'projects'} available
                </div>
                {availableProjects.map((project) => (
                  <Card
                    key={project.$id}
                    className="group cursor-pointer hover:shadow-md transition-all duration-200 border hover:border-primary/30"
                    onClick={() => handleAddExistingProject(project.$id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <ProjectAvatar
                            name={project.name}
                            image={project.imageUrl}
                            className="size-10 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold truncate group-hover:text-primary transition-colors">
                              {project.name}
                            </h4>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {project.description || "No description"}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          disabled={isUpdatingProject}
                          className="flex-shrink-0 gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddExistingProject(project.$id);
                          }}
                        >
                          <Plus className="size-4" />
                          Add
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
