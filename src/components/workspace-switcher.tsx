"use client";

import { RiAddCircleFill } from "react-icons/ri";
import { LogOut, Plus } from "lucide-react";

import { useGetWorkspaces } from "@/features/workspaces/api/use-get-workspaces";
import { WorkspaceAvatar } from "@/features/workspaces/components/workspace-avatar";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCreateWorkspaceModal } from "@/features/workspaces/hooks/use-create-workspace-modal";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { useDeleteMember } from "@/features/members/api/use-delete-member";
import { useConfirm } from "@/hooks/use-confirm";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useRouter } from "next/navigation";

import { useAccountLifecycle } from "@/components/account-lifecycle-provider";
import { useCurrentUserOrgPermissions } from "@/features/org-permissions/api/use-current-user-permissions";
import { OrgPermissionKey } from "@/features/org-permissions/types";

export const WorkspaceSwitcher = () => {
  const router = useRouter();
  const { data: workspaces } = useGetWorkspaces();
  const { open } = useCreateWorkspaceModal();

  // Use centralized permission from lifecycle context
  const { lifecycleState: state, canCreateWorkspace: lifecycleCanCreate } = useAccountLifecycle();
  const { activeWorkspaceId, activeOrgId } = state;

  // Also check department-based WORKSPACE_CREATE permission for org members
  const { hasPermission } = useCurrentUserOrgPermissions({
    orgId: activeOrgId || ""
  });
  const hasDepartmentCreatePermission = hasPermission(OrgPermissionKey.WORKSPACE_CREATE);

  // Combined: lifecycle permission OR department permission
  const canCreateWorkspace = lifecycleCanCreate || hasDepartmentCreatePermission;

  const urlWorkspaceId = useWorkspaceId();
  // Use URL workspaceId if available, otherwise fallback to global active workspaceId
  const selectedWorkspaceId = urlWorkspaceId || activeWorkspaceId || "";

  const { member } = useCurrentMember({ workspaceId: selectedWorkspaceId });
  const { mutate: deleteMember } = useDeleteMember();

  const [ConfirmDialog, confirm] = useConfirm(
    "Leave Workspace",
    "Are you sure you want to leave this workspace? You will need an invite to rejoin.",
    "destructive"
  );

  const onSelect = (id: string) => {
    router.push(`/workspaces/${id}`);
  };

  const handleWorkspaceClick = (id: string) => {
    router.push(`/workspaces/${id}`);
  };

  const handleLeaveWorkspace = async () => {
    if (!member) return;

    const ok = await confirm();
    if (!ok) return;

    deleteMember(
      { param: { memberId: member.$id } },
      {
        onSuccess: () => {
          window.location.href = "/";
        },
      }
    );
  };

  const handleCreateWorkspace = () => {
    if (canCreateWorkspace) {
      open();
    }
  };

  return (
    <TooltipProvider>
      <div id="workspace-switcher" className="flex flex-col px-3 pt-3 pb-4 border-t border-sidebar-border">
        <ConfirmDialog />

        {/* Organization indicator for ORG accounts with refresh */}
        {/* {hasOrg && currentOrg && (
          <div className="flex items-center justify-between px-2 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span className="truncate font-medium">{(currentOrg as { name: string }).name}</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={refresh}
                  disabled={isRefreshing}
                >
                  <RefreshCcw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh data</TooltipContent>
            </Tooltip>
          </div>
        )} */}

        <div className="flex items-center justify-between pb-4">
          <p className="text-[13px] tracking-normal font-medium  pl-2 text-sidebar-foreground/80">Workspaces</p>

          {/* Only show dropdown if user can create workspace OR has options */}
          {(canCreateWorkspace || (member && workspaces && workspaces.documents.length > 1)) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-5 p-0 hover:bg-transparent">
                  <RiAddCircleFill className="size-5 text-sidebar-foreground/70 cursor-pointer hover:text-sidebar-foreground transition" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {/* Create Workspace - only for OWNER/ADMIN */}
                {canCreateWorkspace && (
                  <DropdownMenuItem onClick={handleCreateWorkspace} className="cursor-pointer">
                    <Plus className="size-4 mr-2" />
                    Create Workspace
                  </DropdownMenuItem>
                )}
                {member && workspaces && workspaces.documents.length > 1 && (
                  <>
                    {canCreateWorkspace && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={handleLeaveWorkspace}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <LogOut className="size-4 mr-2" />
                      Leave Workspace
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <Select onValueChange={onSelect} value={selectedWorkspaceId}>

          <SelectTrigger className="w-full p-2 font-medium text-xs bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground/90">
            <SelectValue placeholder="No workspace selected." />
          </SelectTrigger>

          <SelectContent>
            {workspaces?.documents.map((workspace) => (
              <SelectItem
                key={workspace.$id}
                value={workspace.$id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  handleWorkspaceClick(workspace.$id);
                }}
              >
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
    </TooltipProvider>
  );
};

