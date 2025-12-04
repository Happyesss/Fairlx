"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Activity,
  CheckCircle2,
  Clock,
  ListTodo,
  AlertCircle,
  Plus,
  ChevronRight,
  ChevronDown,
  Flame,
  TrendingUp,
  MessageSquare,
  GitBranch,
  Loader2,
  Settings,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id"
import { useGetWorkspaces } from "@/features/workspaces/api/use-get-workspaces"
import { useGetProjects } from "@/features/projects/api/use-get-projects"
import { useGetSprints } from "@/features/sprints/api/use-get-sprints"
import { useGetTasks } from "@/features/tasks/api/use-get-tasks"
import { useGetMembers } from "@/features/members/api/use-get-members"
import { useCurrent } from "@/features/auth/api/use-current"
import { useCreateTaskModal } from "@/features/tasks/hooks/use-create-task-modal"
import { TaskStatus } from "@/features/tasks/types"
import { formatDistanceToNow } from "date-fns"
import { SprintStatus } from "@/features/sprints/types"
import { useCreateProjectModal } from "@/features/projects/hooks/use-create-project-modal"
import { useCreateWorkspaceModal } from "@/features/workspaces/hooks/use-create-workspace-modal"

interface MySpaceDashboardProps {
  className?: string
}

// Helper function to get calendar days for current month
const getCalendarDays = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay()

  const days = []
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }
  return days
}

// Helper function to get current month/year name
const getCurrentMonthYear = () => {
  const now = new Date()
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"]
  return `${monthNames[now.getMonth()]} ${now.getFullYear()}`
}

// Mock data for sections without backend data
const mockData = {
  burndownData: [
    { day: "Mon", tasks: 28 },
    { day: "Tue", tasks: 24 },
    { day: "Wed", tasks: 20 },
    { day: "Thu", tasks: 18 },
    { day: "Fri", tasks: 10 },
  ],
}

