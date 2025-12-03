"use client";

import { Plus, MoreVertical, Pencil, Trash2, FolderKanban, Calendar, ArrowRight, Search, Filter, Grid3x3, List, TrendingUp, Target, Clock } from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useGetPrograms } from "@/features/programs/api/use-get-programs";
import { useDeleteProgram } from "@/features/programs/api/use-delete-program";
import { useCreateProgramModal } from "@/features/programs/hooks/use-create-program-modal";
import { useEditProgramModal } from "@/features/programs/hooks/use-edit-program-modal";
import { useProgramId } from "@/features/programs/hooks/use-program-id";
import { CreateProgramModal } from "@/features/programs/components/create-program-modal";
import { EditProgramModal } from "@/features/programs/components/edit-program-modal";
import { ProgramStatus } from "@/features/programs/types";
import { useConfirm } from "@/hooks/use-confirm";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { cn } from "@/lib/utils";

const getStatusColor = (status: ProgramStatus) => {
  switch (status) {
    case ProgramStatus.ACTIVE:
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
    case ProgramStatus.PLANNING:
      return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
    case ProgramStatus.ON_HOLD:
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
    case ProgramStatus.COMPLETED:
      return "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20";
    case ProgramStatus.CANCELLED:
      return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
    default:
      return "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20";
  }
};

const getStatusIcon = (status: ProgramStatus) => {
  switch (status) {
    case ProgramStatus.ACTIVE:
      return TrendingUp;
    case ProgramStatus.PLANNING:
      return Target;
    case ProgramStatus.ON_HOLD:
      return Clock;
    case ProgramStatus.COMPLETED:
      return Target;
    case ProgramStatus.CANCELLED:
      return Target;
    default:
      return Target;
  }
};

