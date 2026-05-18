"use client";

import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  FolderKanban,
  Calendar,
  Search,
  Filter,
  LayoutGrid,
  List,
  TrendingUp,
  Target,
  Clock,
  Users,
  Flag,
  Zap,
  Shield,
  ChevronRight,
  Layers,
  Info,
  CheckCircle2,
  BarChart3,
  GitMerge,
  Milestone,
} from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetPrograms } from "@/features/programs/api/use-get-programs";
import { useDeleteProgram } from "@/features/programs/api/use-delete-program";
import { useCreateProgramModal } from "@/features/programs/hooks/use-create-program-modal";
import { useEditProgramModal } from "@/features/programs/hooks/use-edit-program-modal";
import { CreateProgramModal } from "@/features/programs/components/create-program-modal";
import { EditProgramModal } from "@/features/programs/components/edit-program-modal";
import { ProgramStatus, ProgramPriority } from "@/features/programs/types";
import { useConfirm } from "@/hooks/use-confirm";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { cn } from "@/lib/utils";

/* ─── Config ──────────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<ProgramStatus, { label: string; color: string; dot: string; icon: typeof TrendingUp }> = {
  [ProgramStatus.ACTIVE]: {
    label: "Active",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
    dot: "bg-emerald-500",
    icon: TrendingUp,
  },
  [ProgramStatus.PLANNING]: {
    label: "Planning",
    color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
    dot: "bg-blue-500",
    icon: Target,
  },
  [ProgramStatus.ON_HOLD]: {
    label: "On Hold",
    color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
    dot: "bg-amber-500",
    icon: Clock,
  },
  [ProgramStatus.COMPLETED]: {
    label: "Completed",
    color: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
    dot: "bg-slate-400",
    icon: Shield,
  },
  [ProgramStatus.CANCELLED]: {
    label: "Cancelled",
    color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
    dot: "bg-red-500",
    icon: Zap,
  },
};

const PRIORITY_CONFIG: Record<ProgramPriority, { label: string; color: string }> = {
  [ProgramPriority.LOW]: { label: "Low", color: "text-slate-500" },
  [ProgramPriority.MEDIUM]: { label: "Medium", color: "text-blue-500" },
  [ProgramPriority.HIGH]: { label: "High", color: "text-amber-500" },
  [ProgramPriority.CRITICAL]: { label: "Critical", color: "text-red-500" },
};

const fmtShort = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtFull = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/* ─── Main ────────────────────────────────────────────────────────── */
export const ProgramsClient = () => {
  const workspaceId = useWorkspaceId();
  const { data: programs, isLoading } = useGetPrograms({ workspaceId });
  const { open: openCreate } = useCreateProgramModal();
  const { open: openEdit } = useEditProgramModal();
  const { mutate: deleteProgram } = useDeleteProgram();
  const { isAdmin } = useCurrentMember({ workspaceId });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showInfoModal, setShowInfoModal] = useState(false);

  const [DeleteDialog, confirmDelete] = useConfirm(
    "Delete Program",
    "This action cannot be undone. All associated data will be permanently removed.",
    "destructive"
  );

  const filtered = useMemo(() => {
    if (!programs?.documents) return [];
    return programs.documents.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [programs, search, statusFilter]);

  const stats = useMemo(() => {
    const d = programs?.documents || [];
    return {
      total: d.length,
      active: d.filter((p) => p.status === ProgramStatus.ACTIVE).length,
      planning: d.filter((p) => p.status === ProgramStatus.PLANNING).length,
      completed: d.filter((p) => p.status === ProgramStatus.COMPLETED).length,
      onHold: d.filter((p) => p.status === ProgramStatus.ON_HOLD).length,
    };
  }, [programs]);

  const handleDelete = async (id: string) => {
    const ok = await confirmDelete();
    if (ok) deleteProgram({ param: { programId: id } });
  };

  return (
    <div className="h-full flex flex-col">
      <DeleteDialog />
      <CreateProgramModal />
      <EditProgramModal />

      {/* Programs Info Modal */}
      <Dialog open={showInfoModal} onOpenChange={setShowInfoModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                <FolderKanban className="size-5 text-primary" />
              </div>
              What is a Program?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-2">
            <p className="text-muted-foreground text-sm leading-relaxed">
              A <strong className="text-foreground">Program</strong> is a strategic umbrella that groups related projects under a shared objective. It gives your organization a bird&apos;s-eye view of work spanning multiple teams, timelines, and deliverables.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: Layers, title: "Multi-Project Oversight", desc: "Bundle related projects so stakeholders see progress in one place instead of switching between boards.", colorClass: "bg-purple-500/10 border-purple-500/20", iconColor: "text-purple-600 dark:text-purple-400" },
                { icon: Milestone, title: "Milestones", desc: "Define key delivery checkpoints — e.g. Beta Launch, Go-Live — shared across every project in the program.", colorClass: "bg-blue-500/10 border-blue-500/20", iconColor: "text-blue-600 dark:text-blue-400" },
                { icon: Users, title: "Cross-team Members", desc: "Add contributors from any project team so everyone on the initiative is visible in one place.", colorClass: "bg-emerald-500/10 border-emerald-500/20", iconColor: "text-emerald-600 dark:text-emerald-400" },
                { icon: BarChart3, title: "Analytics", desc: "Rolled-up completion rates, task counts, and timeline health for the entire program at a glance.", colorClass: "bg-amber-500/10 border-amber-500/20", iconColor: "text-amber-600 dark:text-amber-400" },
              ].map(({ icon: Icon, title, desc, colorClass, iconColor }) => (
                <div key={title} className={`p-4 rounded-xl border ${colorClass}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`size-4 ${iconColor}`} />
                    <p className="text-sm font-semibold">{title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <GitMerge className="size-4 text-muted-foreground" />
                How it works in industry
              </h4>
              <div className="space-y-3">
                {[
                  { company: "Product Company", program: "Q3 Platform Revamp", projects: ["API v2 Migration", "New Design System", "Mobile App Rewrite"] },
                  { company: "E-commerce", program: "Holiday Season Launch", projects: ["Checkout Optimisation", "Inventory Sync", "Marketing Campaigns"] },
                  { company: "Enterprise", program: "Cloud Migration", projects: ["Infra Lift & Shift", "Data Pipeline Rebuild", "Security Hardening"] },
                ].map((ex) => (
                  <div key={ex.program} className="p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-[10px]">{ex.company}</Badge>
                      <p className="text-sm font-medium">{ex.program}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ex.projects.map((proj) => (
                        <div key={proj} className="flex items-center gap-1 text-[11px] text-muted-foreground bg-background border rounded-full px-2 py-0.5">
                          <CheckCircle2 className="size-3 text-emerald-500" />
                          {proj}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-sm font-medium mb-1">Ready to get started?</p>
              <p className="text-xs text-muted-foreground mb-3">Create your first program, link your projects, and start tracking progress at the strategic level.</p>
              {isAdmin && (
                <Button size="sm" onClick={() => { setShowInfoModal(false); openCreate(); }}>
                  <Plus className="size-3.5 mr-1.5" />
                  Create a Program
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="border-b bg-background">
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-2xl font-semibold tracking-tight">Programs</h1>
                <button
                  onClick={() => setShowInfoModal(true)}
                  className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="What is a Program?"
                >
                  <Info className="size-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Manage strategic initiatives and portfolio health
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button onClick={openCreate} className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              New Program
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6 space-y-6">
          {/* Summary pills */}
          {!isLoading && !!programs?.documents.length && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { key: "all", label: "Total", value: stats.total, icon: Layers, dot: undefined },
                { key: ProgramStatus.ACTIVE, label: "Active", value: stats.active, icon: TrendingUp, dot: "bg-emerald-500" },
                { key: ProgramStatus.PLANNING, label: "Planning", value: stats.planning, icon: Target, dot: "bg-blue-500" },
                { key: ProgramStatus.ON_HOLD, label: "On Hold", value: stats.onHold, icon: Clock, dot: "bg-amber-500" },
                { key: ProgramStatus.COMPLETED, label: "Completed", value: stats.completed, icon: Shield, dot: "bg-slate-400" },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatusFilter(statusFilter === s.key ? "all" : s.key)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                    statusFilter === s.key
                      ? "border-primary/30 bg-primary/5 ring-1 ring-primary/20"
                      : "bg-card hover:bg-accent/50"
                  )}
                >
                  <div className={cn("flex items-center justify-center h-9 w-9 rounded-md", statusFilter === s.key ? "bg-primary/10" : "bg-muted")}>
                    {s.dot ? <div className={cn("h-3 w-3 rounded-full", s.dot)} /> : <s.icon className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="text-2xl font-bold leading-none">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Toolbar */}
          {!isLoading && !!programs?.documents.length && (
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search programs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-9">
                  <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", v.dot)} />{v.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center rounded-md border bg-background p-0.5">
                <button onClick={() => setView("grid")} className={cn("rounded-sm p-1.5 transition-colors", view === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button onClick={() => setView("list")} className={cn("rounded-sm p-1.5 transition-colors", view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div className={cn("grid gap-4", view === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="h-1 w-full bg-muted animate-pulse" />
                  <CardContent className="p-5 space-y-4">
                    <div className="flex gap-3"><div className="h-11 w-11 rounded-lg bg-muted animate-pulse" /><div className="flex-1 space-y-2"><div className="h-4 w-3/4 bg-muted rounded animate-pulse" /><div className="h-3 w-1/2 bg-muted rounded animate-pulse" /></div></div>
                    <div className="h-3 w-full bg-muted rounded animate-pulse" />
                    <div className="h-1.5 w-full bg-muted rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !programs?.documents.length ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-6"><Layers className="h-8 w-8 text-muted-foreground" /></div>
              <h3 className="text-xl font-semibold mb-2">No programs yet</h3>
              <p className="text-muted-foreground text-center max-w-sm mb-6 text-sm">Programs help you organize strategic initiatives, track milestones, and manage cross-project portfolios.</p>
              {isAdmin && <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />Create Your First Program</Button>}
            </div>
          ) : !filtered.length ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Search className="h-10 w-10 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No programs found</h3>
              <p className="text-sm text-muted-foreground">{search ? `No results for "${search}".` : "Try adjusting your filters."}</p>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((p) => {
                const st = STATUS_CONFIG[p.status as ProgramStatus] || STATUS_CONFIG[ProgramStatus.PLANNING];
                const pr = p.priority ? PRIORITY_CONFIG[p.priority as ProgramPriority] : null;
                const prog = (p as unknown as { progress?: number }).progress || 0;
                return (
                  <Link key={p.$id} href={`/workspaces/${workspaceId}/programs/${p.$id}`}>
                    <Card className="group relative overflow-hidden border-border/40 hover:border-border hover:shadow-md transition-all duration-200 cursor-pointer h-full">
                      <div className="h-1 w-full" style={{ backgroundColor: p.color || "hsl(var(--primary))" }} />
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="flex items-center justify-center h-11 w-11 rounded-lg shrink-0 border" style={{ backgroundColor: p.color ? `${p.color}10` : undefined, borderColor: p.color ? `${p.color}30` : undefined }}>
                              {p.imageUrl ? (
                                <Avatar className="h-11 w-11 rounded-lg"><AvatarImage src={p.imageUrl} alt={p.name} /><AvatarFallback className="rounded-lg text-xs font-semibold">{p.name.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                              ) : (
                                <FolderKanban className="h-5 w-5" style={{ color: p.color || "hsl(var(--primary))" }} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-[15px] truncate leading-tight group-hover:text-primary transition-colors">{p.name}</h3>
                              <div className="flex items-center gap-2 mt-1.5">
                                <Badge variant="outline" className={cn("text-[11px] font-medium px-1.5 py-0", st.color)}>
                                  <div className={cn("h-2 w-2 rounded-full mr-1", st.dot)} />{st.label}
                                </Badge>
                                {pr && <span className={cn("text-[11px] font-medium", pr.color)}>{pr.label}</span>}
                              </div>
                            </div>
                          </div>
                          {isAdmin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.preventDefault()}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.preventDefault()}>
                                <DropdownMenuItem onClick={(e) => { e.preventDefault(); openEdit(p.$id); }}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.preventDefault(); handleDelete(p.$id); }} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{p.description || "No description provided"}</p>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Progress</span><span className="text-xs font-semibold tabular-nums">{prog}%</span></div>
                          <Progress value={prog} className="h-1.5" />
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t">
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <TooltipProvider delayDuration={0}><Tooltip><TooltipTrigger asChild><div className="flex items-center gap-1 text-xs"><FolderKanban className="h-3.5 w-3.5" /><span className="tabular-nums">{(p as unknown as { projectCount?: number }).projectCount ?? 0}</span></div></TooltipTrigger><TooltipContent side="bottom">Projects</TooltipContent></Tooltip></TooltipProvider>
                            <TooltipProvider delayDuration={0}><Tooltip><TooltipTrigger asChild><div className="flex items-center gap-1 text-xs"><Users className="h-3.5 w-3.5" /><span className="tabular-nums">{(p as unknown as { memberCount?: number }).memberCount ?? 0}</span></div></TooltipTrigger><TooltipContent side="bottom">Members</TooltipContent></Tooltip></TooltipProvider>
                            <TooltipProvider delayDuration={0}><Tooltip><TooltipTrigger asChild><div className="flex items-center gap-1 text-xs"><Flag className="h-3.5 w-3.5" /><span className="tabular-nums">{(p as unknown as { milestoneCount?: number }).milestoneCount ?? 0}</span></div></TooltipTrigger><TooltipContent side="bottom">Milestones</TooltipContent></Tooltip></TooltipProvider>
                          </div>
                          {(p.startDate || p.endDate) && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {p.startDate && fmtShort(p.startDate)}{p.startDate && p.endDate && " – "}{p.endDate && fmtShort(p.endDate)}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((p) => {
                const st = STATUS_CONFIG[p.status as ProgramStatus] || STATUS_CONFIG[ProgramStatus.PLANNING];
                const prog = (p as unknown as { progress?: number }).progress || 0;
                return (
                  <Link key={p.$id} href={`/workspaces/${workspaceId}/programs/${p.$id}`}>
                    <div className="group flex items-center gap-4 rounded-lg border bg-card p-4 hover:bg-accent/50 hover:border-border transition-all cursor-pointer">
                      <div className="flex items-center justify-center h-10 w-10 rounded-lg shrink-0 border" style={{ backgroundColor: p.color ? `${p.color}10` : undefined, borderColor: p.color ? `${p.color}30` : undefined }}>
                        <FolderKanban className="h-5 w-5" style={{ color: p.color || "hsl(var(--primary))" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate group-hover:text-primary transition-colors">{p.name}</h3>
                          <Badge variant="outline" className={cn("text-[11px] font-medium px-1.5 py-0 shrink-0", st.color)}><div className={cn("h-1.5 w-1.5 rounded-full mr-1", st.dot)} />{st.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">{p.description || "No description"}</p>
                      </div>
                      <div className="hidden md:flex items-center gap-3 w-36 shrink-0"><Progress value={prog} className="h-1.5 flex-1" /><span className="text-xs font-medium tabular-nums w-8 text-right">{prog}%</span></div>
                      <div className="hidden lg:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                        <span className="flex items-center gap-1"><FolderKanban className="h-3.5 w-3.5" />{(p as unknown as { projectCount?: number }).projectCount ?? 0}</span>
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{(p as unknown as { memberCount?: number }).memberCount ?? 0}</span>
                      </div>
                      {p.endDate && <div className="hidden xl:flex items-center gap-1 text-xs text-muted-foreground shrink-0"><Calendar className="h-3.5 w-3.5" />{fmtFull(p.endDate)}</div>}
                      <div className="flex items-center gap-1 shrink-0">
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.preventDefault()}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.preventDefault()}>
                              <DropdownMenuItem onClick={(e) => { e.preventDefault(); openEdit(p.$id); }}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.preventDefault(); handleDelete(p.$id); }} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};