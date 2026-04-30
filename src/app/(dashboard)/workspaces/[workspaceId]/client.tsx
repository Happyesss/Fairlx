"use client"

import { cn } from "@/lib/utils"
import { PageError } from "@/components/page-error"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useGetMembers } from "@/features/members/api/use-get-members"
import { MemberAvatar } from "@/features/members/components/member-avatar"
import { useGetProjects } from "@/features/projects/api/use-get-projects"
import { ProjectAvatar } from "@/features/projects/components/project-avatar"
import { useGetWorkItems } from "@/features/sprints/api/use-get-work-items"
import { WorkItemStatus, type PopulatedWorkItem } from "@/features/sprints/types"
import { useGetPrograms } from "@/features/programs/api/use-get-programs"
import { ProgramStatus } from "@/features/programs/types"
import { useGetWorkspaceAnalytics } from "@/features/workspaces/api/use-get-workspace-analytics"
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace"
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id"
import { useCurrent } from "@/features/auth/api/use-current"

import { formatDistanceToNow, format } from "date-fns"
import {
  CheckCircle2,
  Clock,
  Layers,
  AlertTriangle,
  FolderKanban,
  ExternalLink,
  TrendingUp,
  Users,
  Activity,
  BarChart3,
  Target,
  Zap,
  CalendarDays,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react"
import { useMemo } from "react"
import Link from "next/link"

import {
  DashboardStatsSkeleton,
  DashboardChartsSkeleton,
  DashboardTasksSkeleton,
  DashboardBottomSkeleton,
} from "./components/workspace-skeletons"
import { Skeleton } from "@/components/ui/skeleton"
import { WorkspaceStatusChart } from "./components/workspace-status-chart"
import { WorkspacePriorityDistributionChart } from "./components/workspace-priority-distribution-chart"
import { WorkspaceProjectOverviewChart } from "./components/workspace-project-overview-chart"

// ---------- Helpers ----------
function TrendIndicator({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        <ArrowUpRight className="h-3 w-3" />+{value}
      </span>
    )
  }
  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-red-500">
        <ArrowDownRight className="h-3 w-3" />{value}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
      <Minus className="h-3 w-3" />0
    </span>
  )
}

