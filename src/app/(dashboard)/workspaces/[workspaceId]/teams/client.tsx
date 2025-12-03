"use client";

import { Plus, MoreVertical, Pencil, Trash2, Users2, Shield, Search, Filter, Grid3x3, List, Users, Layers, Crown, Info } from "lucide-react";
import { useState, useMemo, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useRouter } from "next/navigation";
import { useGetTeams } from "@/features/teams/api/use-get-teams";
import { useDeleteTeam } from "@/features/teams/api/use-delete-team";
import { useCreateTeamModal } from "@/features/teams/hooks/use-create-team-modal";
import { useEditTeamModal } from "@/features/teams/hooks/use-edit-team-modal";
import { useTeamId } from "@/features/teams/hooks/use-team-id";
import { CreateTeamModal } from "@/features/teams/components/create-team-modal";
import { EditTeamModal } from "@/features/teams/components/edit-team-modal";
import { useConfirm } from "@/hooks/use-confirm";
import { TeamVisibility, TeamMemberRole } from "@/features/teams/types";
import { cn } from "@/lib/utils";
import { useGetTeamMembers } from "@/features/teams/api/use-get-team-members";
import { useGetTeamProjects } from "@/features/teams/api/use-get-team-projects";
import { FirstTeamInfoDialog } from "@/features/teams/components/first-team-info-dialog";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const getVisibilityColor = (visibility: TeamVisibility) => {
  switch (visibility) {
    case TeamVisibility.ALL:
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
    case TeamVisibility.PROGRAM_ONLY:
      return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
    case TeamVisibility.TEAM_ONLY:
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
    default:
      return "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20";
  }
};

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

const getVisibilityIcon = (visibility: TeamVisibility) => {
  switch (visibility) {
    case TeamVisibility.ALL:
      return Users;
    case TeamVisibility.PROGRAM_ONLY:
      return Layers;
    case TeamVisibility.TEAM_ONLY:
      return Shield;
    default:
      return Shield;
  }
};

