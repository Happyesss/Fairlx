"use client";

import { Fragment, useState } from "react";
import {
  MoreVerticalIcon,
  CopyIcon,
  Shield,
  Trash2,
  Crown,
  Mail,
  Facebook,
  Twitter,
  Linkedin,
  Link as LinkIcon,
  CheckCircle2,
  Star,
  Loader2,
  UserPlus,
  Share2,
  Building2
} from "lucide-react";
import { toast } from "sonner";

import { MemberAvatar } from "@/features/members/components/member-avatar";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useDeleteMember } from "@/features/members/api/use-delete-member";
import { useUpdateMember } from "@/features/members/api/use-update-member";
import { useAddWorkspaceMemberFromOrg } from "@/features/members/api/use-add-workspace-member-from-org";
import { MemberRole } from "@/features/members/types";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useResetInviteCode } from "@/features/workspaces/api/use-reset-invite-code";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { useGetSpaces } from "@/features/spaces/api/use-get-spaces";
import { useAddSpaceMember } from "@/features/spaces/api/use-add-space-member";
import { useGetRoles } from "@/features/roles/api/use-get-roles";
import { useGetOrgMembers } from "@/features/organizations/api/use-get-org-members";
import { SpaceRole } from "@/features/spaces/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomRole } from "@/features/roles/types";
import { useCurrentUserOrgPermissions } from "@/features/org-permissions/api/use-current-user-permissions";
import { OrgPermissionKey } from "@/features/org-permissions/types";

