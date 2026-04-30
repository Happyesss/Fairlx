"use client";

import { useRouter, useParams } from "next/navigation";
import { RiAddCircleFill } from "react-icons/ri";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { useState } from "react";

import { useGetSpaces } from "@/features/spaces/api/use-get-spaces";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCreateSpaceModal } from "@/features/spaces/hooks/use-create-space-modal";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAccountLifecycle } from "@/components/account-lifecycle-provider";

export const Spaces = () => {
  const router = useRouter();
  const params = useParams();
  const { lifecycleState: state } = useAccountLifecycle();
  const { activeWorkspaceId } = state;
  const { open } = useCreateSpaceModal();
  const urlWorkspaceId = useWorkspaceId();

  // Use URL workspaceId if available, fallback to global active workspaceId
  const workspaceId = (urlWorkspaceId || activeWorkspaceId || "") as string;

  const { data } = useGetSpaces({ workspaceId });
  const { isAdmin } = useCurrentMember({ workspaceId });
  const [isExpanded, setIsExpanded] = useState(true);

  const spaceId = params.spaceId as string;

  const handleSpaceClick = (id: string) => {
    router.push(`/workspaces/${workspaceId}/spaces/${id}`);
  };

  const spaces = data?.documents || [];

  // Build hierarchy - separate root spaces from child spaces
  const rootSpaces = spaces.filter(space => !space.parentSpaceId);
  const childSpacesMap = spaces.reduce((acc, space) => {
    if (space.parentSpaceId) {
      if (!acc[space.parentSpaceId]) {
        acc[space.parentSpaceId] = [];
      }
      acc[space.parentSpaceId].push(space);
    }
    return acc;
  }, {} as Record<string, typeof spaces>);

  return (
    <div id="sidebar-spaces-list" className="flex flex-col px-3 py-3 border-t border-sidebar-border">
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
          Spaces
        </button>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => router.push(`/workspaces/${workspaceId}/spaces?guide=true`)}
                  className="p-1 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded transition"
                >
                  <Info className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs" align="start">
                Click for Spaces guide
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {isAdmin && (
            <RiAddCircleFill
              onClick={open}
              className="size-5 text-sidebar-foreground/70 cursor-pointer hover:opacity-75 transition"
            />
          )}
        </div>
      </div>

      <div className={`transition-all duration-700 overflow-hidden mt-2 ${isExpanded ? 'max-h-screen' : 'max-h-0'}`}>
        <div className="space-y-1">
          {rootSpaces.length === 0 ? (
            <p className="text-xs text-sidebar-foreground/60 px-2 py-1">No spaces yet</p>
          ) : (
            rootSpaces.map((space) => (
              <SpaceItem
                key={space.$id}
                space={space}
                childSpaces={childSpacesMap[space.$id] || []}
                selectedSpaceId={spaceId}
                onSelect={handleSpaceClick}
                level={0}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

interface SpaceItemProps {
  space: {
    $id: string;
    name: string;
    key: string;
    color?: string | null;
  };
  childSpaces: Array<{
    $id: string;
    name: string;
    key: string;
    color?: string | null;
  }>;
  selectedSpaceId?: string;
  onSelect: (id: string) => void;
  level: number;
}

const SpaceItem = ({ space, childSpaces, selectedSpaceId, onSelect, level }: SpaceItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = childSpaces.length > 0;
  const isSelected = selectedSpaceId === space.$id;

  return (
    <div >
      <div
        className={cn(
          "flex items-center gap-2 pl-0 py-1.5 rounded-md  cursor-pointer text-sm transition-colors",
          isSelected ? "bg-sidebar-accent text-sidebar-foreground" : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80",
        )}
        style={{ paddingLeft: `${8 + level * 12}px` }}
        onClick={() => onSelect(space.$id)}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="p-0.5 hover:bg-sidebar-accent rounded"
          >
            {isOpen ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-4" />}

        <div
          className="size-3 rounded-sm flex-shrink-0"
          style={{ backgroundColor: space.color || "#6366f1" }}
        />
        <span className="truncate flex-1 text-sm">{space.name}</span>
        {/* <span className="text-xs text-muted-foreground">{space.key}</span> */}
      </div>

      {hasChildren && isOpen && (
        <div>
          {childSpaces.map((child) => (
            <SpaceItem
              key={child.$id}
              space={child}
              childSpaces={[]}
              selectedSpaceId={selectedSpaceId}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};