const getStatusLabel = (status: ProgramStatus) => {
  return status.replace(/_/g, " ");
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const ProgramsClient = () => {
  const workspaceId = useWorkspaceId();
  const { data: programs, isLoading } = useGetPrograms({ workspaceId });
  const { open: openCreate } = useCreateProgramModal();
  const { open: openEdit } = useEditProgramModal();
  const [, setProgramId] = useProgramId();
  const { mutate: deleteProgram } = useDeleteProgram();
  const { isAdmin } = useCurrentMember({ workspaceId });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [DeleteDialog, confirmDelete] = useConfirm(
    "Delete Program",
    "This action cannot be undone. All teams associated with this program will be unlinked.",
    "destructive"
  );

  // Filter and search programs
  const filteredPrograms = useMemo(() => {
    if (!programs?.documents) return [];

    return programs.documents.filter((program) => {
      const matchesSearch = program.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        program.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || program.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [programs, searchQuery, statusFilter]);

  // Program statistics
  const stats = useMemo(() => {
    if (!programs?.documents) return { total: 0, active: 0, planning: 0, completed: 0 };

    return {
      total: programs.documents.length,
      active: programs.documents.filter(p => p.status === ProgramStatus.ACTIVE).length,
      planning: programs.documents.filter(p => p.status === ProgramStatus.PLANNING).length,
      completed: programs.documents.filter(p => p.status === ProgramStatus.COMPLETED).length,
    };
  }, [programs]);

  const handleEdit = (programId: string) => {
    setProgramId(programId);
    openEdit();
  };

  const handleDelete = async (programId: string) => {
    const ok = await confirmDelete();
    if (!ok) return;

    deleteProgram({ param: { programId } });
  };

  return (
    <div className="w-full h-full flex flex-col p-6">
      <DeleteDialog />
      <CreateProgramModal />
      <EditProgramModal />

      {/* Header with Stats */}
      <div className="space-y-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Programs</h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Strategic initiatives that drive your organization forward
            </p>
          </div>
          {isAdmin && (!isLoading && programs && programs.documents.length > 0) && (
            <Button onClick={openCreate} size="default" className="gap-2">
              <Plus className="size-4" />
              Create Program
            </Button>
          )}
        </div>

        {/* Statistics Cards */}
        {!isLoading && programs && programs.documents.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Programs</p>
                    <p className="text-2xl font-bold mt-1">{stats.total}</p>
                  </div>
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                    <FolderKanban className="size-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold mt-1">{stats.active}</p>
                  </div>
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                    <TrendingUp className="size-5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Planning</p>
                    <p className="text-2xl font-bold mt-1">{stats.planning}</p>
                  </div>
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                    <Target className="size-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Completed</p>
                    <p className="text-2xl font-bold mt-1">{stats.completed}</p>
                  </div>
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                    <Target className="size-5 text-slate-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        {!isLoading && programs && programs.documents.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search programs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="size-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value={ProgramStatus.ACTIVE}>Active</SelectItem>
                <SelectItem value={ProgramStatus.PLANNING}>Planning</SelectItem>
                <SelectItem value={ProgramStatus.ON_HOLD}>On Hold</SelectItem>
                <SelectItem value={ProgramStatus.COMPLETED}>Completed</SelectItem>
                <SelectItem value={ProgramStatus.CANCELLED}>Cancelled</SelectItem>
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
      ) : filteredPrograms.length === 0 && programs?.documents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FolderKanban className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No programs yet</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              Create your first program to organize strategic initiatives across your workspace
            </p>
            {isAdmin && (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="size-4" />
                Create Your First Program
              </Button>
            )}
          </CardContent>
        </Card>
      ) : filteredPrograms.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No programs found</h3>
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
          {filteredPrograms.map((program) => {
            const StatusIcon = getStatusIcon(program.status);

            return viewMode === "grid" ? (
              <Card
                key={program.$id}
                className="group hover:shadow-md transition-all duration-200 overflow-hidden border-border/40 hover:border-border"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Avatar className="size-12 rounded-lg border">
                        {program.imageUrl ? (
                          <AvatarImage src={program.imageUrl} alt={program.name} />
                        ) : (
                          <AvatarFallback className="rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 text-white font-semibold">
                            {program.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1 min-w-0 space-y-1">
                        <h3 className="font-semibold text-base truncate">
                          {program.name}
                        </h3>
                        <Badge className={cn("text-xs font-normal", getStatusColor(program.status))}>
                          <StatusIcon className="size-3 mr-1" />
                          {getStatusLabel(program.status)}
                        </Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-2"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {isAdmin && (
                          <DropdownMenuItem onClick={() => handleEdit(program.$id)}>
                            <Pencil className="size-4 mr-2" />
                            Edit Program
                          </DropdownMenuItem>
                        )}
                        {isAdmin && <DropdownMenuSeparator />}
                        {isAdmin && (
                          <DropdownMenuItem
                            onClick={() => handleDelete(program.$id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-4 mr-2" />
                            Delete Program
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="pb-4">
                  <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                    {program.description || "No description provided"}
                  </p>
                  {(program.startDate || program.endDate) && (
                    <div className="mt-4 pt-4 border-t space-y-2">
                      {program.startDate && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="size-3.5" />
                          <span className="font-medium">Start:</span>
                          <span>{formatDate(program.startDate)}</span>
                        </div>
                      )}
                      {program.endDate && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="size-3.5" />
                          <span className="font-medium">End:</span>
                          <span>{formatDate(program.endDate)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-4 border-t bg-muted/5">
                  <Link
                    href={`/workspaces/${workspaceId}/programs/${program.$id}`}
                    className="flex items-center justify-between w-full group/link"
                  >
                    <span className="text-sm text-muted-foreground">View program details</span>
                    <ArrowRight className="size-4 text-muted-foreground group-hover/link:translate-x-1 transition-transform" />
                  </Link>
                </CardFooter>
              </Card>
            ) : (
              // List View
              <Card
                key={program.$id}
                className="group hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="size-16 rounded-lg border flex-shrink-0">
                      {program.imageUrl ? (
                        <AvatarImage src={program.imageUrl} alt={program.name} />
                      ) : (
                        <AvatarFallback className="rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 text-white font-bold text-xl">
                          {program.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg truncate">{program.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {program.description || "No description provided"}
                          </p>
                        </div>
                        <Badge className={cn("text-xs font-normal shrink-0", getStatusColor(program.status))}>
                          <StatusIcon className="size-3 mr-1" />
                          {getStatusLabel(program.status)}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {program.startDate && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="size-3.5" />
                            <span>{formatDate(program.startDate)}</span>
                          </div>
                        )}
                        {program.endDate && (
                          <>
                            <span>→</span>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="size-3.5" />
                              <span>{formatDate(program.endDate)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/workspaces/${workspaceId}/programs/${program.$id}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          View Details
                          <ArrowRight className="size-4" />
                        </Button>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-9">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {isAdmin && (
                            <DropdownMenuItem onClick={() => handleEdit(program.$id)}>
                              <Pencil className="size-4 mr-2" />
                              Edit Program
                            </DropdownMenuItem>
                          )}
                          {isAdmin && <DropdownMenuSeparator />}
                          {isAdmin && (
                            <DropdownMenuItem
                              onClick={() => handleDelete(program.$id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-4 mr-2" />
                              Delete Program
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
