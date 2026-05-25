"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Users2,
  Pencil,
  TrendingUp,
  Target,
  Clock,
  FolderKanban,
  BarChart3,
  Flag,
  LayoutDashboard,
  Settings,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, differenceInDays, isPast } from "date-fns";

import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useGetProgram } from "@/features/programs/api/use-get-program";
import { useGetProgramSummary } from "@/features/programs/api/use-get-program-summary";
import { useProgramIdParam } from "@/features/programs/hooks/use-program-id-param";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useEditProgramModal } from "@/features/programs/hooks/use-edit-program-modal";
import { useDeleteProgram } from "@/features/programs/api/use-delete-program";
import { EditProgramModal } from "@/features/programs/components/edit-program-modal";
import { ProgramProjectsList } from "@/features/programs/components/program-projects-list";
import { ProgramMembersTable } from "@/features/programs/components/program-members-table";
import { ProgramMilestones } from "@/features/programs/components/program-milestones";
import { ProgramAnalyticsDashboard } from "@/features/programs/components/program-analytics-dashboard";
import { ProgramStatus, ProgramPriority } from "@/features/programs/types";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { useConfirm } from "@/hooks/use-confirm";
import { cn } from "@/lib/utils";

/* ─── Config ──────────────────────────────────────────────────────── */
const STATUS_CFG: Record<ProgramStatus, { label: string; color: string; dot: string; icon: typeof TrendingUp }> = {
  [ProgramStatus.ACTIVE]: { label: "Active", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20", dot: "bg-emerald-500", icon: TrendingUp },
  [ProgramStatus.PLANNING]: { label: "Planning", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20", dot: "bg-blue-500", icon: Target },
  [ProgramStatus.ON_HOLD]: { label: "On Hold", color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20", dot: "bg-amber-500", icon: Clock },
  [ProgramStatus.COMPLETED]: { label: "Completed", color: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20", dot: "bg-slate-400", icon: CheckCircle2 },
  [ProgramStatus.CANCELLED]: { label: "Cancelled", color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20", dot: "bg-red-500", icon: AlertTriangle },
};

const PRIORITY_CFG: Record<ProgramPriority, { label: string; color: string; bg: string }> = {
  [ProgramPriority.LOW]: { label: "Low", color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800" },
  [ProgramPriority.MEDIUM]: { label: "Medium", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/30" },
  [ProgramPriority.HIGH]: { label: "High", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/30" },
  [ProgramPriority.CRITICAL]: { label: "Critical", color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/30" },
};

/* ─── Component ───────────────────────────────────────────────────── */
export const ProgramIdClient = () => {
  const programId = useProgramIdParam();
  const workspaceId = useWorkspaceId();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: program, isLoading } = useGetProgram({ programId });
  const { data: summary } = useGetProgramSummary({ programId });
  const { open: openEdit } = useEditProgramModal();
  const { mutate: deleteProgram, isPending: isDeleting } = useDeleteProgram();
  const { isAdmin } = useCurrentMember({ workspaceId });

  const [DeleteDialog, confirmDelete] = useConfirm(
    "Delete Program",
    "This will permanently delete this program and unlink all projects. This cannot be undone.",
    "destructive"
  );

  const handleDelete = async () => {
    const ok = await confirmDelete();
    if (!ok) return;
    deleteProgram({ param: { programId } }, { onSuccess: () => router.push(`/workspaces/${workspaceId}/programs`) });
  };

  if (isLoading) return <PageLoader />;
  if (!program) return <PageError message="Program not found." />;

  const st = STATUS_CFG[program.status as ProgramStatus] || STATUS_CFG[ProgramStatus.PLANNING];
  const pr = program.priority ? PRIORITY_CFG[program.priority as ProgramPriority] : null;
  const canManage = isAdmin;
  const progress = (program as { progress?: number }).progress ?? 0;
  const projCount = summary?.data?.projectCount ?? (program as { projectCount?: number }).projectCount ?? 0;
  const memCount = summary?.data?.memberCount ?? (program as { memberCount?: number }).memberCount ?? 0;
  const msCount = summary?.data?.milestoneCount ?? 0;
  const msDone = summary?.data?.completedMilestoneCount ?? 0;

  // Time calculations
  const getTimeLabel = () => {
    if (!program.endDate) return null;
    const end = new Date(program.endDate);
    if (program.status === ProgramStatus.COMPLETED) return { text: "Completed", variant: "success" as const };
    if (isPast(end)) return { text: `${differenceInDays(new Date(), end)}d overdue`, variant: "danger" as const };
    const days = differenceInDays(end, new Date());
    if (days <= 7) return { text: `${days}d left`, variant: "warning" as const };
    return { text: `${days}d left`, variant: "neutral" as const };
  };
  const timeLabel = getTimeLabel();

  return (
    <div className="h-full flex flex-col">
      <DeleteDialog />
      <EditProgramModal />

      {/* ─── Sticky Header ──────────────────────────────────────── */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sticky top-0 z-10">
        <div className="px-3 py-3 sm:px-6 sm:py-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
            <Link href={`/workspaces/${workspaceId}/programs`} className="hover:text-foreground transition-colors flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Programs
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium truncate">{program.name}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            {/* Left: Identity */}
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div
                className="flex items-center justify-center h-14 w-14 rounded-xl shrink-0 border shadow-sm"
                style={{
                  backgroundColor: program.color ? `${program.color}12` : undefined,
                  borderColor: program.color ? `${program.color}30` : undefined,
                }}
              >
                {program.imageUrl ? (
                  <Avatar className="h-14 w-14 rounded-xl">
                    <AvatarImage src={program.imageUrl} alt={program.name} />
                    <AvatarFallback className="rounded-xl text-lg font-bold">{program.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                ) : (
                  <FolderKanban className="h-7 w-7" style={{ color: program.color || "hsl(var(--primary))" }} />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold truncate">{program.name}</h1>
                  <Badge variant="outline" className={cn("text-xs font-medium", st.color)}>
                    <div className={cn("h-1.5 w-1.5 rounded-full mr-1.5", st.dot)} />
                    {st.label}
                  </Badge>
                  {pr && (
                    <Badge variant="outline" className={cn("text-xs", pr.color, pr.bg)}>
                      {pr.label}
                    </Badge>
                  )}
                  {timeLabel && (
                    <Badge variant="outline" className={cn("text-xs",
                      timeLabel.variant === "danger" && "text-red-600 bg-red-50 border-red-200 dark:bg-red-500/10 dark:text-red-400",
                      timeLabel.variant === "warning" && "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400",
                      timeLabel.variant === "success" && "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400",
                      timeLabel.variant === "neutral" && "text-muted-foreground",
                    )}>
                      <Clock className="h-3 w-3 mr-1" />
                      {timeLabel.text}
                    </Badge>
                  )}
                </div>

                {program.description && (
                  <p className="text-sm text-muted-foreground line-clamp-1 max-w-2xl">{program.description}</p>
                )}

                {/* Meta row */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {program.programLead && (
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5">
                              {program.programLead.profileImageUrl && <AvatarImage src={program.programLead.profileImageUrl} />}
                              <AvatarFallback className="text-[9px]">{program.programLead.name?.[0]?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span>{program.programLead.name}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Program Lead</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {(program.startDate || program.endDate) && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {program.startDate && format(new Date(program.startDate), "MMM d, yyyy")}
                      {program.startDate && program.endDate && " → "}
                      {program.endDate && format(new Date(program.endDate), "MMM d, yyyy")}
                    </div>
                  )}
                  {program.budget && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      {program.budget.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {canManage && (
                <>
                  <Button variant="outline" size="sm" onClick={() => openEdit(programId)} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/workspaces/${workspaceId}/programs/${programId}/settings`}>
                          <Settings className="h-4 w-4 mr-2" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive" disabled={isDeleting}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>

          {/* KPI Strip */}
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t">
            <KpiItem label="Progress" value={`${progress}%`} extra={<Progress value={progress} className="h-1.5 w-20 mt-1" />} />
            <Separator orientation="vertical" className="h-8" />
            <KpiItem label="Projects" value={projCount} icon={FolderKanban} />
            <Separator orientation="vertical" className="h-8" />
            <KpiItem label="Members" value={memCount} icon={Users2} />
            <Separator orientation="vertical" className="h-8" />
            <KpiItem label="Milestones" value={`${msDone}/${msCount}`} icon={Flag} />
          </div>
        </div>
      </div>

      {/* ─── Tabs ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="px-3 pt-4 pb-8 sm:px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-transparent border-b rounded-none w-full justify-start gap-1 px-0 h-auto pb-0">
              {[
                { value: "overview", label: "Overview", icon: LayoutDashboard },
                { value: "milestones", label: "Roadmap", icon: Flag },
                { value: "projects", label: "Projects", icon: FolderKanban },
                { value: "members", label: "Members", icon: Users2 },
                { value: "analytics", label: "Analytics", icon: BarChart3 },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={cn(
                    "rounded-none border-b-2 border-transparent pb-3 pt-2 px-4 gap-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="mt-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Details */}
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold">Program Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-8">
                        <InfoField label="Status">
                          <Badge variant="outline" className={cn("text-xs", st.color)}>
                            <div className={cn("h-1.5 w-1.5 rounded-full mr-1.5", st.dot)} />
                            {st.label}
                          </Badge>
                        </InfoField>
                        <InfoField label="Priority">
                          {pr ? <span className={cn("text-sm font-medium", pr.color)}>{pr.label}</span> : <span className="text-sm text-muted-foreground">Not set</span>}
                        </InfoField>
                        <InfoField label="Start Date">
                          <span className="text-sm">{program.startDate ? format(new Date(program.startDate), "MMMM d, yyyy") : "Not set"}</span>
                        </InfoField>
                        <InfoField label="End Date">
                          <span className="text-sm">{program.endDate ? format(new Date(program.endDate), "MMMM d, yyyy") : "Not set"}</span>
                        </InfoField>
                        <InfoField label="Program Lead">
                          {program.programLead ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                {program.programLead.profileImageUrl && <AvatarImage src={program.programLead.profileImageUrl} />}
                                <AvatarFallback className="text-[10px]">{program.programLead.name?.[0]?.toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">{program.programLead.name}</span>
                            </div>
                          ) : <span className="text-sm text-muted-foreground">Not assigned</span>}
                        </InfoField>
                        <InfoField label="Budget">
                          <span className="text-sm">{program.budget ? `$${program.budget.toLocaleString()}` : "Not set"}</span>
                        </InfoField>
                        <InfoField label="Created" className="col-span-2">
                          <span className="text-sm">{format(new Date(program.$createdAt), "MMMM d, yyyy 'at' h:mm a")}</span>
                        </InfoField>
                        {program.description && (
                          <InfoField label="Description" className="col-span-2">
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{program.description}</p>
                          </InfoField>
                        )}
                        {program.tags && program.tags.length > 0 && (
                          <InfoField label="Tags" className="col-span-2">
                            <div className="flex flex-wrap gap-1.5">
                              {program.tags.map((tag: string) => (
                                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                              ))}
                            </div>
                          </InfoField>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right: Quick stats & Actions */}
                <div className="space-y-4">
                  <Card>
                    <CardContent className="pt-5 space-y-4">
                      <div className="text-center">
                        <div className="relative inline-flex items-center justify-center">
                          <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                            <circle cx="60" cy="60" r="50" fill="none" stroke={program.color || "hsl(var(--primary))"} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${progress * 3.14} ${314 - progress * 3.14}`} />
                          </svg>
                          <span className="absolute text-2xl font-bold">{progress}%</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">Overall Progress</p>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-3">
                        <MiniStat icon={FolderKanban} label="Projects" value={projCount} color="text-blue-500" bg="bg-blue-500/10" />
                        <MiniStat icon={Users2} label="Members" value={memCount} color="text-emerald-500" bg="bg-emerald-500/10" />
                        <MiniStat icon={Flag} label="Milestones" value={msCount} color="text-amber-500" bg="bg-amber-500/10" />
                        <MiniStat icon={CheckCircle2} label="Completed" value={msDone} color="text-purple-500" bg="bg-purple-500/10" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Actions */}
                  <Card>
                    <CardContent className="pt-5 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</p>
                      <button onClick={() => setActiveTab("milestones")} className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-accent transition-colors text-left">
                        <div className="h-8 w-8 rounded-md bg-amber-500/10 flex items-center justify-center"><Flag className="h-4 w-4 text-amber-500" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">View Roadmap</p>
                          <p className="text-xs text-muted-foreground">{msCount} milestones</p>
                        </div>
                      </button>
                      <button onClick={() => setActiveTab("projects")} className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-accent transition-colors text-left">
                        <div className="h-8 w-8 rounded-md bg-blue-500/10 flex items-center justify-center"><FolderKanban className="h-4 w-4 text-blue-500" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Linked Projects</p>
                          <p className="text-xs text-muted-foreground">{projCount} projects</p>
                        </div>
                      </button>
                      <button onClick={() => setActiveTab("analytics")} className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-accent transition-colors text-left">
                        <div className="h-8 w-8 rounded-md bg-emerald-500/10 flex items-center justify-center"><BarChart3 className="h-4 w-4 text-emerald-500" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Analytics</p>
                          <p className="text-xs text-muted-foreground">View insights</p>
                        </div>
                      </button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Milestones / Roadmap */}
            <TabsContent value="milestones" className="mt-6">
              <ProgramMilestones programId={programId} canManage={!!canManage} />
            </TabsContent>

            {/* Projects */}
            <TabsContent value="projects" className="mt-6">
              <ProgramProjectsList programId={programId} workspaceId={workspaceId} canManage={!!canManage} />
            </TabsContent>

            {/* Members */}
            <TabsContent value="members" className="mt-6">
              <ProgramMembersTable programId={programId} workspaceId={workspaceId} canManageMembers={!!canManage} />
            </TabsContent>

            {/* Analytics */}
            <TabsContent value="analytics" className="mt-6">
              <ProgramAnalyticsDashboard programId={programId} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

/* ─── Sub-components ──────────────────────────────────────────────── */
function KpiItem({ label, value, icon: Icon, extra }: { label: string; value: string | number; icon?: typeof Layers; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {Icon && (
        <div className="flex items-center justify-center h-7 w-7 rounded-md bg-muted">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
        {extra}
      </div>
    </div>
  );
}

function InfoField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, color, bg }: { icon: typeof Layers; label: string; value: number; color: string; bg: string }) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
      <div className={cn("flex items-center justify-center h-8 w-8 rounded-md", bg)}>
        <Icon className={cn("h-4 w-4", color)} />
      </div>
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