import { useConfirm } from "@/hooks/use-confirm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const MembersList = () => {
  const workspaceId = useWorkspaceId();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [spaceMasterDialogOpen, setSpaceMasterDialogOpen] = useState(false);
  const [selectedMemberForMaster, setSelectedMemberForMaster] = useState<{ id: string; name: string } | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>("");
  const [ConfirmDialog, confirm] = useConfirm(
    "Remove member",
    "This member will be removed from the workspace.",
    "destructive"
  );
  const [ResetDialog, confirmReset] = useConfirm(
    "Reset Invite Link",
    "This will invalidate the current invite link",
    "destructive"
  );

  const { data } = useGetMembers({ workspaceId });
  const { data: workspace } = useGetWorkspace({ workspaceId });
  const { data: spacesData } = useGetSpaces({ workspaceId });
  const { data: customRoles } = useGetRoles({ workspaceId });
  const { member: currentMember, isAdmin: isCurrentUserAdmin } = useCurrentMember({ workspaceId });
  const { mutate: deleteMember, isPending: isDeletingMember } = useDeleteMember();
  const { mutate: updateMember, isPending: isUpdatingMember } = useUpdateMember();
  const { mutate: resetInviteCode, isPending: isResettingInviteCode } = useResetInviteCode();
  const { mutate: addSpaceMember, isPending: isAddingSpaceMember } = useAddSpaceMember();
  const { mutate: addFromOrg, isPending: isAddingFromOrg } = useAddWorkspaceMemberFromOrg();

  // Org members for explicit assignment
  const { data: orgMembersData } = useGetOrgMembers({
    organizationId: workspace?.organizationId || ""
  });

  // State for Add from Org dialog
  const [addFromOrgDialogOpen, setAddFromOrgDialogOpen] = useState(false);
  const [selectedOrgUserId, setSelectedOrgUserId] = useState<string>("");
  const [selectedNewMemberRole, setSelectedNewMemberRole] = useState<MemberRole>(MemberRole.MEMBER);

  // Check org-level WORKSPACE_ASSIGN permission for Add from Org button
  const { hasPermission: hasOrgPermission } = useCurrentUserOrgPermissions({
    orgId: workspace?.organizationId || ""
  });
  const canAssignToWorkspace = hasOrgPermission(OrgPermissionKey.WORKSPACE_ASSIGN);

  const handleUpdateMember = (memberId: string, role: MemberRole | string) => {
    updateMember({ json: { role }, param: { memberId } });
  };

  const handleDeleteMember = async (memberId: string) => {
    const ok = await confirm();

    if (!ok) return;

    deleteMember(
      { param: { memberId } },
      {
        onSuccess: () => {
          window.location.reload();
        },
      }
    );
  };

  const handleResetInviteCode = async () => {
    const ok = await confirmReset();

    if (!ok) return;

    resetInviteCode({ param: { workspaceId } });
  };

  const handleOpenSpaceMasterDialog = (memberId: string, memberName: string) => {
    setSelectedMemberForMaster({ id: memberId, name: memberName });
    setSelectedSpaceId("");
    setSpaceMasterDialogOpen(true);
  };

  const handleSetAsMaster = () => {
    if (!selectedMemberForMaster || !selectedSpaceId) return;

    addSpaceMember(
      {
        param: { spaceId: selectedSpaceId },
        json: { memberId: selectedMemberForMaster.id, role: SpaceRole.ADMIN },
      },
      {
        onSuccess: () => {
          setSpaceMasterDialogOpen(false);
          setSelectedMemberForMaster(null);
          setSelectedSpaceId("");
        },
      }
    );
  };

  // Handler for adding org member to workspace
  const handleAddFromOrg = () => {
    if (!selectedOrgUserId) return;

    addFromOrg(
      {
        workspaceId,
        userId: selectedOrgUserId,
        role: selectedNewMemberRole,
      },
      {
        onSuccess: () => {
          setAddFromOrgDialogOpen(false);
          setSelectedOrgUserId("");
          setSelectedNewMemberRole(MemberRole.MEMBER);
        },
      }
    );
  };

  // Filter org members - exclude those already in workspace
  const existingMemberUserIds = data?.documents.map((m) => m.userId) || [];
  const availableOrgMembers = orgMembersData?.documents.filter(
    (om) => !existingMemberUserIds.includes(om.userId)
  ) || [];

  const fullInviteLink = workspace
    ? `${window.location.origin}/workspaces/${workspaceId}/join/${workspace.inviteCode}`
    : "";

  const handleCopyInviteLink = () => {
    navigator.clipboard
      .writeText(fullInviteLink)
      .then(() => toast.success("Invite link copied to clipboard."));
  };

  const handleShareViaEmail = () => {
    const subject = `Join ${workspace?.name || 'our workspace'} on Scrumpty`;
    const body = `You've been invited to join ${workspace?.name || 'our workspace'}!\n\nClick the link below to accept the invitation:\n${fullInviteLink}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleShareViaFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullInviteLink)}`, '_blank');
  };

  const handleShareViaTwitter = () => {
    const text = `Join me on ${workspace?.name || 'Scrumpty'}!`;
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(fullInviteLink)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareViaLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(fullInviteLink)}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <ConfirmDialog />
      <ResetDialog />

      {/* Space Master Dialog */}
      <Dialog open={spaceMasterDialogOpen} onOpenChange={setSpaceMasterDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="size-5 text-purple-600" />
              Set as Space Master
            </DialogTitle>
            <DialogDescription>
              Assign <span className="font-medium">{selectedMemberForMaster?.name}</span> as a master of a space. Space masters have full control over space settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Space</label>
              <Select value={selectedSpaceId} onValueChange={setSelectedSpaceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a space..." />
                </SelectTrigger>
                <SelectContent>
                  {spacesData?.documents?.map((space) => (
                    <SelectItem key={space.$id} value={space.$id}>
                      <div className="flex items-center gap-2">
                        {space.color && (
                          <div
                            className="size-3 rounded-full"
                            style={{ backgroundColor: space.color }}
                          />
                        )}
                        <span>{space.name}</span>
                        <span className="text-xs text-muted-foreground">({space.key})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {spacesData?.documents?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No spaces available. Create a space first.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSpaceMasterDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSetAsMaster}
              disabled={!selectedSpaceId || isAddingSpaceMember}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {isAddingSpaceMember && <Loader2 className="size-4 animate-spin" />}
              Set as Master
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add from Organization Dialog */}
      {workspace?.organizationId && (
        <Dialog open={addFromOrgDialogOpen} onOpenChange={setAddFromOrgDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="size-5 text-blue-600" />
                Add from Organization
              </DialogTitle>
              <DialogDescription>
                Add an organization member directly to this workspace
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Member</label>
                <Select value={selectedOrgUserId} onValueChange={setSelectedOrgUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an organization member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOrgMembers.map((om) => (
                      <SelectItem key={om.userId} value={om.userId}>
                        <div className="flex items-center gap-2">
                          <span>{om.name || om.email}</span>
                          <span className="text-xs text-muted-foreground">({om.role})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Workspace Role</label>
                <Select
                  value={selectedNewMemberRole}
                  onValueChange={(v) => setSelectedNewMemberRole(v as MemberRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MemberRole.ADMIN}>Admin</SelectItem>
                    <SelectItem value={MemberRole.MEMBER}>Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {availableOrgMembers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  All organization members are already in this workspace
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddFromOrgDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddFromOrg}
                disabled={!selectedOrgUserId || isAddingFromOrg}
                className="gap-2"
              >
                {isAddingFromOrg && <Loader2 className="size-4 animate-spin" />}
                Add Member
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-3">


          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Workspace Members</h1>
            <p className="text-sm mt-0.5 mb-4 text-muted-foreground">Manage workspace members and permissions</p>
          </div>
        </div>
        {isCurrentUserAdmin && (
          <div className="flex gap-2">
            {/* ORG workspaces: Only show "Add from Org" if user has WORKSPACE_ASSIGN permission */}
            {workspace?.organizationId && canAssignToWorkspace && (
              <>
                <Button
                  size="xs"
                  // Default variant is now primary (blue)
                  className="gap-1.5"
                  onClick={() => setAddFromOrgDialogOpen(true)}
                >
                  <Building2 className="size-4" />
                  Add from Org
                </Button>
                <p className="text-xs text-muted-foreground self-center">
                  Members are added by admins
                </p>
              </>
            )}
            {/* ORG workspaces without WORKSPACE_ASSIGN permission: Just show info text */}
            {workspace?.organizationId && !canAssignToWorkspace && (
              <p className="text-xs text-muted-foreground self-center">
                Members are added by admins with permission
              </p>
            )}
            {/* PERSONAL workspaces: Show invite dialog */}
            {!workspace?.organizationId && (
              <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="xs" className="gap-1.5">
                    <UserPlus className="size-4" />
                    Invite Members
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Share2 className="size-5 text-primary" />
                      Share Workspace Invitation
                    </DialogTitle>
                    <DialogDescription>
                      Share this workspace invitation link through your preferred platform
                    </DialogDescription>
                  </DialogHeader>
                  <Tabs defaultValue="link" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-9">
                      <TabsTrigger value="link" className="text-xs">Copy Link</TabsTrigger>
                      <TabsTrigger value="social" className="text-xs">Social Media</TabsTrigger>
                    </TabsList>
                    <TabsContent value="link" className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium">Invitation Link</label>
                        <div className="flex gap-2">
                          <Input value={fullInviteLink} readOnly className="font-mono text-xs h-9" />
                          <Button onClick={handleCopyInviteLink} size="sm" variant="secondary" className="shrink-0">
                            <CopyIcon className="size-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                        <CheckCircle2 className="size-4 text-green-600 mt-0.5 shrink-0" />
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium">Share this link with anyone</p>
                          <p className="text-xs text-muted-foreground">
                            Anyone with this link can join your workspace
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="social" className="space-y-2 pt-4">
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-11"
                        onClick={handleShareViaEmail}
                      >
                        <div className="p-1.5 rounded-md bg-red-500/10">
                          <Mail className="size-4 text-red-600" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium">Email</p>
                          <p className="text-xs text-muted-foreground">Share via email client</p>
                        </div>
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-11"
                        onClick={handleShareViaFacebook}
                      >
                        <div className="p-1.5 rounded-md bg-blue-600/10">
                          <Facebook className="size-4 text-blue-600" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium">Facebook</p>
                          <p className="text-xs text-muted-foreground">Share on Facebook</p>
                        </div>
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-11"
                        onClick={handleShareViaTwitter}
                      >
                        <div className="p-1.5 rounded-md bg-sky-500/10">
                          <Twitter className="size-4 text-sky-500" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium">Twitter / X</p>
                          <p className="text-xs text-muted-foreground">Share on Twitter</p>
                        </div>
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-11"
                        onClick={handleShareViaLinkedIn}
                      >
                        <div className="p-1.5 rounded-md bg-blue-700/10">
                          <Linkedin className="size-4 text-blue-700" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium">LinkedIn</p>
                          <p className="text-xs text-muted-foreground">Share on LinkedIn</p>
                        </div>
                      </Button>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )
        }
      </div >

      {/* Members List Section */}
      < Card className="border shadow-sm" >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Team Members</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data?.documents.length || 0} member{data?.documents.length !== 1 ? 's' : ''} in this workspace
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data?.documents.map((member) => {
              const displayName = member.name?.trim() || member.email || "Unknown member";
              const displayEmail = member.email || "Unknown email";
              const isAdmin = member.role === MemberRole.ADMIN;
              const isCurrentUser = currentMember?.$id === member.$id;

              return (
                <Fragment key={member.$id}>
                  <div className="p-3 rounded-lg border hover:border-primary/30 hover:bg-accent/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <MemberAvatar
                          className="size-9"
                          fallbackClassName="text-sm"
                          name={displayName}
                          imageUrl={member.profileImageUrl}
                          tooltipText={displayName}
                        />
                        {isAdmin && (
                          <div className="absolute -bottom-0.5 -right-0.5 bg-amber-500 rounded-full p-0.5 border-2 border-background">
                            <Crown className="size-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium truncate">{displayName}</p>
                          {isAdmin && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-xs px-1.5 py-0 rounded-full">
                              <Crown className="size-2.5 mr-1" />
                              Admin
                            </Badge>
                          )}
                          {!isAdmin && member.role !== MemberRole.MEMBER && (
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-500/20 text-xs px-1.5 py-0 rounded-full">
                              <Shield className="size-2.5 mr-1" />
                              {member.role}
                            </Badge>
                          )}
                          {isCurrentUser && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20 text-xs px-1.5 py-0 rounded-full">
                              You
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
                      </div>
                      {isCurrentUserAdmin && !isCurrentUser && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8 shrink-0">
                              <MoreVerticalIcon className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="bottom" align="end" className="w-52">
                            <DropdownMenuLabel className="text-xs">Manage Member</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {!isAdmin && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateMember(member.$id, MemberRole.ADMIN)}
                                disabled={isUpdatingMember}
                                className="cursor-pointer text-xs"
                              >
                                <Crown className="size-3.5 mr-2 text-amber-600" />
                                <span>Set as Administrator</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs text-muted-foreground py-1">Custom Roles</DropdownMenuLabel>
                            {customRoles?.documents.map((role) => {
                              const customRole = role as unknown as CustomRole;
                              return (
                                <DropdownMenuItem
                                  key={customRole.$id}
                                  onClick={() => handleUpdateMember(member.$id, customRole.name)}
                                  disabled={isUpdatingMember}
                                  className="cursor-pointer text-xs"
                                >
                                  <Shield className="size-3.5 mr-2 text-purple-600" />
                                  <span>Set as {customRole.name}</span>
                                </DropdownMenuItem>
                              )
                            })}
                            {(!customRoles?.documents || customRoles.documents.length === 0) && (
                              <div className="text-xs text-muted-foreground px-2 py-1.5">No custom roles</div>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleOpenSpaceMasterDialog(member.$id, displayName)}
                              className="cursor-pointer text-xs"
                            >
                              <Star className="size-3.5 mr-2 text-purple-600" />
                              <span>Set as Space Master</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteMember(member.$id)}
                              disabled={isDeletingMember}
                              className="cursor-pointer text-xs text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-3.5 mr-2" />
                              <span>Remove Member</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {!isCurrentUserAdmin && isCurrentUser && data?.documents.length > 1 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8 shrink-0">
                              <MoreVerticalIcon className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="bottom" align="end" className="w-52">
                            <DropdownMenuItem
                              onClick={() => handleDeleteMember(member.$id)}
                              disabled={isDeletingMember}
                              className="cursor-pointer text-xs text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-3.5 mr-2" />
                              <span>Leave Workspace</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {!isCurrentUserAdmin && isCurrentUser && data?.documents.length === 1 && (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          <Shield className="size-2.5 mr-1" />
                          Your Profile
                        </Badge>
                      )}
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card >

      {/* Quick Invite Section - PERSONAL workspaces only */}
      {/* ORG workspaces use admin-controlled assignment via "Add from Org" */}
      {
        isCurrentUserAdmin && !workspace?.organizationId && (
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <LinkIcon className="size-4" />
                    Quick Invite
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Share your workspace with team members via link
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Input
                      value={fullInviteLink}
                      readOnly
                      className="font-mono text-xs h-9 bg-background"
                    />
                  </div>
                  <Button
                    onClick={handleCopyInviteLink}
                    variant="secondary"
                    size="xs"
                    className="shrink-0 gap-1.5"
                  >
                    <CopyIcon className="size-3" />
                    Copy Link
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t">
                <div>
                  <p className="text-sm font-medium">Security Settings</p>
                  <p className="text-xs text-muted-foreground">
                    Reset your invite link to invalidate the current one
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={handleResetInviteCode}
                  disabled={isResettingInviteCode}
                  className="gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                >
                  <Shield className="size-3.5" />
                  Reset Link
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      }
    </div >
  );
};
