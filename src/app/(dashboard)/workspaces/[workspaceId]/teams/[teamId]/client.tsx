"use client";

import { useState } from "react";
import { Users, Settings, Shield, UserPlus, MoreVertical, Crown, Trash2, ArrowLeft, Eye, Info, Briefcase, Plus, FolderKanban } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetTeam } from "@/features/teams/api/use-get-team";
import { useGetTeamMembers } from "@/features/teams/api/use-get-team-members";
import { useGetTeamProjects } from "@/features/teams/api/use-get-team-projects";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useAssignProjectToTeam } from "@/features/projects/api/use-assign-project-to-team";
import { useUnassignProjectFromTeam } from "@/features/projects/api/use-unassign-project-from-team";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { useRemoveTeamMember } from "@/features/teams/api/use-remove-team-member";
import { useUpdateTeamMember } from "@/features/teams/api/use-update-team-member";
import { useGetCustomRoles } from "@/features/teams/api/use-get-custom-roles";
import { useCreateCustomRole } from "@/features/teams/api/use-create-custom-role";
import { useUpdateCustomRole } from "@/features/teams/api/use-update-custom-role";
import { useDeleteCustomRole } from "@/features/teams/api/use-delete-custom-role";
import { PageLoader } from "@/components/page-loader";
import { PageError } from "@/components/page-error";
import { useConfirm } from "@/hooks/use-confirm";
import { useCurrentTeamMember } from "@/features/teams/hooks/use-current-team-member";
import { TeamMemberRole, TeamVisibility, PERMISSION_CATEGORIES, CustomRole, DEFAULT_ROLE_PERMISSIONS } from "@/features/teams/types";
import { AddMemberModal } from "@/features/teams/components/add-member-modal";
import { TeamSettingsModal } from "@/features/teams/components/team-settings-modal";
import { getRoleDisplay } from "@/features/teams/hooks/use-team-permissions";

const getVisibilityLabel = (visibility: TeamVisibility) => {
  switch (visibility) {
    case TeamVisibility.ALL:
      return "All Members";
    case TeamVisibility.PROGRAM_ONLY:
      return "Program Only";
    case TeamVisibility.TEAM_ONLY:
      return "Team Only";
    default:
      return visibility;
  }
};

interface TeamIdClientProps {
  teamId: string;
}

