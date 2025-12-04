"use client"
import { PageError } from "@/components/page-error"
import { PageLoader } from "@/components/page-loader"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

import { useGetMembers } from "@/features/members/api/use-get-members"
import { MemberAvatar } from "@/features/members/components/member-avatar"
import type { Member } from "@/features/members/types"
import { useGetProjects } from "@/features/projects/api/use-get-projects"
import { useGetTeams } from "@/features/teams/api/use-get-teams"
import { ProjectAvatar } from "@/features/projects/components/project-avatar"
import { useCreateProjectModal } from "@/features/projects/hooks/use-create-project-modal"
import type { Project } from "@/features/projects/types"
import { useGetTasks } from "@/features/tasks/api/use-get-tasks"
import { useCreateTaskModal } from "@/features/tasks/hooks/use-create-task-modal"
import type { Task } from "@/features/tasks/types"
import { TaskStatus, TaskPriority } from "@/features/tasks/types"
import { useGetWorkspaceAnalytics } from "@/features/workspaces/api/use-get-workspace-analytics"
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id"
import { useCurrentMember } from "@/features/members/hooks/use-current-member"

import { formatDistanceToNow } from "date-fns"
import {
  CalendarIcon,
  PlusIcon,
  SettingsIcon,
  AlertCircle,
  Users,
  UsersRound,
  CheckCircle2,
  Clock,
  ListTodo,
  Flag,
  BarChart3,
  Layers,
  FolderKanban,
  ExternalLink,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip,
  CartesianGrid,
} from "recharts"

