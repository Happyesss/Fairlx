"use client";

import { Fragment, useState } from "react";
import {
  ArrowLeft,
  MoreVerticalIcon,
  CopyIcon,
  Shield,
  UserCog,
  Trash2,
  Crown,
  Mail,
  Facebook,
  Twitter,
  Linkedin,
  Link as LinkIcon,
  Send,
  Users,
  CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { MemberAvatar } from "@/features/members/components/member-avatar";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useDeleteMember } from "@/features/members/api/use-delete-member";
import { useUpdateMember } from "@/features/members/api/use-update-member";
import { MemberRole } from "@/features/members/types";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useResetInviteCode } from "@/features/workspaces/api/use-reset-invite-code";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";

import { useConfirm } from "@/hooks/use-confirm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DottedSeparator } from "@/components/dotted-separator";
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
  const { member: currentMember, isAdmin: isCurrentUserAdmin } = useCurrentMember({ workspaceId });
  const { mutate: deleteMember, isPending: isDeletingMember } = useDeleteMember();
  const { mutate: updateMember, isPending: isUpdatingMember } = useUpdateMember();
  const { mutate: resetInviteCode, isPending: isResettingInviteCode } = useResetInviteCode();

  const handleUpdateMember = (memberId: string, role: MemberRole) => {
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

  const adminCount = data?.documents.filter(m => m.role === MemberRole.ADMIN).length || 0;
  const memberCount = data?.documents.filter(m => m.role === MemberRole.MEMBER).length || 0;

  return (
    <div className="space-y-4">
      <ConfirmDialog />
      <ResetDialog />

      {/* Header Section */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-gray-100">
          <Link href={`/workspaces/${workspaceId}`}>
            <ArrowLeft className="size-4 text-gray-600" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Members List</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage workspace members and permissions</p>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold">{data?.documents.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Crown className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Administrators</p>
                <p className="text-2xl font-bold">{adminCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Shield className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Members</p>
                <p className="text-2xl font-bold">{memberCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members List Section */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Team Members</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data?.documents.length || 0} member{data?.documents.length !== 1 ? 's' : ''} in this workspace
          </p>
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
                  <div className="p-3 rounded-lg border hover:border-primary/50 hover:bg-accent/50 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <MemberAvatar
                          className="size-10"
                          fallbackClassName="text-base"
                          name={displayName}
                          imageUrl={member.profileImageUrl}
                          tooltipText={displayName}
                        />
                        {isAdmin && (
                          <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-1 border-2 border-background">
                            <Crown className="size-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold truncate">{displayName}</p>
                          {isAdmin && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20 font-medium">
                              <Crown className="size-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                          {isCurrentUser && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20 text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
                      </div>
                      {isCurrentUserAdmin && !isCurrentUser && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-9 shrink-0">
                              <MoreVerticalIcon className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="bottom" align="end" className="w-56">
                            <DropdownMenuLabel>Manage Member</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {!isAdmin && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateMember(member.$id, MemberRole.ADMIN)}
                                disabled={isUpdatingMember}
                                className="cursor-pointer"
                              >
                                <Crown className="size-4 mr-2 text-amber-600" />
                                <span>Set as Administrator</span>
                              </DropdownMenuItem>
                            )}
                            {isAdmin && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateMember(member.$id, MemberRole.MEMBER)}
                                disabled={isUpdatingMember}
                                className="cursor-pointer"
                              >
                                <UserCog className="size-4 mr-2 text-blue-600" />
                                <span>Set as Member</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteMember(member.$id)}
                              disabled={isDeletingMember}
                              className="cursor-pointer text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-4 mr-2" />
                              <span>Remove Member</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {!isCurrentUserAdmin && isCurrentUser && (
                        <Badge variant="secondary" className="shrink-0">
                          <Shield className="size-3 mr-1" />
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
      </Card>

      {/* Invite Members Section */}
      {isCurrentUserAdmin && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base">Invite Members</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Share your workspace with team members via link or social media
                </p>
              </div>
              <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Send className="size-4" />
                    Share via Social
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Share Workspace Invitation</DialogTitle>
                    <DialogDescription>
                      Share this workspace invitation link through your preferred platform
                    </DialogDescription>
                  </DialogHeader>
                  <Tabs defaultValue="social" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="social">Social Media</TabsTrigger>
                      <TabsTrigger value="link">Copy Link</TabsTrigger>
                    </TabsList>
                    <TabsContent value="social" className="space-y-3 pt-4">
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-12"
                        onClick={handleShareViaEmail}
                      >
                        <div className="p-2 rounded-md bg-red-500/10">
                          <Mail className="size-4 text-red-600" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium">Email</p>
                          <p className="text-xs text-muted-foreground">Share via email client</p>
                        </div>
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-12"
                        onClick={handleShareViaFacebook}
                      >
                        <div className="p-2 rounded-md bg-blue-600/10">
                          <Facebook className="size-4 text-blue-600" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium">Facebook</p>
                          <p className="text-xs text-muted-foreground">Share on Facebook</p>
                        </div>
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-12"
                        onClick={handleShareViaTwitter}
                      >
                        <div className="p-2 rounded-md bg-sky-500/10">
                          <Twitter className="size-4 text-sky-500" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium">Twitter / X</p>
                          <p className="text-xs text-muted-foreground">Share on Twitter</p>
                        </div>
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-12"
                        onClick={handleShareViaLinkedIn}
                      >
                        <div className="p-2 rounded-md bg-blue-700/10">
                          <Linkedin className="size-4 text-blue-700" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium">LinkedIn</p>
                          <p className="text-xs text-muted-foreground">Share on LinkedIn</p>
                        </div>
                      </Button>
                    </TabsContent>
                    <TabsContent value="link" className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Invitation Link</label>
                        <div className="flex gap-2">
                          <Input value={fullInviteLink} readOnly className="font-mono text-xs" />
                          <Button onClick={handleCopyInviteLink} size="icon" variant="outline">
                            <CopyIcon className="size-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                        <CheckCircle2 className="size-4 text-green-600 mt-0.5 shrink-0" />
                        <div className="space-y-1">
                          <p className="text-xs font-medium">Share this link with anyone</p>
                          <p className="text-xs text-muted-foreground">
                            Anyone with this link can join your workspace
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg border-2 border-dashed bg-accent/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <LinkIcon className="size-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium mb-1">Quick Invite Link</p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={fullInviteLink}
                      readOnly
                      className="font-mono text-xs h-9"
                    />
                    <Button
                      onClick={handleCopyInviteLink}
                      variant="secondary"
                      size="sm"
                      className="shrink-0 gap-2"
                    >
                      <CopyIcon className="size-4" />
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {isCurrentUserAdmin && (
              <>
                <DottedSeparator />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
                  <div>
                    <p className="text-sm font-medium">Security Settings</p>
                    <p className="text-xs text-muted-foreground">
                      Reset your invite link to invalidate the current one
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleResetInviteCode}
                    disabled={isResettingInviteCode}
                    className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    <Shield className="size-4" />
                    Reset Link
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
