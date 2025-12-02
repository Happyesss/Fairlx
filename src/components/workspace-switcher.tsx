"use client";

import { RiAddCircleFill } from "react-icons/ri";

import { useGetWorkspaces } from "@/features/workspaces/api/use-get-workspaces";
import { WorkspaceAvatar } from "@/features/workspaces/components/workspace-avatar";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCreateWorkspaceModal } from "@/features/workspaces/hooks/use-create-workspace-modal";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";

export const WorkspaceSwitcher = () => {
  const workspaceId = useWorkspaceId();
  const router = useRouter();
  const { data: workspaces } = useGetWorkspaces();
  const { open } = useCreateWorkspaceModal();
  const { isAdmin } = useCurrentMember({ workspaceId });

  const onSelect = (id: string) => {
    router.push(`/workspaces/${id}`);
  };

  return (
    <div className="flex flex-col px-3 pt-5 pb-8   border-t-[1.5px] border-neutral-200">
      <div className="flex items-center justify-between pb-4 ">
        <p className="text-[13px] tracking-normal font-medium  pl-2 text-primary">Workspaces</p>
        {isAdmin && (
          <RiAddCircleFill
            onClick={open}
            className="size-5 text-neutral-500 cursor-pointer hover:opacity-75 transition"
          />
        )}
      </div>

      <Select onValueChange={onSelect} value={workspaceId}>

        <SelectTrigger className="w-full  font-medium text-sm ">
          <SelectValue placeholder="No workspace selected." />
        </SelectTrigger>

        <SelectContent>
          {workspaces?.documents.map((workspace) => (
            <SelectItem key={workspace.$id} value={workspace.$id}>
              <div className="flex justify-start items-center gap-3 font-medium">
                <WorkspaceAvatar
                  name={workspace.name}
                  image={workspace.imageUrl}
                />
                <span className="truncate">{workspace.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
