"use client";

import { useRouter, useParams } from "next/navigation";
import { RiAddCircleFill } from "react-icons/ri";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCreateProjectModal } from "@/features/projects/hooks/use-create-project-modal";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { useTourActive } from "@/lib/tour-dummy-data";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccountLifecycle } from "@/components/account-lifecycle-provider";

export const Projects = () => {
  const router = useRouter();
  const params = useParams();
  const { lifecycleState: state } = useAccountLifecycle();
  const { activeWorkspaceId } = state;
  const { open } = useCreateProjectModal();
  const urlWorkspaceId = useWorkspaceId();

  // Use URL workspaceId if available, fallback to global active workspaceId
  const workspaceId = (urlWorkspaceId || activeWorkspaceId || "") as string;

  const { data } = useGetProjects({ workspaceId });
  const { isAdmin } = useCurrentMember({ workspaceId });
  const [isExpanded, setIsExpanded] = useState(true);
  const isTourActive = useTourActive();

  const projectId = params.projectId as string;
  // If tour is active and no project selected, pretend "Fairlx" is selected
  const activeProjectId = !projectId && isTourActive ? "p1" : projectId;

  const onSelect = (id: string) => {
    // Always navigate to the project, even if it's already selected
    router.push(`/workspaces/${workspaceId}/projects/${id}`);
  };

  const handleProjectClick = (id: string) => {
    // Navigate to the project when clicked
    router.push(`/workspaces/${workspaceId}/projects/${id}`);
  };

  return (
    <div id="sidebar-projects-list" className="flex flex-col px-3 py-3 border-t border-sidebar-border">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-[11px] tracking-wider uppercase font-semibold pl-2.5 text-sidebar-foreground/50 hover:text-sidebar-foreground/70 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          Projects
        </button>
        {isAdmin && (
          <RiAddCircleFill
            onClick={() => open()}
            className="size-5 text-sidebar-foreground/70 cursor-pointer hover:opacity-75 transition"
          />
        )}
      </div>

      <div className={`transition-all duration-700 pl-2   overflow-hidden ${isExpanded ? 'max-h-96 mt-2' : ' mt-0 max-h-0'}`}>
        <Select onValueChange={onSelect} value={activeProjectId}>
          <SelectTrigger className="w-full p-2 font-medium text-xs bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground/90">
            <SelectValue placeholder={isTourActive ? "Fairlx" : "No project selected."} />
          </SelectTrigger>

          <SelectContent>
            {data?.documents.map((project) => (
              <SelectItem

                key={project.$id}
                value={project.$id}
                onPointerDown={(e: React.PointerEvent) => {
                  // Allow clicking on already selected item
                  e.stopPropagation();
                  handleProjectClick(project.$id);
                }}
              >
                <div className="flex justify-start  items-center gap-3 font-medium">
                  <ProjectAvatar
                    name={project.name}
                    image={project.imageUrl}
                  />
                  <span className="truncate text-xs">{project.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