export const MySpaceDashboard = ({ className = "" }: MySpaceDashboardProps) => {
  const router = useRouter()
  const workspaceId = useWorkspaceId()
  const { data: user } = useCurrent()
  const { data: workspacesData, isLoading: isLoadingWorkspaces } = useGetWorkspaces()
  const { data: projectsData, isLoading: isLoadingProjects } = useGetProjects({ workspaceId })
  const { data: sprintsData, isLoading: isLoadingSprints } = useGetSprints({
    workspaceId,
    projectId: projectsData?.documents?.[0]?.$id || "",
    status: SprintStatus.ACTIVE,
  })
  const { data: membersData } = useGetMembers({ workspaceId })
  const { data: tasksData, isLoading: isLoadingTasks } = useGetTasks({
    workspaceId,
    assigneeId: user?.$id,
  })
  const { open: openCreateTaskModal } = useCreateTaskModal()

  const calendarDays = getCalendarDays()
  const today = new Date().getDate()
  const [expandTeamActivity, setExpandTeamActivity] = useState(true)

  // Calculate real analytics from tasks
  const analytics = useMemo(() => {
    const tasks = tasksData?.documents ?? []
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.CLOSED).length
    const inProgressTasks = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length
    const blockedTasks = tasks.filter(t => t.status === "BLOCKED").length
    const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      blockedTasks,
      completionPercentage,
    }
  }, [tasksData])

  // Calculate task status distribution
  const tasksByStatus = useMemo(() => {
    const tasks = tasksData?.documents ?? []
    const completed = tasks.filter(t => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.CLOSED).length
    const inProgress = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length
    const assigned = tasks.filter(t => t.status === TaskStatus.ASSIGNED).length

    return [
      { name: "Completed", value: completed, color: "#22c55e" },
      { name: "In Progress", value: inProgress, color: "#2663ec" },
      { name: "Assigned", value: assigned, color: "#f59e0b" },
    ].filter(s => s.value > 0)
  }, [tasksData])

  // Calculate due alerts from real tasks
  const dueAlerts = useMemo(() => {
    const tasks = tasksData?.documents ?? []
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    return tasks
      .filter(t => {
        if (!t.dueDate || t.status === TaskStatus.COMPLETED || t.status === TaskStatus.CLOSED) return false
        const dueDate = new Date(t.dueDate)
        return dueDate <= tomorrow
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 2)
      .map(t => {
        const dueDate = new Date(t.dueDate)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        dueDate.setHours(0, 0, 0, 0)

        let dueLabel = "Tomorrow"
        if (dueDate.getTime() === today.getTime()) {
          dueLabel = "Today"
        } else if (dueDate.getTime() < today.getTime()) {
          dueLabel = "Overdue"
        }

        return {
          id: t.$id,
          title: t.name,
          dueDate: dueLabel,
          priority: (t.priority || "MEDIUM").toLowerCase(),
        }
      })
  }, [tasksData])

  // Get recent activity from tasks
  const teamActivity = useMemo(() => {
    const tasks = tasksData?.documents ?? []
    const members = membersData?.documents ?? []

    return tasks
      .slice(0, 4)
      .map(task => {
        const assignee = members.find(m => m.$id === task.assigneeId)
        const timeAgo = formatDistanceToNow(new Date(task.$createdAt), { addSuffix: true })

        return {
          id: task.$id,
          user: assignee?.name ?? "Unknown",
          action: "created",
          item: task.name,
          type: "task",
          time: timeAgo,
        }
      })
  }, [tasksData, membersData])

  // Get active sprint data
  const activeSprint = useMemo(() => {
    const sprints = sprintsData?.documents ?? []
    const sprint = sprints.find(s => s.status === SprintStatus.ACTIVE)

    if (!sprint) return null

    const sprintTasks = tasksData?.documents?.filter(t => t.$id) ?? []
    const completedSprintTasks = sprintTasks.filter(t => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.CLOSED).length

    return {
      name: sprint.name,
      totalTasks: sprintTasks.length || 0,
      completedTasks: completedSprintTasks,
      pendingTasks: Math.max(0, (sprintTasks.length || 0) - completedSprintTasks),
      goal: sprint.goal || "No goal set",
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    }
  }, [sprintsData, tasksData])

  // Get workspaces
  const workspaces = useMemo(() => {
    const ws = workspacesData?.documents ?? []
    return ws.map(workspace => ({
      id: workspace.$id,
      name: workspace.name,
      members: 0,
      projects: 0,
      imageUrl: workspace.imageUrl,
    }))
  }, [workspacesData])

  // Get projects with task counts
  const projects = useMemo(() => {
    const prjs = projectsData?.documents ?? []
    const tasks = tasksData?.documents ?? []

    return prjs.map(project => {
      const projectTasks = tasks.filter(t => t.projectId === project.$id)
      const completedTasks = projectTasks.filter(t => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.CLOSED).length
      const progress = projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : 0

      return {
        id: project.$id,
        name: project.name,
        progress,
        tasks: projectTasks.length,
        imageUrl: project.imageUrl,
      }
    })
  }, [projectsData, tasksData])

  const userName = user?.name?.split(' ')[0] ?? "User"

  const { open: openCreateProjectModal } = useCreateProjectModal();
  const { open: openCreateWorkspaceModal } = useCreateWorkspaceModal();

  return (
    <div className={`h-full flex flex-col ${className}`}>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="space-y-4">


          {/* Top Stats Row - Ultra Compact */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total", value: analytics.totalTasks, icon: ListTodo, color: "bg-blue-50", iconColor: "text-blue-600" },
              { label: "Completed", value: analytics.completedTasks, icon: CheckCircle2, color: "bg-green-50", iconColor: "text-green-600" },
              { label: "In Progress", value: analytics.inProgressTasks, icon: Clock, color: "bg-amber-50", iconColor: "text-amber-600" },
              { label: "Blocked", value: analytics.blockedTasks, icon: AlertCircle, color: "bg-red-50", iconColor: "text-red-600" },
            ].map((stat, idx) => {
              const Icon = stat.icon
              return (
                <Card key={idx} className="p-3 border border-gray-200 bg-white rounded-xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-600 font-semibold truncate">{stat.label}</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-2 rounded-lg flex-shrink-0 ${stat.color}`}>
                      <Icon className={`h-5 w-5 ${stat.iconColor}`} />
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Recent Activity & My Tasks - One Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Activity */}
            <Card className="p-5 border border-gray-200 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-600" />
                  Recent Activity
                </h2>
                <button
                  onClick={() => setExpandTeamActivity(!expandTeamActivity)}
                  className="text-gray-600 hover:text-foreground transition-colors"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${expandTeamActivity ? "rotate-0" : "-rotate-90"}`} />
                </button>
              </div>
              {expandTeamActivity ? (
                <div>
                  {isLoadingTasks ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : teamActivity.length === 0 ? (
                    <p className="text-sm text-gray-600 py-6 text-center">No recent activity</p>
                  ) : (
                    <div className="space-y-3">
                      {teamActivity.map((activity: any) => {
                        const getActivityIcon = (type: string) => {
                          switch (type) {
                            case "task":
                              return <ListTodo className="h-4 w-4" />
                            case "pr":
                              return <GitBranch className="h-4 w-4" />
                            case "comment":
                              return <MessageSquare className="h-4 w-4" />
                            case "status":
                              return <TrendingUp className="h-4 w-4" />
                            default:
                              return <Activity className="h-4 w-4" />
                          }
                        }

                        return (
                          <div key={activity.id} className="pb-3 border-b border-gray-100 last:border-0 last:pb-0 flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 flex-shrink-0 mt-0.5">
                              {getActivityIcon(activity.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">
                                <span className="text-blue-600 font-semibold">{activity.user}</span> {activity.action}
                              </p>
                              <p className="text-xs text-gray-600 truncate mt-0.5">{activity.item}</p>
                              <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </Card>

            {/* My Tasks */}
            <Card className="p-5 border border-gray-200 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-blue-600" />
                  My Tasks
                </h2>

              </div>
              {isLoadingTasks ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (tasksData?.documents ?? []).length === 0 ? (
                <div className="text-center py-12">
                  <ListTodo className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No tasks yet. Create one to get started!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {(tasksData?.documents ?? []).slice(0, 6).map((task: any) => (
                    <button
                      key={task.$id}
                      onClick={() => router.push(`/workspaces/${workspaceId}/tasks`)}
                      className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold text-foreground group-hover:text-blue-600 transition-colors line-clamp-2 flex-1">{task.name}</p>
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-md whitespace-nowrap flex-shrink-0 ${task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CLOSED
                            ? "bg-green-100 text-green-700"
                            : task.status === TaskStatus.IN_PROGRESS
                              ? "bg-blue-100 text-blue-700"
                              : task.status === "BLOCKED"
                                ? "bg-red-100 text-red-700"
                                : task.status === "IN_REVIEW"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-gray-100 text-gray-700"
                            }`}
                        >
                          {task.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-semibold ${task.priority === "urgent"
                          ? "text-red-600"
                          : task.priority === "high"
                            ? "text-orange-600"
                            : task.priority === "medium"
                              ? "text-yellow-600"
                              : "text-green-600"
                          }`}>
                          {task.priority}
                        </span>
                        {task.dueDate && (
                          <span className="text-gray-500">{new Date(task.dueDate).toLocaleDateString()}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Due Today Section - Full Width */}
          <Card className="p-5 border border-gray-200 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              Due Today
            </h3>
            {isLoadingTasks ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : dueAlerts.length === 0 ? (
              <p className="text-sm text-gray-600 py-6 text-center">No tasks due today 🎉</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {dueAlerts.map((alert: any) => (
                  <button
                    key={alert.id}
                    onClick={() => router.push(`/workspaces/${workspaceId}/tasks`)}
                    className="p-3 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-all text-left"
                  >
                    <p className="text-sm font-medium text-foreground line-clamp-2">{alert.title}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500">{alert.dueDate}</span>
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md ${alert.priority === "high"
                          ? "bg-red-100 text-red-700"
                          : alert.priority === "medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-green-100 text-green-700"
                          }`}
                      >
                        {alert.priority}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Main Grid - Projects & Workspaces */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Workspaces */}
            <Card className="p-5 border border-gray-200 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">Workspaces</h3>
                <Button onClick={openCreateWorkspaceModal} variant="ghost" size="sm" className="h-8 px-2 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {isLoadingWorkspaces ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : workspaces.length === 0 ? (
                <p className="text-xs text-gray-600 py-4">No workspaces yet</p>
              ) : (
                <div className="space-y-2">
                  {workspaces.map((workspace) => (
                    <button
                      key={workspace.id}
                      onClick={() => router.push(`/workspaces/${workspace.id}`)}
                      className="w-full p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{workspace.name}</p>
                          <p className="text-[11px] text-gray-500 mt-1">{workspace.members}M • {workspace.projects}P</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Projects */}
            <Card className="p-5 border border-gray-200 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">Projects</h3>
                <Button onClick={openCreateProjectModal} variant="ghost" size="sm" className="h-8 px-2 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {isLoadingProjects ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : projects.length === 0 ? (
                <p className="text-xs text-gray-600 py-4">No projects yet</p>
              ) : (
                <div className="space-y-2">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => router.push(`/workspaces/${workspaceId}/projects/${project.id}`)}
                      className="w-full p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{project.name}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Progress value={project.progress} className="h-1.5 flex-1 bg-gray-200 [&>div]:bg-blue-600" />
                            <span className="text-[11px] font-bold text-foreground whitespace-nowrap">{project.progress}%</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1.5">{project.tasks} tasks</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Sprint Summary */}
          {activeSprint ? (
            <Card className="p-5 border border-gray-200 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-600" />
                  <h3 className="text-sm font-bold text-foreground">{activeSprint.name}</h3>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                <div className="p-3 rounded-lg border border-blue-100 bg-blue-50">
                  <p className="text-[11px] text-gray-600 font-semibold">Total</p>
                  <p className="text-xl font-bold text-blue-600 mt-1">{activeSprint.totalTasks}</p>
                </div>
                <div className="p-3 rounded-lg border border-green-100 bg-green-50">
                  <p className="text-[11px] text-gray-600 font-semibold">Done</p>
                  <p className="text-xl font-bold text-green-600 mt-1">{activeSprint.completedTasks}</p>
                </div>
                <div className="p-3 rounded-lg border border-amber-100 bg-amber-50">
                  <p className="text-[11px] text-gray-600 font-semibold">Pending</p>
                  <p className="text-xl font-bold text-amber-600 mt-1">{activeSprint.pendingTasks}</p>
                </div>
                <div className="p-3 rounded-lg border border-purple-100 bg-purple-50">
                  <p className="text-[11px] text-gray-600 font-semibold">Velocity</p>
                  <p className="text-xl font-bold text-purple-600 mt-1">
                    {activeSprint.totalTasks > 0 ? Math.round((activeSprint.completedTasks / activeSprint.totalTasks) * 100) : 0}%
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-indigo-100 bg-indigo-50">
                  <p className="text-[11px] text-gray-600 font-semibold">Health</p>
                  <p className="text-xl font-bold text-indigo-600 mt-1">
                    {activeSprint.totalTasks > 0
                      ? Math.round(((activeSprint.totalTasks - activeSprint.pendingTasks) / activeSprint.totalTasks) * 100)
                      : 0}
                    %
                  </p>
                </div>
              </div>
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mockData.burndownData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "6px 10px", fontSize: "11px" }} />
                    <Line type="monotone" dataKey="tasks" stroke="#2663ec" dot={false} strokeWidth={2.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ) : null}

        </div>
      </div>
    </div>
  )
}
