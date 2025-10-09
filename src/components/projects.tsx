"use client";

import { useRouter, useParams } from "next/navigation";
import { RiAddCircleFill } from "react-icons/ri";

import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCreateProjectModal } from "@/features/projects/hooks/use-create-project-modal";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Projects = () => {
  const router = useRouter();
  const params = useParams();
  const { open } = useCreateProjectModal();
  const workspaceId = useWorkspaceId();
  const { data } = useGetProjects({ workspaceId });

  const projectId = params.projectId as string;

  const onSelect = (id: string) => {
    router.push(`/workspaces/${workspaceId}/projects/${id}`);
  };

  return (
    <div className="flex flex-col px-3 py-4">
      <div className="flex items-center justify-between pb-4">
        <p className="text-[13px] tracking-normal font-medium pl-2 text-primary">Projects</p>
        <RiAddCircleFill
          onClick={open}
          className="size-5 text-neutral-500 cursor-pointer hover:opacity-75 transition"
        />
      </div>

      <Select onValueChange={onSelect} value={projectId}>
        <SelectTrigger className="w-full font-medium text-sm">
          <SelectValue placeholder="No project selected." />
        </SelectTrigger>

        <SelectContent>
          {data?.documents.map((project) => (
            <SelectItem key={project.$id} value={project.$id}>
              <div className="flex justify-start items-center gap-3 font-medium">
                <ProjectAvatar
                  name={project.name}
                  image={project.imageUrl}
                />
                <span className="truncate">{project.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