export const WorkspaceIdClient = () => {
  const workspaceId = useWorkspaceId()
  const { data: user } = useCurrent()
  const { data: analytics, isLoading: isLoadingAnalytics } =
    useGetWorkspaceAnalytics({ workspaceId })
  const { data: workItems, isLoading: isLoadingWorkItems } = useGetWorkItems({
    workspaceId,
    limit: 50,
  })
  const { data: projects, isLoading: isLoadingProjects } = useGetProjects({
    workspaceId,
  })
  const { data: members, isLoading: isLoadingMembers } = useGetMembers({
    workspaceId,
  })
  const { data: programs } = useGetPrograms({ workspaceId })
  const { data: workspace } = useGetWorkspace({ workspaceId })

  // ---------- Top-level numbers ----------
  const totalTasks = analytics?.taskCount || 0
  const completedTasks = analytics?.completedTaskCount || 0
  const pendingTasks = analytics?.incompleteTaskCount || 0
  const overdueTasks = analytics?.overdueTaskCount || 0
  const assignedTasks = analytics?.assignedTaskCount || 0
  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // Month-over-month deltas
  const taskDiff = (analytics?.taskDifference as number) || 0
  const completedDiff = (analytics?.completedTaskDifference as number) || 0
  const incompleteDiff = (analytics?.incompleteTaskDifference as number) || 0
  const overdueDiff = (analytics?.overdueTaskDifference as number) || 0

  // ---------- Rich aggregated data ----------
  const dynamicData = useMemo(() => {
    if (!analytics || !members?.documents) {
      return {
        statusOverview: [],
        priorityDistribution: [],
        monthlyData: [],
        memberWorkload: [],
        recentWorkItems: [],
        dueSoonWorkItems: [],
        overdueWorkItems: [],
        contributionData: [],
      }
    }

    const {
      statusDistribution = [],
      priorityDistribution = [],
      monthlyData = [],
      memberWorkload: serverWorkload = [],
      contributionData: serverContribution = [],
    } = analytics as Record<string, unknown>

    // Hydrate member workload with names/avatars
    const memberWorkload = (
      serverWorkload as { id: string; userId?: string; tasks: number; completedTasks: number }[]
    ).map((sw) => {
      const member = members.documents.find(
        (m) => m.$id === sw.id || (m as Record<string, unknown>).userId === sw.userId
      )
      return {
        ...sw,
        name: member?.name || member?.email || "Unknown",
        imageUrl: member?.profileImageUrl,
      }
    })

    const contributionData = (
      serverContribution as { id: string; userId?: string; completed: number; total: number }[]
    ).map((sc) => {
      const member = members.documents.find(
        (m) => m.$id === sc.id || (m as Record<string, unknown>).userId === sc.userId
      )
      return {
        ...sc,
        name: member?.name || member?.email || "Unknown",
        imageUrl: member?.profileImageUrl,
      }
    })

    // Work items
    const allWorkItems = (workItems?.documents as PopulatedWorkItem[]) || []

    // Recent work items
    const recentWorkItems = [...allWorkItems]
      .sort(
        (a, b) =>
          new Date(b.$updatedAt).getTime() - new Date(a.$updatedAt).getTime()
      )
      .slice(0, 8)
      .map((item) => {
        const assignee = item.assignees?.[0]
        return {
          id: item.$id,
          title: item.title,
          status:
            item.status === WorkItemStatus.DONE
              ? "Completed"
              : item.status === WorkItemStatus.IN_PROGRESS ||
                  item.status === WorkItemStatus.IN_REVIEW
                ? "In Progress"
                : "To Do",
          assignee: assignee?.name || "Unassigned",
          assigneeImage: assignee?.profileImageUrl,
          priority: item.priority || "MEDIUM",
          projectId: item.projectId,
          project: item.project?.name || "No Project",
          projectImage: item.project?.imageUrl,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          updatedAt: new Date(item.$updatedAt),
        }
      })

    const now = new Date()
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Due soon (next 7 days)
    const dueSoonWorkItems = allWorkItems
      .filter((item) => {
        if (!item.dueDate || item.status === WorkItemStatus.DONE) return false
        const d = new Date(item.dueDate)
        return d >= now && d <= weekFromNow
      })
      .sort(
        (a, b) =>
          new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
      )
      .slice(0, 6)
      .map((t) => ({
        id: t.$id,
        title: t.title,
        project: t.project?.name,
        dueDate: new Date(t.dueDate!),
      }))

    // Overdue work items
    const overdueWorkItems = allWorkItems
      .filter((item) => {
        if (!item.dueDate || item.status === WorkItemStatus.DONE) return false
        return new Date(item.dueDate) < now
      })
      .sort(
        (a, b) =>
          new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
      )
      .slice(0, 5)
      .map((t) => ({
        id: t.$id,
        title: t.title,
        project: t.project?.name,
        dueDate: new Date(t.dueDate!),
        assignee: t.assignees?.[0]?.name || "Unassigned",
      }))

    return {
      statusOverview: (statusDistribution as { id: string; name: string; value: number; color: string }[]).map((s) => ({ name: s.name, count: s.value })),
      priorityDistribution: priorityDistribution as { name: string; count: number; fill: string }[],
      monthlyData: monthlyData as { name: string; total: number; completed: number }[],
      memberWorkload,
      recentWorkItems,
      dueSoonWorkItems,
      overdueWorkItems,
      contributionData,
    }
  }, [analytics, workItems, members])

  // ---------- Project-level stats ----------
  const projectStats = useMemo(() => {
    if (!projects?.documents || !workItems?.documents) return []
    const allWI = (workItems.documents as PopulatedWorkItem[]) || []
    return projects.documents
      .map((project) => {
        const items = allWI.filter((t) => t.projectId === project.$id)
        const done = items.filter((t) => t.status === WorkItemStatus.DONE).length
        const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0
        return {
          id: project.$id,
          name: project.name,
          imageUrl: (project as Record<string, unknown>).imageUrl as string | undefined,
          total: items.length,
          completed: done,
          pct,
          deadline: (project as Record<string, unknown>).deadline as string | undefined,
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [projects, workItems])

  // ---------- Programs ----------
  const activePrograms = useMemo(() => {
    if (!programs?.documents) return []
    return programs.documents.filter(
      (p) =>
        (p as Record<string, unknown>).status === ProgramStatus.ACTIVE ||
        (p as Record<string, unknown>).status === ProgramStatus.PLANNING
    )
  }, [programs])

  // Handle error state
  if (!isLoadingAnalytics && !analytics) {
    return <PageError message="Failed to load workspace analytics." />
  }

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    return "Good evening"
  })()

  return (
    <div id="dashboard-analytics" className="space-y-6 pb-8">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Header                                                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting}, {user?.name?.split(" ")[0] || "there"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here&apos;s a complete overview of your workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm font-medium px-3 py-1">
            {workspace?.name || "Workspace"}
          </Badge>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Stat Cards — 5 key numbers with month-over-month trends       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {isLoadingAnalytics ? (
        <DashboardStatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Total Tasks */}
          <Card className="relative overflow-hidden border-border/50 hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Total Tasks</p>
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Layers className="h-3.5 w-3.5 text-blue-500" />
                </div>
              </div>
              <p className="text-2xl font-bold mt-1.5 tracking-tight">{totalTasks}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <TrendIndicator value={taskDiff} />
                <span className="text-[10px] text-muted-foreground">vs last month</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500/10">
                <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: "100%" }} />
              </div>
            </CardContent>
          </Card>

          {/* Assigned */}
          <Card className="relative overflow-hidden border-border/50 hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Assigned</p>
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Target className="h-3.5 w-3.5 text-violet-500" />
                </div>
              </div>
              <p className="text-2xl font-bold mt-1.5 tracking-tight text-violet-600 dark:text-violet-400">
                {assignedTasks}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {totalTasks > 0 ? Math.round((assignedTasks / totalTasks) * 100) : 0}% assigned
              </p>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-violet-500/10">
                <div
                  className="h-full bg-violet-500 transition-all duration-500"
                  style={{ width: `${totalTasks > 0 ? (assignedTasks / totalTasks) * 100 : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pending */}
          <Card className="relative overflow-hidden border-border/50 hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Pending</p>
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                </div>
              </div>
              <p className="text-2xl font-bold mt-1.5 tracking-tight text-amber-600 dark:text-amber-400">
                {pendingTasks}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <TrendIndicator value={incompleteDiff} />
                <span className="text-[10px] text-muted-foreground">vs last month</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500/10">
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${totalTasks > 0 ? (pendingTasks / totalTasks) * 100 : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Completed */}
          <Card className="relative overflow-hidden border-border/50 hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Completed</p>
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                </div>
              </div>
              <p className="text-2xl font-bold mt-1.5 tracking-tight text-emerald-600 dark:text-emerald-400">
                {completedTasks}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <TrendIndicator value={completedDiff} />
                <span className="text-[10px] text-muted-foreground">vs last month</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500/10">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Overdue */}
          <Card className="relative overflow-hidden border-border/50 hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Overdue</p>
                <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                </div>
              </div>
              <p className="text-2xl font-bold mt-1.5 tracking-tight text-red-600 dark:text-red-400">
                {overdueTasks}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <TrendIndicator value={overdueDiff} />
                <span className="text-[10px] text-muted-foreground">vs last month</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500/10">
                <div
                  className="h-full bg-red-500 transition-all duration-500"
                  style={{ width: `${totalTasks > 0 ? Math.min((overdueTasks / totalTasks) * 100, 100) : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Charts Row — Status + Priority + Monthly Trend                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {isLoadingAnalytics ? (
        <DashboardChartsSkeleton />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Status Donut */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Status Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkspaceStatusChart data={dynamicData.statusOverview} />
            </CardContent>
          </Card>

          {/* Priority Bar */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Priority Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkspacePriorityDistributionChart data={dynamicData.priorityDistribution} />
            </CardContent>
          </Card>

          {/* Monthly Trend */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Monthly Trend</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {dynamicData.monthlyData.length > 0 &&
              dynamicData.monthlyData.some((m) => m.total > 0) ? (
                <div className="h-[260px]">
                  <WorkspaceProjectOverviewChart data={dynamicData.monthlyData} />
                </div>
              ) : (
                <div className="h-[260px] flex flex-col items-center justify-center text-sm text-muted-foreground">
                  <BarChart3 className="h-10 w-10 text-muted-foreground/20 mb-2" />
                  <p>No monthly data yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Projects Overview — full-width list with progress              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {isLoadingProjects ? (
        <DashboardBottomSkeleton />
      ) : projectStats.length > 0 ? (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                Projects ({projectStats.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {/* Header */}
            <div className="grid grid-cols-12 gap-3 pb-2 border-b border-border/50 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <div className="col-span-4 flex items-center">Project</div>
              <div className="col-span-2 flex items-center justify-center">Tasks</div>
              <div className="col-span-2 flex items-center justify-center">Completed</div>
              <div className="col-span-4 flex items-center">Progress</div>
            </div>
            <div className="divide-y divide-border/30">
              {projectStats.slice(0, 8).map((project) => (
                <Link
                  key={project.id}
                  href={`/workspaces/${workspaceId}/projects/${project.id}`}
                  className="grid grid-cols-12 gap-3 py-3 items-center hover:bg-muted/50 transition-colors w-full text-left cursor-pointer px-4 -mx-4"
                >
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <ProjectAvatar
                      name={project.name}
                      image={project.imageUrl}
                      className="h-8 w-8 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{project.name}</p>
                      {project.deadline && (
                        <p className="text-[11px] text-muted-foreground">
                          Due {format(new Date(project.deadline), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2 text-center">
                    <span className="text-sm font-medium tabular-nums">{project.total}</span>
                  </div>
                  <div className="col-span-2 text-center">
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {project.completed}
                    </span>
                  </div>
                  <div className="col-span-4 flex items-center gap-3">
                    <Progress value={project.pct} className="h-2 flex-1" />
                    <span className="text-xs font-medium text-muted-foreground tabular-nums w-9 text-right">
                      {project.pct}%
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Recent Tasks + Sidebar (Deadlines, Overdue, Activity)         */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Task Table — 2 cols */}
        {isLoadingWorkItems ? (
          <div className="xl:col-span-2">
            <DashboardTasksSkeleton />
          </div>
        ) : (
          <Card className="xl:col-span-2 border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Recent Work Items</CardTitle>
                {workItems?.total && workItems.total > 8 && (
                  <Link href={`/workspaces/${workspaceId}/tasks`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                      View All <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-12 gap-3 pb-2 border-b border-border/50 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-5">Task</div>
                <div className="col-span-2">Project</div>
                <div className="col-span-2">Due</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1">Priority</div>
              </div>

              <div className="divide-y divide-border/30">
                {dynamicData.recentWorkItems.length > 0 ? (
                  dynamicData.recentWorkItems.map((task) => (
                    <Link
                      key={task.id}
                      href={`/workspaces/${workspaceId}/tasks/${task.id}`}
                      className="grid grid-cols-12 gap-3 py-3 items-center hover:bg-muted/50 transition-colors px-4 -mx-4"
                    >
                      <div className="col-span-5 flex items-center gap-3 min-w-0">
                        <MemberAvatar
                          name={task.assignee}
                          imageUrl={task.assigneeImage}
                          className="h-7 w-7 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate text-foreground">
                            {task.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {task.assignee}
                          </p>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs text-muted-foreground truncate block">
                          {task.project}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs text-muted-foreground">
                          {task.dueDate ? format(task.dueDate, "MMM d") : "—"}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[11px] font-medium",
                            task.status === "Completed" &&
                              "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15",
                            task.status === "In Progress" &&
                              "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15",
                            task.status === "To Do" &&
                              "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15"
                          )}
                        >
                          {task.status}
                        </Badge>
                      </div>
                      <div className="col-span-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-medium border-0",
                            task.priority === "URGENT" &&
                              "bg-red-500/10 text-red-600 dark:text-red-400",
                            task.priority === "HIGH" &&
                              "bg-orange-500/10 text-orange-600 dark:text-orange-400",
                            task.priority === "MEDIUM" &&
                              "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
                            task.priority === "LOW" &&
                              "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                          )}
                        >
                          {task.priority}
                        </Badge>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="py-12 text-center">
                    <Layers className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No work items yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      Create your first task to get started
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Right Sidebar ── */}
        <div className="space-y-4">
          {/* Due Alerts */}
          {dynamicData.overdueWorkItems.length > 0 && (
            <Card className="border-red-500/20 bg-gradient-to-b from-red-500/[0.03] to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  Due Alerts
                  <Badge variant="secondary" className="ml-auto text-[10px] bg-red-500/10 text-red-600 dark:text-red-400 tabular-nums">
                    {dynamicData.overdueWorkItems.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {dynamicData.overdueWorkItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-red-500/[0.06] dark:bg-red-500/10 border border-red-500/15 p-3.5 space-y-2.5 transition-all hover:bg-red-500/[0.1] dark:hover:bg-red-500/15"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{item.title}</p>
                          <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">
                            Due {format(item.dueDate, "MMM d, h:mm a")}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-600 dark:text-red-400 shrink-0">
                          {formatDistanceToNow(item.dueDate, { addSuffix: true })}
                        </Badge>
                      </div>
                      <Link href={`/workspaces/${workspaceId}/tasks/${item.id}`}>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full h-8 text-xs bg-white dark:bg-muted/50 border border-red-500/20 hover:bg-red-50 dark:hover:bg-muted transition-colors text-foreground"
                        >
                          <Clock className="mr-1.5 h-3 w-3" />
                          View Details
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upcoming Deadlines */}
          {isLoadingWorkItems ? (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-36" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5">
                      <Skeleton className="h-2 w-2 rounded-full" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-amber-500/20 bg-gradient-to-b from-amber-500/[0.03] to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <CalendarDays className="h-4 w-4" />
                  Upcoming Deadlines
                  {dynamicData.dueSoonWorkItems.length > 0 && (
                    <Badge variant="secondary" className="ml-auto text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 tabular-nums">
                      {dynamicData.dueSoonWorkItems.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dynamicData.dueSoonWorkItems.length > 0 ? (
                  <div className="space-y-2.5">
                    {dynamicData.dueSoonWorkItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl bg-amber-500/[0.06] dark:bg-amber-500/10 border border-amber-500/15 p-3.5 space-y-2.5 transition-all hover:bg-amber-500/[0.1] dark:hover:bg-amber-500/15"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">{item.title}</p>
                            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-0.5">
                              Due {format(item.dueDate, "MMM d, h:mm a")}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0">
                            {formatDistanceToNow(item.dueDate, { addSuffix: true })}
                          </Badge>
                        </div>
                        {item.project && (
                          <p className="text-[11px] text-muted-foreground truncate">{item.project}</p>
                        )}
                        <Link href={`/workspaces/${workspaceId}/tasks/${item.id}`}>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full h-8 text-xs bg-white dark:bg-white/10 border border-amber-500/20 hover:bg-amber-50 dark:hover:bg-white/15 transition-colors"
                          >
                            <Clock className="mr-1.5 h-3 w-3" />
                            View Details
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500/40 mx-auto mb-1.5" />
                    <p className="text-xs text-muted-foreground">
                      No upcoming deadlines — you&apos;re all caught up!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Recent Activity
                </CardTitle>
                <Link href={`/workspaces/${workspaceId}/audit-logs`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-muted-foreground px-2"
                  >
                    View All
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {dynamicData.recentWorkItems.length > 0 ? (
                <div className="space-y-3.5">
                  {dynamicData.recentWorkItems.slice(0, 5).map((item, idx) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className="relative mt-0.5">
                        <MemberAvatar
                          name={item.assignee}
                          imageUrl={item.assigneeImage}
                          className="h-6 w-6"
                        />
                        {idx < Math.min(dynamicData.recentWorkItems.length, 5) - 1 && (
                          <div className="absolute top-7 left-1/2 -translate-x-1/2 w-px h-3 bg-border" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs leading-relaxed">
                          <span className="font-medium text-foreground">
                            {item.assignee}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            {item.status === "Completed" ? "completed" : "updated"}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          &quot;{item.title}&quot;
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {item.updatedAt && !isNaN(item.updatedAt.getTime()) 
                            ? formatDistanceToNow(item.updatedAt, { addSuffix: true })
                            : "recently"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <Activity className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
                  <p className="text-xs text-muted-foreground">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Workload + Contributors + Programs                            */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {isLoadingAnalytics || isLoadingMembers ? (
        <DashboardBottomSkeleton />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Workload Distribution */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Workload Distribution</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {dynamicData.memberWorkload.length > 0 ? (
                <div className="space-y-3">
                  {dynamicData.memberWorkload.map((member) => {
                    const pct = totalTasks > 0 ? (member.tasks / totalTasks) * 100 : 0
                    const completePct = member.tasks > 0 ? Math.round((member.completedTasks / member.tasks) * 100) : 0
                    return (
                      <div key={member.id} className="flex items-center gap-3">
                        <MemberAvatar
                          name={member.name}
                          imageUrl={member.imageUrl}
                          className="h-8 w-8 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">{member.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                {member.completedTasks}/{member.tasks}
                              </span>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-[10px] h-5",
                                  completePct >= 75 && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                                  completePct >= 50 && completePct < 75 && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                  completePct < 50 && "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                                )}
                              >
                                {completePct}%
                              </Badge>
                            </div>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Users className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
                  <p className="text-sm text-muted-foreground">No workload data</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Contributors */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Top Contributors</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {dynamicData.contributionData.length > 0 ? (
                <div className="space-y-3">
                  {dynamicData.contributionData.slice(0, 6).map((contributor, idx) => (
                    <div key={contributor.id} className="flex items-center gap-3">
                      <div className={cn(
                        "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0",
                        idx === 0 && "bg-amber-500/20 text-amber-600 dark:text-amber-400",
                        idx === 1 && "bg-slate-400/20 text-slate-500 dark:text-slate-400",
                        idx === 2 && "bg-orange-500/20 text-orange-600 dark:text-orange-400",
                        idx >= 3 && "bg-muted text-muted-foreground"
                      )}>
                        {idx + 1}
                      </div>
                      <MemberAvatar
                        name={contributor.name}
                        imageUrl={contributor.imageUrl}
                        className="h-7 w-7 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{contributor.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {contributor.completed} of {contributor.total} completed
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] tabular-nums">
                        {contributor.total > 0
                          ? Math.round((contributor.completed / contributor.total) * 100)
                          : 0}%
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <TrendingUp className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
                  <p className="text-sm text-muted-foreground">No contributors yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Programs or Quick Links */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {activePrograms.length > 0 ? "Active Programs" : "Quick Links"}
                </CardTitle>
                {activePrograms.length > 0 ? (
                  <Zap className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {activePrograms.length > 0 ? (
                <div className="space-y-2">
                  {activePrograms.slice(0, 5).map((program) => {
                    const p = program as Record<string, unknown>
                    return (
                      <Link
                        key={program.$id}
                        href={`/workspaces/${workspaceId}/programs/${program.$id}`}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ backgroundColor: (p.color as string) || "#6366f1" }}
                        >
                          {(p.icon as string) || (program.name as string)?.charAt(0)?.toUpperCase() || "P"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{program.name}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] h-4 mt-0.5",
                              p.status === ProgramStatus.ACTIVE && "border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
                              p.status === ProgramStatus.PLANNING && "border-blue-500/50 text-blue-600 dark:text-blue-400"
                            )}
                          >
                            {(p.status as string)?.toLowerCase()}
                          </Badge>
                        </div>
                      </Link>
                    )
                  })}
                  {programs?.documents && programs.documents.length > 5 && (
                    <Link href={`/workspaces/${workspaceId}/programs`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-1 text-xs text-muted-foreground"
                      >
                        View All Programs <ExternalLink className="ml-1 h-3 w-3" />
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {[
                    { label: "Tasks", href: `/workspaces/${workspaceId}/tasks`, icon: <Layers className="h-4 w-4" /> },
                    { label: "Sprints", href: `/workspaces/${workspaceId}/sprints`, icon: <Zap className="h-4 w-4" /> },
                    { label: "Timeline", href: `/workspaces/${workspaceId}/timeline`, icon: <CalendarDays className="h-4 w-4" /> },
                    { label: "Programs", href: `/workspaces/${workspaceId}/programs`, icon: <Target className="h-4 w-4" /> },
                    { label: "Time Tracking", href: `/workspaces/${workspaceId}/time-tracking`, icon: <Clock className="h-4 w-4" /> },
                    { label: "Audit Logs", href: `/workspaces/${workspaceId}/audit-logs`, icon: <Activity className="h-4 w-4" /> },
                  ].map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-sm text-muted-foreground hover:text-foreground"
                    >
                      {link.icon}
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Team Members Row                                              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {!isLoadingMembers && members?.documents && members.documents.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Team ({members.total || 0})
              </CardTitle>
              <Link href={`/workspaces/${workspaceId}/members`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  Manage <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {members.documents.slice(0, 16).map((member) => (
                <div
                  key={member.$id}
                  className="flex flex-col items-center gap-1"
                >
                  <MemberAvatar
                    name={member.name || member.email || "U"}
                    imageUrl={member.profileImageUrl}
                    className="h-10 w-10 border-2 border-background"
                  />
                  <span className="text-[10px] text-muted-foreground max-w-[60px] truncate text-center">
                    {member.name?.split(" ")[0] || member.email?.split("@")[0] || "?"}
                  </span>
                </div>
              ))}
              {members.total && members.total > 16 && (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    +{members.total - 16}
                  </div>
                  <span className="text-[10px] text-muted-foreground">more</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