export const WorkspaceIdClient = () => {
  const workspaceId = useWorkspaceId()
  const { data: analytics, isLoading: isLoadingAnalytics } = useGetWorkspaceAnalytics({ workspaceId })
  const { data: tasks, isLoading: isLoadingTasks } = useGetTasks({ workspaceId })
  const { data: projects, isLoading: isLoadingProjects } = useGetProjects({ workspaceId })
  const { data: members, isLoading: isLoadingMembers } = useGetMembers({ workspaceId })
  const { data: teams, isLoading: isLoadingTeams } = useGetTeams({ workspaceId })

  const isLoading = isLoadingAnalytics || isLoadingTasks || isLoadingProjects || isLoadingMembers || isLoadingTeams

  // Calculate dynamic data from real tasks
  const dynamicData = useMemo(() => {
    if (!tasks?.documents || !members?.documents) {
      return {
        statusOverview: [],
        priorityDistribution: [],
        memberWorkload: [],
        recentTasks: [],
        dueSoonTasks: [],
        completionRate: 0,
        flaggedCount: 0,
        contributionData: [],
      }
    }

    const taskDocs = tasks.documents
    const memberDocs = members.documents

    // Status overview for pie chart
    const statusCounts = {
      completed: taskDocs.filter(t => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.CLOSED).length,
      inProgress: taskDocs.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      assigned: taskDocs.filter(t => t.status === TaskStatus.ASSIGNED).length,
    }

    const statusOverview = [
      { id: "completed", name: "Completed", value: statusCounts.completed, color: "#22c55e" },
      { id: "in-progress", name: "In Progress", value: statusCounts.inProgress, color: "#2663ec" },
      { id: "assigned", name: "Assigned", value: statusCounts.assigned, color: "#93c5fd" },
    ]

    // Completion rate
    const completionRate = taskDocs.length > 0 
      ? Math.round((statusCounts.completed / taskDocs.length) * 100) 
      : 0

    // Flagged count
    const flaggedCount = taskDocs.filter(t => t.flagged === true).length

    // Priority distribution for bar chart
    const priorityDistribution = [
      { name: "URGENT", count: taskDocs.filter(t => t.priority === TaskPriority.URGENT).length, fill: "#ef4444" },
      { name: "HIGH", count: taskDocs.filter(t => t.priority === TaskPriority.HIGH).length, fill: "#f97316" },
      { name: "MEDIUM", count: taskDocs.filter(t => t.priority === TaskPriority.MEDIUM).length, fill: "#f59e0b" },
      { name: "LOW", count: taskDocs.filter(t => t.priority === TaskPriority.LOW).length, fill: "#22c55e" },
    ]

    // Member workload
    const memberWorkload = memberDocs.map(member => {
      const memberTasks = taskDocs.filter(t => 
        t.assigneeId === member.$id || t.assigneeIds?.includes(member.$id)
      )
      const completedTasks = memberTasks.filter(t => 
        t.status === TaskStatus.COMPLETED || t.status === TaskStatus.CLOSED
      ).length

      return {
        id: member.$id,
        name: member.name || member.email || "Unknown",
        avatar: (member.name || member.email || "U").substring(0, 2).toUpperCase(),
        imageUrl: member.profileImageUrl,
        tasks: memberTasks.length,
        completedTasks,
      }
    }).filter(m => m.tasks > 0).sort((a, b) => b.tasks - a.tasks).slice(0, 4)

    // Contribution data - tasks completed per member (for GitHub-style graph)
    const contributionData = memberDocs.map(member => {
      const memberTasks = taskDocs.filter(t => 
        t.assigneeId === member.$id || t.assigneeIds?.includes(member.$id)
      )
      const completedTasks = memberTasks.filter(t => 
        t.status === TaskStatus.COMPLETED || t.status === TaskStatus.CLOSED
      ).length

      return {
        id: member.$id,
        name: member.name || member.email?.split('@')[0] || "Unknown",
        imageUrl: member.profileImageUrl,
        completed: completedTasks,
        total: memberTasks.length,
      }
    }).filter(m => m.total > 0).sort((a, b) => b.completed - a.completed).slice(0, 6)

    // Recent tasks
    const recentTasks = [...taskDocs]
      .sort((a, b) => new Date(b.$updatedAt).getTime() - new Date(a.$updatedAt).getTime())
      .slice(0, 5)
      .map(task => {
        const member = memberDocs.find(m => m.$id === task.assigneeId)
        return {
          id: task.$id,
          title: task.name,
          status: task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CLOSED ? "Done" :
                  task.status === TaskStatus.IN_PROGRESS ? "In Progress" : "To Do",
          assignee: member?.name?.split(' ').map(n => n[0]).join('') || "N/A",
          priority: task.priority || "MEDIUM",
          projectName: task.project?.name,
        }
      })

    // Due soon tasks
    const now = new Date()
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const dueSoonTasks = taskDocs
      .filter(task => {
        if (!task.dueDate || task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CLOSED) return false
        const dueDate = new Date(task.dueDate)
        return dueDate >= now && dueDate <= weekFromNow
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 6)
      .map(t => ({
        id: t.$id,
        title: t.name,
        dueDate: new Date(t.dueDate),
      }))

    return {
      statusOverview,
      priorityDistribution,
      memberWorkload,
      recentTasks,
      dueSoonTasks,
      completionRate,
      flaggedCount,
      contributionData,
    }
  }, [tasks, members])

  if (isLoading) {
    return <PageLoader />
  }

  if (!analytics || !tasks || !projects || !members || !teams) {
    return <PageError message="Failed to load workspace data." />
  }

  return (

    <div className="h-full flex flex-col space-y-4 p-6 bg-background">
      {/* Header with Filter */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Workspace Dashboard</h1>
        <div className="relative">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilterModal(!showFilterModal)}
            className="rounded-lg hover:bg-muted transition-all duration-200 bg-transparent h-9 w-9 hover:scale-105 active:scale-95"
          >
            <FilterIcon className="size-5" />
          </Button>

          {showFilterModal && (
            <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Filters</h3>
                <button
                  onClick={() => {
                    setShowFilterModal(false)
                    setActiveFilterCategory(null)
                  }}
                  className="text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-110 active:scale-95"
                >
                  <XIcon className="size-4" />
                </button>
              </div>

              {activeFilterCategory === null ? (
                <div className="space-y-1">
                  {filterCategories.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setActiveFilterCategory(filter.id)}
                      className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted rounded-lg transition-all duration-200 flex items-center justify-between group active:scale-95"
                    >
                      <span>{filter.name}</span>
                      <span className="text-muted-foreground group-hover:text-foreground transition-all duration-200 group-hover:translate-x-1">
                        →
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="animate-in fade-in duration-200">
                  <button
                    onClick={() => setActiveFilterCategory(null)}
                    className="flex items-center gap-2 mb-3 text-sm text-muted-foreground hover:text-foreground transition-all duration-200 hover:-translate-x-1 active:scale-95"
                  >
                    <span>←</span>
                    <span>Back</span>
                  </button>

                  {activeFilterCategory === "filter-1" ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <SearchIcon className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search assignees..."
                          value={searchAssignee}
                          onChange={(e) => setSearchAssignee(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                        />
                      </div>

    <div className="space-y-3 p-4">
      {/* Analytics Cards - Matching Project Dashboard Style */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Total Tasks</p>
              <p className="text-xl font-semibold">{analytics.taskCount}</p>
            </div>
            <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded">
              <ListTodo className="h-4 w-4 text-[#2663ec]" />
            </div>
          </div>
          <div className="mt-2">
            <Progress 
              value={dynamicData.completionRate} 
              className="h-1 bg-blue-100 dark:bg-blue-900 [&>div]:bg-[#2663ec]" 
            />
          </div>
        </Card>


        <Card className="p-3">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-xl font-semibold">{analytics.completedTaskCount}</p>
            </div>
            <div className="p-2 bg-green-50 dark:bg-green-950 rounded">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-[11px] text-muted-foreground">
              {dynamicData.completionRate}% completion rate
            </p>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">In Progress</p>
              <p className="text-xl font-semibold">{analytics.incompleteTaskCount}</p>
            </div>
            <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded">
              <Clock className="h-4 w-4 text-[#2663ec]" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-[11px] text-muted-foreground">
              Active tasks
            </p>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Flagged</p>
              <p className="text-xl font-semibold">{dynamicData.flaggedCount}</p>
            </div>
            <div className="p-2 bg-red-50 dark:bg-red-950 rounded">
              <Flag className="h-4 w-4 text-red-500" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-[11px] text-muted-foreground">
              Needs attention
            </p>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="text-xl font-semibold">{analytics.overdueTaskCount}</p>
            </div>
            <div className="p-2 bg-amber-50 dark:bg-amber-950 rounded">
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-[11px] text-muted-foreground">
              Past due date
            </p>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Teams</p>
              <p className="text-xl font-semibold">{teams.total}</p>
            </div>
            <div className="p-2 bg-purple-50 dark:bg-purple-950 rounded">
              <UsersRound className="h-4 w-4 text-purple-500" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-[11px] text-muted-foreground">
              Active teams
            </p>
          </div>
        </Card>
      </div>

      {/* Top Row - Status Overview & Due Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-muted-foreground">Status Overview</h3>
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          {dynamicData.statusOverview.some(s => s.value > 0) ? (
            <>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={dynamicData.statusOverview.filter(s => s.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={65}
                    >
                      {dynamicData.statusOverview.filter(s => s.value > 0).map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {dynamicData.statusOverview.map((status) => (
                  <div key={status.id} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
                    <span className="text-[11px] text-muted-foreground">{status.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
              No tasks yet
            </div>
          )}
        </Card>

        {/* Due Alerts & Recent Tasks */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-muted-foreground">Due Alerts</h3>
              <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {dynamicData.dueSoonTasks.length > 0 ? (
                dynamicData.dueSoonTasks.map((alert) => (
                  <Link
                    key={alert.id}
                    href={`/workspaces/${workspaceId}/tasks/${alert.id}`}
                    className="flex items-center justify-between p-2 bg-secondary/10 rounded-md hover:bg-secondary/20 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="h-3.5 w-3.5 text-[#2663ec] flex-shrink-0" />
                      <span className="text-xs font-medium truncate">{alert.title}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap ml-2">
                      {formatDistanceToNow(alert.dueDate, { addSuffix: true })}
                    </span>
                  </Link>
                ))
              ) : (
                <div className="col-span-2 text-sm text-center text-muted-foreground py-2">
                  No upcoming due dates
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-muted-foreground">Recent Tasks</h3>
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              {dynamicData.recentTasks.length > 0 ? (
                dynamicData.recentTasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/workspaces/${workspaceId}/tasks/${task.id}`}
                    className="flex items-center justify-between p-2 bg-secondary/10 rounded-md hover:bg-secondary/20 transition-colors"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <div className={`w-1.5 h-1.5 mt-1.5 rounded-full flex-shrink-0 ${
                        task.status === "Done" ? "bg-green-500" :
                        task.status === "In Progress" ? "bg-[#2663ec]" : "bg-gray-400"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">{task.assignee}</span>
                          <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                            task.priority === "HIGH" || task.priority === "URGENT" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" :
                            task.priority === "MEDIUM" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" :
                            "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                          }`}>
                            {task.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-sm text-center text-muted-foreground py-4">
                  No tasks yet
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Middle Row - Workload & Priority Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-muted-foreground">Workload Distribution</h3>
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {dynamicData.memberWorkload.length > 0 ? (
              dynamicData.memberWorkload.map((member) => {
                const workloadPercentage = analytics.taskCount > 0 ? (member.tasks / analytics.taskCount) * 100 : 0
                return (
                  <div key={member.id} className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <MemberAvatar
                        name={member.name}
                        imageUrl={member.imageUrl}
                        className="size-6"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium truncate">{member.name}</p>
                          <span className="text-[11px] text-muted-foreground">{member.tasks} tasks</span>
                        </div>
                        <Progress value={workloadPercentage} className="h-1.5 mt-1.5 bg-blue-100 dark:bg-blue-900 [&>div]:bg-[#2663ec]" />
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-sm text-center text-muted-foreground py-4">
                No assigned tasks yet
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-muted-foreground">Priority Distribution</h3>
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart
                data={dynamicData.priorityDistribution}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11 }}
                  stroke="#888"
                />
                <YAxis 
                  tick={{ fontSize: 11 }}
                  stroke="#888"
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                  cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                />
                <Bar 
                  dataKey="count" 
                  radius={[4, 4, 0, 0]}
                  maxBarSize={60}
                />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Top Contributors - GitHub-style contribution display */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-muted-foreground">Top Contributors</h3>
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        {dynamicData.contributionData.length > 0 ? (
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart
                data={dynamicData.contributionData}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#888" allowDecimals={false} />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fontSize: 11 }} 
                  stroke="#888"
                  width={80}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                  cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                  formatter={(value: number, name: string) => {
                    if (name === 'completed') return [value, 'Completed']
                    if (name === 'total') return [value, 'Total']
                    return [value, name]
                  }}
                />
                <Bar 
                  dataKey="completed" 
                  fill="#22c55e"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                  name="Completed"
                />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
            No completed tasks yet
          </div>
        )}
      </Card>

      {/* Bottom Row - Tasks, Projects, Members */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <TaskList data={tasks.documents} total={tasks.total} />
        <ProjectList data={projects.documents} total={projects.total} />
        <MemberList data={members.documents} total={members.total} />
      </div>
    </div>
  )
}

interface TaskListProps {
  data: Task[]
  total: number
}

export const TaskList = ({ data, total }: TaskListProps) => {
  const workspaceId = useWorkspaceId()
  const { open: createTask } = useCreateTaskModal()
  const { isAdmin } = useCurrentMember({ workspaceId })

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-medium text-muted-foreground">Tasks ({total})</h3>
        </div>
        {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            onClick={createTask}
            className="h-6 w-6"
          >
            <PlusIcon className="size-3" />
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {data.slice(0, 5).map((task) => (
          <Link
            key={task.$id}
            href={`/workspaces/${workspaceId}/tasks/${task.$id}`}
            className="flex items-center justify-between p-2 bg-secondary/10 rounded-md hover:bg-secondary/20 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{task.name}</p>
              <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                <span className="truncate">{task.project?.name}</span>
                {task.dueDate && (
                  <>
                    <span>•</span>
                    <CalendarIcon className="size-2.5" />
                    <span>{formatDistanceToNow(new Date(task.dueDate))}</span>
                  </>
                )}
              </div>
            </div>
          </Link>
        ))}
        {data.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No tasks</p>
        )}
      </div>
      {data.length > 5 && (
        <Link href={`/workspaces/${workspaceId}/tasks`}>
          <Button variant="ghost" size="sm" className="w-full mt-2 h-7 text-xs gap-1">
            View All <ExternalLink className="size-3" />
          </Button>
        </Link>
      )}
    </Card>
  )
}

interface ProjectListProps {
  data: Project[]
  total: number
}

export const ProjectList = ({ data, total }: ProjectListProps) => {
  const workspaceId = useWorkspaceId()
  const { open: createProject } = useCreateProjectModal()
  const { isAdmin } = useCurrentMember({ workspaceId })

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-medium text-muted-foreground">Projects ({total})</h3>
        </div>
        {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            onClick={createProject}
            className="h-6 w-6"
          >
            <PlusIcon className="size-3" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {data.slice(0, 4).map((project) => (
          <Link
            key={project.$id}
            href={`/workspaces/${workspaceId}/projects/${project.$id}`}
            className="flex flex-col items-center gap-2 p-3 bg-secondary/10 rounded-md hover:bg-secondary/20 transition-colors"
          >
            <ProjectAvatar
              name={project.name}
              image={project.imageUrl}
              className="size-8"
              fallbackClassName="text-xs"
            />
            <p className="text-xs font-medium text-center truncate w-full">{project.name}</p>
          </Link>
        ))}
        {data.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4 col-span-2">No projects</p>
        )}
      </div>
      {data.length > 4 && (
        <Link href={`/workspaces/${workspaceId}/projects`}>
          <Button variant="ghost" size="sm" className="w-full mt-2 h-7 text-xs gap-1">
            View All <ExternalLink className="size-3" />
          </Button>
        </Link>
      )}
    </Card>
  )
}

interface MemberListProps {
  data: Member[]
  total: number
}

export const MemberList = ({ data, total }: MemberListProps) => {
  const workspaceId = useWorkspaceId()

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-medium text-muted-foreground">Members ({total})</h3>
        </div>
        <Link href={`/workspaces/${workspaceId}/members`}>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <SettingsIcon className="size-3" />
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {data.slice(0, 4).map((member) => {
          const displayName = member.name?.trim() || member.email || "Unknown"
          return (
            <div
              key={member.$id}
              className="flex flex-col items-center gap-2 p-3 bg-secondary/10 rounded-md"
            >
              <MemberAvatar
                name={displayName}
                className="size-8"
                imageUrl={member.profileImageUrl}
              />
              <div className="text-center w-full overflow-hidden">
                <p className="text-xs font-medium truncate">{displayName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{member.role}</p>
              </div>
            </div>
          )
        })}
        {data.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4 col-span-2">No members</p>
        )}
      </div>
      {data.length > 4 && (
        <Link href={`/workspaces/${workspaceId}/members`}>
          <Button variant="ghost" size="sm" className="w-full mt-2 h-7 text-xs gap-1">
            View All <ExternalLink className="size-3" />
          </Button>
        </Link>
      )}
    </Card>
  )
}
