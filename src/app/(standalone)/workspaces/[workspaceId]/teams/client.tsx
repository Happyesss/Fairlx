"use client";

import { Plus, MoreVertical, Pencil, Trash2, Users2, Shield, Search, Filter, Grid3x3, List, Users, Layers, Crown } from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { useGetTeamProjects } from "@/features/teams/api/use-get-team-projects";
import { useDeleteTeam } from "@/features/teams/api/use-delete-team";
import { useCreateTeamModal } from "@/features/teams/hooks/use-create-team-modal";
import { useEditTeamModal } from "@/features/teams/hooks/use-edit-team-modal";
import { useTeamId } from "@/features/teams/hooks/use-team-id";
import { CreateTeamModal } from "@/features/teams/components/create-team-modal";
import { EditTeamModal } from "@/features/teams/components/edit-team-modal";
import { useConfirm } from "@/hooks/use-confirm";
import { TeamVisibility, TeamMemberRole } from "@/features/teams/types";
import { useGetTeamMembers } from "@/features/teams/api/use-get-team-members";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { cn } from "@/lib/utils";

const getVisibilityColor = (visibility: TeamVisibility) => {
  switch (visibility) {
    case TeamVisibility.ALL:
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
    case TeamVisibility.PROGRAM_ONLY:
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
    case TeamVisibility.TEAM_ONLY:
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20";
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
    <div className="w-full h-full flex flex-col">
      <DeleteDialog />
      <CreateTeamModal />
      <EditTeamModal />

      {/* Header with Stats */}
      <div className="space-y-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Teams
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Manage your workspace teams and collaborate effectively
            </p>
          </div>
          {isAdmin && (
            <Button onClick={openCreate} size="default" className="gap-2 !bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700">
              <Plus className="size-4" />
              Create Team
            </Button>
          )}
        </div>

        {/* Statistics Cards */}
        {!isLoading && teams && teams.documents.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Teams</p>
                    <p className="text-2xl font-bold mt-1">{stats.total}</p>
                  </div>
                  <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Users2 className="size-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">All Members</p>
                    <p className="text-2xl font-bold mt-1">{stats.all}</p>
                  </div>
                  <div className="size-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Users className="size-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Program Only</p>
                    <p className="text-2xl font-bold mt-1">{stats.program}</p>
                  </div>
                  <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Layers className="size-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-950/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Team Only</p>
                    <p className="text-2xl font-bold mt-1">{stats.teamOnly}</p>
                  </div>
                  <div className="size-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Shield className="size-5 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        {!isLoading && teams && teams.documents.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="size-4 mr-2" />
                <SelectValue placeholder="Filter by visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Visibility</SelectItem>
                <SelectItem value={TeamVisibility.ALL}>All Members</SelectItem>
                <SelectItem value={TeamVisibility.PROGRAM_ONLY}>Program Only</SelectItem>
                <SelectItem value={TeamVisibility.TEAM_ONLY}>Team Only</SelectItem>
              </SelectContent>
            </Select>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "list")} className="w-full sm:w-auto">
              <TabsList>
                <TabsTrigger value="grid" className="gap-2">
                  <Grid3x3 className="size-4" />
                  Grid
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-2">
                  <List className="size-4" />
                  List
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}
      </div>

      {/* Content */}
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
                  <div className="size-14 rounded-xl bg-muted" />
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
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="size-20 rounded-2xl bg-gradient-to-br from-blue-100 to-violet-100 dark:from-blue-950 dark:to-violet-950 flex items-center justify-center mb-4">
              <Users2 className="size-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No teams yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6 text-sm">
              Create your first team to start organizing your workspace and collaborating with members effectively
            </p>
            {isAdmin && (
              <Button onClick={openCreate} className="gap-2 !bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700">
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
          "grid gap-4",
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
                className="group hover:shadow-lg transition-all duration-300 overflow-hidden border-border/40 hover:border-border hover:scale-[1.02] cursor-pointer"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="relative">
                        <Avatar className="size-14 rounded-xl border-2 border-background shadow-md">
                          {team.imageUrl ? (
                            <AvatarImage src={team.imageUrl} alt={team.name} />
                          ) : (
                            <AvatarFallback className="rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white font-bold text-lg">
                              {team.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-background border-2 border-background flex items-center justify-center">
                          <Users2 className="size-3 text-blue-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <h3 className="font-semibold text-base truncate">
                          {team.name}
                        </h3>
                        <Badge className={cn("text-xs font-medium border", getVisibilityColor(team.visibility))}>
                          <VisibilityIcon className="size-3 mr-1" />
                          {getVisibilityLabel(team.visibility)}
                        </Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 -mt-1 -mr-2 hover:bg-muted"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
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
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                          >
                            <Trash2 className="size-4 mr-2" />
                            Delete Team
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="pb-4">
                  <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                    {team.description || "No description provided"}
                  </p>
                </CardContent>

                <CardFooter className="pt-4 border-t bg-gradient-to-br from-muted/30 to-transparent">
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
                className="group hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <Avatar className="size-16 rounded-xl border-2 border-background shadow-md">
                        {team.imageUrl ? (
                          <AvatarImage src={team.imageUrl} alt={team.name} />
                        ) : (
                          <AvatarFallback className="rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white font-bold text-xl">
                            {team.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg truncate">{team.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {team.description || "No description provided"}
                          </p>
                        </div>
                        <Badge className={cn("text-xs font-medium border shrink-0", getVisibilityColor(team.visibility))}>
                          <VisibilityIcon className="size-3 mr-1" />
                          {getVisibilityLabel(team.visibility)}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/workspaces/${workspaceId}/teams/${team.$id}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Shield className="size-4" />
                          View Space
                        </Button>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-9">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
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
                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
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
        <Users className="size-3" />
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