export const TeamsClient = () => {
  const workspaceId = useWorkspaceId();
  const router = useRouter();
  const { data: teams, isLoading } = useGetTeams({ workspaceId });
  const { open: openCreate } = useCreateTeamModal();
  const { open: openEdit } = useEditTeamModal();
  const [, setTeamId] = useTeamId();
  const { mutate: deleteTeam } = useDeleteTeam();
  const { isAdmin } = useCurrentMember({ workspaceId });

  const [searchQuery, setSearchQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFirstTeamInfo, setShowFirstTeamInfo] = useState(false);
  const [previousTeamCount, setPreviousTeamCount] = useState<number | null>(null);

  // Show first team info dialog when user creates their first team OR when there are no teams
  useEffect(() => {
    if (teams?.documents) {
      const currentCount = teams.documents.length;

      // Show modal if there are no teams
      if (currentCount === 0) {
        setShowFirstTeamInfo(true);
      }
      // Check if we just went from 0 to 1 team (first team created)
      else if (previousTeamCount === 0 && currentCount === 1) {
        const hasSeenFirstTeamInfo = localStorage.getItem('hasSeenFirstTeamInfo');
        if (!hasSeenFirstTeamInfo) {
          setShowFirstTeamInfo(true);
          localStorage.setItem('hasSeenFirstTeamInfo', 'true');
        }
      }

      setPreviousTeamCount(currentCount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams?.documents?.length, previousTeamCount]);

  const [DeleteDialog, confirmDelete] = useConfirm(
    "Delete Team",
    "This action cannot be undone. All team members will be removed from the team.",
    "destructive"
  );

  // Filter and search teams
  const filteredTeams = useMemo(() => {
    if (!teams?.documents) return [];

    return teams.documents.filter((team) => {
      const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        team.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesVisibility = visibilityFilter === "all" || team.visibility === visibilityFilter;

      return matchesSearch && matchesVisibility;
    });
  }, [teams, searchQuery, visibilityFilter]);

  // Team statistics
  const stats = useMemo(() => {
    if (!teams?.documents) return { total: 0, all: 0, program: 0, teamOnly: 0 };

    return {
      total: teams.documents.length,
      all: teams.documents.filter(t => t.visibility === TeamVisibility.ALL).length,
      program: teams.documents.filter(t => t.visibility === TeamVisibility.PROGRAM_ONLY).length,
      teamOnly: teams.documents.filter(t => t.visibility === TeamVisibility.TEAM_ONLY).length,
    };
  }, [teams]);

  const handleEdit = (teamId: string) => {
    setTeamId(teamId);
    openEdit();
  };

  const handleDelete = async (teamId: string) => {
    const ok = await confirmDelete();
    if (!ok) return;

    deleteTeam({ param: { teamId } });
  };

  return (
    <div className="w-full h-full flex flex-col p-4">
      <DeleteDialog />
      <CreateTeamModal />
      <EditTeamModal />
      <FirstTeamInfoDialog
        open={showFirstTeamInfo}
        onOpenChange={setShowFirstTeamInfo}
      />

      {/* Compact Header */}
      <div className="space-y-4 mb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="size-5 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                      onClick={() => setShowFirstTeamInfo(true)}
                    >
                      <Info className="size-3 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-xs">
                      <strong>Team-based Project Assignment:</strong> Workspace admins can assign projects to specific teams.
                      Teams will only see their assigned projects. Click to learn more.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage your workspace teams and collaborate effectively
            </p>
          </div>
          {isAdmin && (
            <Button onClick={openCreate} size="sm" className="gap-1.5 h-9">
              <Plus className="size-3.5" />
              Create Team
            </Button>
          )}
        </div>

        {/* Compact Statistics Cards */}
        {!isLoading && teams && teams.documents.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Users2 className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Teams</p>
                    <p className="text-xl font-bold">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Users className="size-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">All Members</p>
                    <p className="text-xl font-bold">{stats.all}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Layers className="size-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Program Only</p>
                    <p className="text-xl font-bold">{stats.program}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Shield className="size-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Team Only</p>
                    <p className="text-xl font-bold">{stats.teamOnly}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Compact Search and Filters */}
        {!isLoading && teams && teams.documents.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm">
                <Filter className="size-3.5 mr-1.5" />
                <SelectValue placeholder="All Visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Visibility</SelectItem>
                <SelectItem value={TeamVisibility.ALL}>All Members</SelectItem>
                <SelectItem value={TeamVisibility.PROGRAM_ONLY}>Program Only</SelectItem>
                <SelectItem value={TeamVisibility.TEAM_ONLY}>Team Only</SelectItem>
              </SelectContent>
            </Select>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "list")} className="w-full sm:w-auto">
              <TabsList className="h-9">
                <TabsTrigger value="grid" className="gap-1.5 h-7 text-xs">
                  <Grid3x3 className="size-3.5" />
                  Grid
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-1.5 h-7 text-xs">
                  <List className="size-3.5" />
                  List
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className={cn(
          "grid gap-4",
          viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
        )}>
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="size-12 rounded-lg bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded w-5/6" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTeams.length === 0 && teams?.documents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users2 className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No teams yet</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              Create your first team to start organizing your workspace and collaborating with members
            </p>
            {isAdmin && (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="size-4" />
                Create Your First Team
              </Button>
            )}
          </CardContent>
        </Card>
      ) : filteredTeams.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No teams found</h3>
            <p className="text-muted-foreground text-center max-w-sm text-sm">
              Try adjusting your search or filters to find what you&apos;re looking for
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={cn(
          "grid gap-3",
          viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
        )}>
          {filteredTeams.map((team) => {
            const VisibilityIcon = getVisibilityIcon(team.visibility);

            return viewMode === "grid" ? (
              <Card
                key={team.$id}
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/workspaces/${workspaceId}/teams/${team.$id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/workspaces/${workspaceId}/teams/${team.$id}`);
                  }
                }}
                className="group hover:shadow-md transition-all duration-200 overflow-hidden border-border/40 hover:border-border cursor-pointer"
              >
                <CardHeader className="pb-3 px-4 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <Avatar className="size-10 rounded-lg border shrink-0">
                        {team.imageUrl ? (
                          <AvatarImage src={team.imageUrl} alt={team.name} />
                        ) : (
                          <AvatarFallback className="rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-white text-sm font-semibold">
                            {team.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate mb-1">
                          {team.name}
                        </h3>
                        <Badge className={cn("text-[10px] font-normal h-5", getVisibilityColor(team.visibility))}>
                          <VisibilityIcon className="size-2.5 mr-1" />
                          {getVisibilityLabel(team.visibility)}
                        </Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {isAdmin && (
                          <DropdownMenuItem onClick={() => handleEdit(team.$id)} className="text-xs">
                            <Pencil className="size-3.5 mr-2" />
                            Edit Team
                          </DropdownMenuItem>
                        )}
                        {isAdmin && <DropdownMenuSeparator />}
                        {isAdmin && (
                          <DropdownMenuItem
                            onClick={() => handleDelete(team.$id)}
                            className="text-destructive focus:text-destructive text-xs"
                          >
                            <Trash2 className="size-3.5 mr-2" />
                            Delete Team
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="pb-3 px-4">
                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                    {team.description || "No description provided"}
                  </p>
                </CardContent>

                <CardFooter className="pt-3 px-4 pb-3 border-t bg-muted/5">
                  <div className="flex items-center justify-between w-full">
                    <TeamProjectName teamId={team.$id} />
                    <TeamMemberAvatarsFooter teamId={team.$id} memberCount={team.memberCount || 0} />
                  </div>
                </CardFooter>
              </Card>
            ) : (
              // List View
              <Card
                key={team.$id}
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/workspaces/${workspaceId}/teams/${team.$id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/workspaces/${workspaceId}/teams/${team.$id}`);
                  }
                }}
                className="group hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer"
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="size-16 rounded-lg border flex-shrink-0">
                      {team.imageUrl ? (
                        <AvatarImage src={team.imageUrl} alt={team.name} />
                      ) : (
                        <AvatarFallback className="rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-white font-bold text-xl">
                          {team.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg truncate">{team.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {team.description || "No description provided"}
                          </p>
                        </div>
                        <Badge className={cn("text-xs font-normal shrink-0", getVisibilityColor(team.visibility))}>
                          <VisibilityIcon className="size-3 mr-1" />
                          {getVisibilityLabel(team.visibility)}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/workspaces/${workspaceId}/teams/${team.$id}`);
                        }}
                      >
                        <Shield className="size-4" />
                        View Space
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-9" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {isAdmin && (
                            <DropdownMenuItem onClick={() => handleEdit(team.$id)}>
                              <Pencil className="size-4 mr-2" />
                              Edit Team
                            </DropdownMenuItem>
                          )}
                          {isAdmin && <DropdownMenuSeparator />}
                          {isAdmin && (
                            <DropdownMenuItem
                              onClick={() => handleDelete(team.$id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-4 mr-2" />
                              Delete Team
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Component to show team project name in footer
interface TeamProjectNameProps {
  teamId: string;
}

const TeamProjectName = ({ teamId }: TeamProjectNameProps) => {
  const { data: projectsData, isLoading } = useGetTeamProjects({ teamId });
  const projects = (projectsData as { documents: { $id: string; name: string; imageUrl?: string }[]; total: number } | undefined)?.documents || [];

  if (isLoading) {
    return (
      <div className="h-4 w-20 bg-muted animate-pulse rounded" />
    );
  }

  if (projects.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">No projects</span>
    );
  }

  const firstProject = projects[0];
  const additionalCount = projects.length - 1;

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs font-medium text-foreground truncate max-w-[100px]">
        {firstProject.name}
      </span>
      {additionalCount > 0 && (
        <span className="text-xs text-muted-foreground">
          +{additionalCount}
        </span>
      )}
    </div>
  );
};

// Component to show team member avatars in footer with lead info on hover
interface TeamMemberAvatarsFooterProps {
  teamId: string;
  memberCount: number;
}

const TeamMemberAvatarsFooter = ({ teamId, memberCount }: TeamMemberAvatarsFooterProps) => {
  const { data: teamMembersData, isLoading } = useGetTeamMembers({ teamId });
  const members = teamMembersData?.documents || [];

  // Sort members: team lead first, then others
  const sortedMembers = [...members].sort((a, b) => {
    if (a.role === TeamMemberRole.LEAD) return -1;
    if (b.role === TeamMemberRole.LEAD) return 1;
    return 0;
  });

  const displayMembers = sortedMembers.slice(0, 3);
  const actualCount = members.length || memberCount;
  const remainingCount = actualCount - displayMembers.length;

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex -space-x-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="size-7 rounded-full bg-muted animate-pulse border-2 border-background" />
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="size-3 " />
        <span>No members</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex -space-x-2">
        {displayMembers.map((member) => {
          const isLead = member.role === TeamMemberRole.LEAD;

          return (
            <Tooltip key={member.$id}>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Avatar className="size-7 border-2 border-background ring-1 ring-border/50 hover:ring-2 hover:ring-primary transition-all cursor-pointer">
                    {member.user?.profileImageUrl ? (
                      <AvatarImage src={member.user.profileImageUrl} alt={member.user?.name || 'Member'} />
                    ) : (
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-[10px] font-semibold">
                        {member.user?.name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase() || "?"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  {isLead && (
                    <div className="absolute -top-0.5 -right-0.5 bg-amber-500 rounded-full p-0.5">
                      <Crown className="size-2 text-white" />
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div className="space-y-0.5">
                  <p className="font-semibold">{member.user?.name || 'Unknown'}</p>
                  <p className="text-muted-foreground">{member.user?.email || 'No email'}</p>
                  {isLead && (
                    <p className="text-amber-500 font-medium">Team Lead</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
        {remainingCount > 0 && (
          <div className="size-7 rounded-full bg-muted border-2 border-background flex items-center justify-center">
            <span className="text-[10px] font-semibold text-muted-foreground">
              +{remainingCount}
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
