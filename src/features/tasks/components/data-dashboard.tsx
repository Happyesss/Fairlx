"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Flag,
  TrendingUp,
} from "lucide-react";
import { TaskStatus, TaskPriority, Task } from "../types";
import { Member } from "@/features/members/types";
import {
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { formatDistanceToNow, format } from "date-fns";
import { useMemo } from "react";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { ProjectActivityLogWidget } from "@/features/audit-logs/components/project-activity-log-widget";
import { ProjectMembersWidget } from "@/features/members/components/project-members-widget";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { useGetMySpaceMembers } from "@/features/my-space/api/use-get-my-space-members";

// ---------- Constants ----------
const STATUS_COLORS: Record<string, string> = {
  Done: "#10b981",
  "In Progress": "#f59e0b",
  "In Review": "#8b5cf6",
  "To Do": "#3b82f6",
  Assigned: "#ec4899",
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#6b7280",
};

// ---------- Types ----------
interface DataDashboardProps {
  tasks?: Task[];
  isLoading?: boolean;
  isAggregated?: boolean;
}

export const DataDashboard = ({
  tasks = [],
  isAggregated = false,
}: DataDashboardProps) => {
  const workspaceId = useWorkspaceId();
  const projectId = useProjectId();

  const { data: membersData } = useGetMembers({
    workspaceId,
    enabled: !isAggregated,
  });
  const { data: mySpaceMembersData } = useGetMySpaceMembers();

  const members = useMemo(() => {
    if (isAggregated)
      return ((mySpaceMembersData?.documents as unknown as Member[]) ?? []);
    return ((membersData?.documents as unknown as Member[]) ?? []);
  }, [isAggregated, membersData?.documents, mySpaceMembersData?.documents]);

  // ---- Analytics ----
  const analytics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(
      (t) => t.status === TaskStatus.DONE
    ).length;
    const inProgress = tasks.filter(
      (t) =>
        t.status === TaskStatus.IN_PROGRESS ||
        t.status === TaskStatus.IN_REVIEW
    ).length;
    const pending = total - completed;
    const flagged = tasks.filter((t) => t.flagged === true).length;
    const now = new Date();
    const overdue = tasks.filter((t) => {
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < now && t.status !== TaskStatus.DONE;
    }).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      pending,
      flagged,
      overdue,
      rate,
    };
  }, [tasks]);

  // ---- Status pie chart ----
  const statusOverview = useMemo(() => {
    const todo = tasks.filter((t) => t.status === TaskStatus.TODO).length;
    const assigned = tasks.filter(
      (t) => t.status === TaskStatus.ASSIGNED
    ).length;
    const inProgress = tasks.filter(
      (t) => t.status === TaskStatus.IN_PROGRESS
    ).length;
    const inReview = tasks.filter(
      (t) => t.status === TaskStatus.IN_REVIEW
    ).length;
    const done = tasks.filter((t) => t.status === TaskStatus.DONE).length;

    return [
      { name: "Done", count: done },
      { name: "In Progress", count: inProgress },
      { name: "In Review", count: inReview },
      { name: "To Do", count: todo },
      { name: "Assigned", count: assigned },
    ].filter((s) => s.count > 0);
  }, [tasks]);

  const statusTotal = useMemo(
    () => statusOverview.reduce((a, s) => a + s.count, 0),
    [statusOverview]
  );

  // ---- Priority bar chart ----
  const priorityDistribution = useMemo(
    () => [
      {
        name: "URGENT",
        count: tasks.filter((t) => t.priority === TaskPriority.URGENT).length,
      },
      {
        name: "HIGH",
        count: tasks.filter((t) => t.priority === TaskPriority.HIGH).length,
      },
      {
        name: "MEDIUM",
        count: tasks.filter((t) => t.priority === TaskPriority.MEDIUM).length,
      },
      {
        name: "LOW",
        count: tasks.filter((t) => t.priority === TaskPriority.LOW).length,
      },
    ],
    [tasks]
  );

  // ---- Due alerts ----
  const dueAlerts = useMemo(() => {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return tasks
      .filter((t) => {
        if (!t.dueDate || t.status === TaskStatus.DONE) return false;
        const d = new Date(t.dueDate);
        return d >= now && d <= nextWeek;
      })
      .sort(
        (a, b) =>
          new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
      )
      .slice(0, 6)
      .map((t) => ({
        id: t.$id,
        title: t.name || t.title,
        dueDate: new Date(t.dueDate!),
      }));
  }, [tasks]);

  // ---- Recent tasks ----
  const recentTasks = useMemo(() => {
    return [...tasks]
      .sort(
        (a, b) =>
          new Date(b.$updatedAt || b.$createdAt).getTime() -
          new Date(a.$updatedAt || a.$createdAt).getTime()
      )
      .slice(0, 6)
      .map((task) => {
        const assignees = (task as Record<string, unknown>).assignees as
          | {
              name?: string;
              email?: string;
              profileImageUrl?: string;
            }[]
          | undefined;
        const firstAssignee = assignees?.[0];

        let assigneeName = "Unassigned";
        let assigneeImage: string | null = null;

        if (firstAssignee) {
          assigneeName =
            firstAssignee.name || firstAssignee.email || "Unknown";
          assigneeImage = firstAssignee.profileImageUrl || null;
        } else if (task.assigneeIds && task.assigneeIds.length > 0) {
          const member = members.find(
            (m) =>
              m.$id === task.assigneeIds![0] ||
              (m as Record<string, unknown>).userId === task.assigneeIds![0]
          );
          if (member) {
            assigneeName = member.name || "Unknown";
            assigneeImage = member.profileImageUrl || null;
          }
        } else if (task.assigneeId) {
          const member = members.find(
            (m) =>
              m.$id === task.assigneeId ||
              (m as Record<string, unknown>).userId === task.assigneeId
          );
          if (member) {
            assigneeName = member.name || "Unknown";
            assigneeImage = member.profileImageUrl || null;
          }
        }

        const projectName =
          ((task as Record<string, unknown>).project as Record<string, unknown>)
            ?.name as string || "";

        return {
          id: task.$id,
          title: task.name || task.title,
          status:
            task.status === TaskStatus.DONE
              ? "Completed"
              : task.status === TaskStatus.IN_PROGRESS ||
                  task.status === TaskStatus.IN_REVIEW
                ? "In Progress"
                : "To Do",
          assignee: assigneeName,
          assigneeImage,
          priority: task.priority || "MEDIUM",
          dueDate: task.dueDate ? new Date(task.dueDate) : null,
          project: projectName,
        };
      });
  }, [tasks, members]);

  // ---- Workload per member ----
  const workload = useMemo(() => {
    return members
      .map((m) => {
        const memberTasks = tasks.filter(
          (t) =>
            t.assigneeId === m.$id || t.assigneeIds?.includes(m.$id)
        );
        const done = memberTasks.filter(
          (t) => t.status === TaskStatus.DONE
        ).length;
        return {
          id: m.$id,
          name: m.name || m.email || "Unknown",
          imageUrl: m.profileImageUrl,
          tasks: memberTasks.length,
          completed: done,
        };
      })
      .filter((m) => m.tasks > 0)
      .sort((a, b) => b.tasks - a.tasks)
      .slice(0, 5);
  }, [tasks, members]);

  // ======================= RENDER =======================
  return (
    <div className="space-y-6 pb-4">
      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <Card className="relative overflow-hidden border-border/50 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Total Tasks
              </p>
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Layers className="h-4 w-4 text-blue-500" />
              </div>
            </div>
            <p className="text-3xl font-bold mt-2 tracking-tight">
              {analytics.total}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.rate}% completion rate
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500/10">
              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: "100%" }} />
            </div>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card className="relative overflow-hidden border-border/50 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Pending
              </p>
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
            </div>
            <p className="text-3xl font-bold mt-2 tracking-tight text-amber-600 dark:text-amber-400">
              {analytics.pending}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.total > 0
                ? Math.round((analytics.pending / analytics.total) * 100)
                : 0}
              % of total
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500/10">
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{
                  width: `${analytics.total > 0 ? (analytics.pending / analytics.total) * 100 : 0}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Completed */}
        <Card className="relative overflow-hidden border-border/50 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Completed
              </p>
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
            <p className="text-3xl font-bold mt-2 tracking-tight text-emerald-600 dark:text-emerald-400">
              {analytics.completed}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.rate}% done
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500/10">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${analytics.rate}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Flagged / Overdue */}
        <Card className="relative overflow-hidden border-border/50 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Flagged
              </p>
              <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Flag className="h-4 w-4 text-red-500" />
              </div>
            </div>
            <p className="text-3xl font-bold mt-2 tracking-tight text-red-600 dark:text-red-400">
              {analytics.flagged}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.overdue > 0 ? (
                <span className="text-red-500">{analytics.overdue} overdue</span>
              ) : (
                "No overdue tasks"
              )}
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500/10">
              <div
                className="h-full bg-red-500 transition-all duration-500"
                style={{
                  width: `${analytics.total > 0 ? Math.min((analytics.overdue / analytics.total) * 100, 100) : 0}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Status Donut */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusOverview.length > 0 ? (
              <div className="flex flex-col items-center">
                <div className="h-[200px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={statusOverview}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {statusOverview.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={STATUS_COLORS[entry.name] || "#6b7280"}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          color: "hsl(var(--foreground))",
                        }}
                        itemStyle={{ color: "hsl(var(--foreground))" }}
                        formatter={(value: number, name: string) => [
                          `${value} tasks`,
                          name,
                        ]}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {analytics.rate}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Complete
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">
                  {statusOverview.map((s) => (
                    <div key={s.name} className="flex items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            STATUS_COLORS[s.name] || "#6b7280",
                        }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {s.name}{" "}
                        <span className="font-medium text-foreground">
                          {statusTotal > 0
                            ? Math.round((s.count / statusTotal) * 100)
                            : 0}
                          %
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[260px] flex flex-col items-center justify-center text-sm text-muted-foreground">
                <div className="h-16 w-16 rounded-full border-4 border-dashed border-muted mb-3" />
                <p>No status data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Priority Bar Chart */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Priority Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart
                  data={priorityDistribution}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      color: "hsl(var(--foreground))",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {priorityDistribution.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={PRIORITY_COLORS[entry.name] || "#6b7280"}
                      />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">
              {priorityDistribution.map((p) => (
                <div key={p.name} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        PRIORITY_COLORS[p.name] || "#6b7280",
                    }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {p.name}{" "}
                    <span className="font-medium text-foreground">
                      {p.count}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Activity Log */}
        <ProjectActivityLogWidget
          workspaceId={workspaceId}
          projectId={isAggregated ? undefined : projectId}
          isAggregated={isAggregated}
          limit={6}
        />
      </div>

      {/* ── Recent Tasks + Sidebar ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Task table — 2 cols */}
        <Card className="xl:col-span-2 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Recent Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Header */}
            <div className="grid grid-cols-12 gap-3 pb-2 border-b border-border/50 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <div className="col-span-5">Task</div>
              <div className="col-span-2">Project</div>
              <div className="col-span-2">Due</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1">Priority</div>
            </div>

            <div className="divide-y divide-border/30">
              {recentTasks.length > 0 ? (
                recentTasks.map((task) => (
                  <div
                    key={task.id}
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
                      <span className="text-sm text-muted-foreground truncate block">
                        {task.project || "—"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm text-muted-foreground">
                        {task.dueDate
                          ? format(task.dueDate, "MMM d")
                          : "—"}
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
                  </div>
                ))
              ) : (
                <div className="py-12 text-center">
                  <Layers className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No tasks yet
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    Create your first task to get started
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right sidebar — deadlines + workload */}
        <div className="space-y-4">
          {/* Upcoming Deadlines */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dueAlerts.length > 0 ? (
                <div className="space-y-1">
                  {dueAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {alert.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(alert.dueDate, {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
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

          {/* Workload */}
          {workload.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Workload
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {workload.map((m) => {
                    const pct =
                      analytics.total > 0
                        ? (m.tasks / analytics.total) * 100
                        : 0;
                    return (
                      <div key={m.id} className="flex items-center gap-3">
                        <MemberAvatar
                          name={m.name}
                          imageUrl={m.imageUrl}
                          className="h-7 w-7 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">
                              {m.name}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {m.completed}/{m.tasks}
                            </span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Bottom Row — Team Members ── */}
      <ProjectMembersWidget
        workspaceId={workspaceId}
        projectId={isAggregated ? undefined : projectId}
        isAggregated={isAggregated}
        limit={12}
      />
    </div>
  );
};