export const TeamIdClient = ({ teamId }: TeamIdClientProps) => {
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAssignProjectOpen, setIsAssignProjectOpen] = useState(false);
  const [selectedRoleForView, setSelectedRoleForView] = useState<{ type: 'builtin' | 'custom', role: TeamMemberRole | CustomRole } | null>(null);

  const { data: team, isLoading: isLoadingTeam } = useGetTeam({ teamId });
  const { data: teamMembersData, isLoading: isLoadingMembers } = useGetTeamMembers({ teamId });
  const { data: customRolesData } = useGetCustomRoles({ teamId });
  const { data: teamProjectsData, isLoading: isLoadingProjects } = useGetTeamProjects({ teamId });
  const { data: allProjectsData } = useGetProjects({ workspaceId });
  const { mutate: assignProject } = useAssignProjectToTeam();
  const { mutate: unassignProject } = useUnassignProjectFromTeam();
  const { mutate: removeTeamMember } = useRemoveTeamMember();
  const { mutate: updateTeamMember } = useUpdateTeamMember();
  const { mutate: createCustomRole } = useCreateCustomRole();
  const { mutate: updateCustomRole } = useUpdateCustomRole();
  const { mutate: deleteCustomRole } = useDeleteCustomRole();

  const customRoles = (customRolesData?.data?.documents || []) as CustomRole[];

  const [ConfirmDialog, confirm] = useConfirm(
    "Remove Member",
    "Are you sure you want to remove this member from the team?",
    "destructive"
  );

  const isLoading = isLoadingTeam || isLoadingMembers;
  const members = teamMembersData?.documents || [];

  // Get team-specific permissions for current user
  const teamPermissions = useCurrentTeamMember({ teamId });
  const canEditSettings = teamPermissions.canEditSettings ?? false;
  const canAddMembers = teamPermissions.canAddMembers ?? false;
  const canChangeRoles = teamPermissions.canChangeRoles ?? false;
  const canRemoveMembers = teamPermissions.canRemoveMembers ?? false;

  const handleAddMember = () => {
    setIsAddMemberOpen(true);
  };

  const handleRemoveMember = async (memberId: string) => {
    const ok = await confirm();
    if (!ok) return;

    removeTeamMember({
      param: { teamId, memberId },
    });
  };

  const handleChangeRole = (memberId: string, newRole: TeamMemberRole) => {
    updateTeamMember({
      param: { teamId, memberId },
      json: { role: newRole },
    });
  };

  if (isLoading) {
    return <PageLoader />;
  }

  if (!team) {
    return <PageError message="Team not found" />;
  }

  return (
    <div className="h-full flex flex-col">
      <ConfirmDialog />
      <AddMemberModal
        open={isAddMemberOpen}
        onOpenChange={setIsAddMemberOpen}
        teamId={teamId}
      />
      <TeamSettingsModal
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        team={team}
        customRoles={customRoles}
        onCreateRole={(role) =>
          createCustomRole({
            param: { teamId },
            json: {
              teamId: role.teamId,
              name: role.name,
              permissions: role.permissions,
              description: role.description,
              color: role.color,
              isDefault: role.isDefault,
            }
          })
        }
        onUpdateRole={(roleId, role) =>
          updateCustomRole({ param: { teamId, roleId }, json: role })
        }
        onDeleteRole={(roleId) =>
          deleteCustomRole({ param: { teamId, roleId } })
        }
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => router.push(`/workspaces/${workspaceId}/teams`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2.5">
            <Avatar className="size-12 rounded-lg border-2 border-border">
              {team.imageUrl ? (
                <AvatarImage src={team.imageUrl} alt={team.name} />
              ) : (
                <AvatarFallback className="rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-white text-lg font-semibold">
                  {team.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold leading-none">{team.name}</h1>
                <Badge variant="outline" className="gap-1 text-xs">
                  <Eye className="h-3 w-3" />
                  {getVisibilityLabel(team.visibility)}
                </Badge>
              </div>
              {team.description && (
                <p className="text-sm text-muted-foreground mt-1">{team.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {team.memberCount || 0} {team.memberCount === 1 ? 'member' : 'members'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEditSettings && (
            <>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setIsAssignProjectOpen(true)}
              >
                <Briefcase className="h-4 w-4" />
                Assign Project
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setIsSettingsOpen(true)}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Assigned Projects Section */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Briefcase className="size-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Assigned Projects</h2>
          </div>
        </div>

        {isLoadingProjects ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2.5">
                    <div className="size-10 rounded-lg bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          (() => {
            const assignedProjects = teamProjectsData?.documents || [];

            return assignedProjects.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <FolderKanban className="size-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-semibold mb-1.5">No Projects Assigned</h3>
                  <p className="text-muted-foreground text-center max-w-sm mb-3 text-sm">
                    Assign projects to this team so members can collaborate
                  </p>
                  <Button onClick={() => setIsAssignProjectOpen(true)} size="sm" className="gap-1.5">
                    <Plus className="size-3.5" />
                    Assign Project
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {assignedProjects.map((project) => (
                  <Card
                    key={project.$id}
                    className="group hover:shadow-md transition-all duration-200 cursor-pointer border-border/50 hover:border-border"
                    onClick={() => router.push(`/workspaces/${workspaceId}/projects/${project.$id}`)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2.5">
                        <ProjectAvatar
                          name={project.name}
                          image={project.imageUrl}
                          className="size-10 rounded-lg shrink-0"
                          fallbackClassName="text-sm"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate mb-0.5 group-hover:text-primary transition-colors">
                            {project.name}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {project.description || "No description"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            unassignProject({
                              param: { projectId: project.$id, teamId },
                            });
                          }}
                        >
                          <Trash2 className="size-3 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })()
        )}
      </div>

      {/* Members Section */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Team Members</h2>
          </div>
          {canAddMembers && (
            <Button onClick={handleAddMember} size="sm" className="gap-1.5 h-8 text-xs">
              <UserPlus className="size-3.5" />
              Add Member
            </Button>
          )}
        </div>

        <Card className="flex-1">
          <CardContent className="p-4">
            {members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-3 mb-3">
                  <Users className="size-6 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold mb-1">No members yet</h3>
                <p className="text-xs text-muted-foreground mb-3 max-w-[280px]">
                  Add members to this team to start collaborating
                </p>
                {canAddMembers && (
                  <Button onClick={handleAddMember} size="sm" className="gap-1.5 h-8 text-xs">
                    <UserPlus className="size-3.5" />
                    Add First Member
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-0">
                {members.map((member, index) => (
                  <div key={member.$id}>
                    {index > 0 && <Separator className="my-2" />}
                    <div className="flex items-center justify-between py-2 group hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <Avatar className="size-8 shrink-0">
                          {member.user?.profileImageUrl ? (
                            <AvatarImage src={member.user.profileImageUrl} alt={member.user.name} />
                          ) : (
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-xs font-semibold">
                              {member.user?.name
                                ?.split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase() || "?"}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">{member.user?.name || "Unknown"}</p>
                            {member.role === TeamMemberRole.LEAD ? (
                              <Badge
                                variant="default"
                                className="gap-1 text-[10px] h-4 px-1.5 shrink-0 cursor-pointer hover:opacity-80"
                                onClick={() => setSelectedRoleForView({ type: 'builtin', role: TeamMemberRole.LEAD })}
                              >
                                <Crown className="size-2.5" />
                                Lead
                              </Badge>
                            ) : member.role === TeamMemberRole.CUSTOM && member.customRoleId ? (
                              (() => {
                                const roleDisplay = getRoleDisplay(member.role, member.customRoleId, customRoles);
                                const customRole = customRoles.find((r) => r.$id === member.customRoleId);
                                return (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] h-4 px-1.5 shrink-0 cursor-pointer hover:bg-muted"
                                    onClick={() => customRole && setSelectedRoleForView({ type: 'custom', role: customRole })}
                                  >
                                    {roleDisplay.name}
                                  </Badge>
                                );
                              })()
                            ) : member.role === TeamMemberRole.MEMBER ? (
                              <Badge
                                variant="secondary"
                                className="text-[10px] h-4 px-1.5 shrink-0 cursor-pointer hover:bg-muted"
                                onClick={() => setSelectedRoleForView({ type: 'builtin', role: TeamMemberRole.MEMBER })}
                              >
                                Member
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {member.user?.email || "No email"}
                          </p>
                        </div>
                      </div>
                      {(canChangeRoles || canRemoveMembers) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {canChangeRoles && (
                              <>
                                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                  Change Role
                                </DropdownMenuLabel>
                                <DropdownMenuGroup>
                                  <DropdownMenuItem
                                    onClick={() => handleChangeRole(member.memberId, TeamMemberRole.LEAD)}
                                    disabled={member.role === TeamMemberRole.LEAD}
                                    className="text-xs"
                                  >
                                    <Shield className="size-3.5 mr-2" />
                                    Team Lead
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-5 ml-auto"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedRoleForView({ type: 'builtin', role: TeamMemberRole.LEAD });
                                      }}
                                    >
                                      <Info className="size-3" />
                                    </Button>
                                    {member.role === TeamMemberRole.LEAD && (
                                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                        Current
                                      </Badge>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleChangeRole(member.memberId, TeamMemberRole.MEMBER)}
                                    disabled={member.role === TeamMemberRole.MEMBER}
                                    className="text-xs"
                                  >
                                    <Users className="size-3.5 mr-2" />
                                    Team Member
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-5 ml-auto"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedRoleForView({ type: 'builtin', role: TeamMemberRole.MEMBER });
                                      }}
                                    >
                                      <Info className="size-3" />
                                    </Button>
                                    {member.role === TeamMemberRole.MEMBER && (
                                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                        Current
                                      </Badge>
                                    )}
                                  </DropdownMenuItem>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                {customRoles.length > 0 && (
                                  <>
                                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                      Custom Roles
                                    </DropdownMenuLabel>
                                    <DropdownMenuGroup>
                                      {customRoles.map((role: CustomRole) => (
                                        <DropdownMenuItem
                                          key={role.$id}
                                          onClick={() => {
                                            updateTeamMember({
                                              param: { teamId, memberId: member.memberId },
                                              json: { role: TeamMemberRole.CUSTOM, customRoleId: role.$id },
                                            });
                                          }}
                                          disabled={member.role === TeamMemberRole.CUSTOM && member.customRoleId === role.$id}
                                          className="text-xs"
                                        >
                                          <Shield className="size-3.5 mr-2" />
                                          {role.name}
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-5 ml-auto"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedRoleForView({ type: 'custom', role });
                                            }}
                                          >
                                            <Info className="size-3" />
                                          </Button>
                                          {member.role === TeamMemberRole.CUSTOM && member.customRoleId === role.$id && (
                                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                              Current
                                            </Badge>
                                          )}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuGroup>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                              </>
                            )}
                            {canRemoveMembers && (
                              <DropdownMenuItem
                                onClick={() => handleRemoveMember(member.memberId)}
                                className="text-destructive focus:text-destructive text-xs"
                              >
                                <Trash2 className="size-3.5 mr-2" />
                                Remove from Team
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assign Project Modal */}
      <Dialog open={isAssignProjectOpen} onOpenChange={setIsAssignProjectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="size-5" />
              Assign Project to Team
            </DialogTitle>
            <DialogDescription>
              Select a project to assign to {team.name}. Team members will be able to view and collaborate on assigned projects.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(() => {
              const allProjects = allProjectsData?.documents || [];
              const assignedProjects = teamProjectsData?.documents || [];
              const assignedProjectIds = assignedProjects.map((p) => p.$id);
              const availableProjects = allProjects.filter(
                (project) => !assignedProjectIds.includes(project.$id)
              );

              if (availableProjects.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <FolderKanban className="size-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      All workspace projects are already assigned to this team.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {availableProjects.map((project) => (
                    <Card
                      key={project.$id}
                      className="group cursor-pointer hover:bg-muted/50 transition-colors border-border/50 hover:border-border"
                      onClick={() => {
                        assignProject(
                          {
                            param: { projectId: project.$id, teamId },
                          },
                          {
                            onSuccess: () => {
                              setIsAssignProjectOpen(false);
                            },
                          }
                        );
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <ProjectAvatar
                            name={project.name}
                            image={project.imageUrl}
                            className="size-10 rounded-lg shrink-0"
                            fallbackClassName="text-sm"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                              {project.name}
                            </h4>
                            <p className="text-xs text-muted-foreground truncate">
                              {project.description || "No description"}
                            </p>
                          </div>
                          <Plus className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Permissions Dialog */}
      <Dialog open={!!selectedRoleForView} onOpenChange={() => setSelectedRoleForView(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="size-5" />
              {selectedRoleForView?.type === 'builtin'
                ? selectedRoleForView.role === TeamMemberRole.LEAD
                  ? 'Team Lead Permissions'
                  : 'Team Member Permissions'
                : (selectedRoleForView?.role as CustomRole)?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedRoleForView?.type === 'builtin'
                ? selectedRoleForView.role === TeamMemberRole.LEAD
                  ? 'Full access to all team features and settings'
                  : 'Basic permissions for viewing and creating tasks'
                : (selectedRoleForView?.role as CustomRole)?.description || 'Custom role with specific permissions'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {selectedRoleForView && (() => {
              const permissions = selectedRoleForView.type === 'builtin'
                ? DEFAULT_ROLE_PERMISSIONS[selectedRoleForView.role as TeamMemberRole]
                : (selectedRoleForView.role as CustomRole).permissions;

              return Object.entries(PERMISSION_CATEGORIES).map(([key, category]) => {
                const cat = category as typeof PERMISSION_CATEGORIES[keyof typeof PERMISSION_CATEGORIES];
                const categoryPermissions = cat.permissions.filter((p) =>
                  permissions.includes(p.key)
                );

                if (categoryPermissions.length === 0) return null;

                return (
                  <Card key={key}>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <Shield className="size-4" />
                        {cat.label}
                      </h3>
                      <div className="space-y-2">
                        {categoryPermissions.map((permission) => (
                          <div
                            key={permission.key}
                            className="flex items-start gap-2 p-2 rounded bg-muted/50"
                          >
                            <div className="flex-1">
                              <div className="text-sm font-medium">{permission.label}</div>
                              <p className="text-xs text-muted-foreground">
                                {permission.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              });
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
