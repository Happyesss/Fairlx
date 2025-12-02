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
  const monthYear = getCurrentMonthYear()

  const { open: openCreateProjectModal } = useCreateProjectModal();
  const { open: openCreateWorkspaceModal } = useCreateWorkspaceModal();

  return (
    <div className={`h-full flex flex-col ${className}`}>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="space-y-4">
          {/* Top Analytics - Ultra Compact in One Row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total", value: analytics.totalTasks, icon: ListTodo, color: "bg-blue-50", iconColor: "text-blue-600" },
              { label: "Completed", value: analytics.completedTasks, icon: CheckCircle2, color: "bg-green-50", iconColor: "text-green-600" },
              { label: "In Progress", value: analytics.inProgressTasks, icon: Clock, color: "bg-amber-50", iconColor: "text-amber-600" },
              { label: "Blocked", value: analytics.blockedTasks, icon: AlertCircle, color: "bg-red-50", iconColor: "text-red-600" },
            ].map((stat, idx) => {
              const Icon = stat.icon
              return (
                <Card key={idx} className="p-4 border border-gray-200 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-300">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] text-gray-600 font-medium truncate">{stat.label}</p>
                      <p className="text-base font-bold text-foreground mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${stat.color}`}>
                      <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Overall Progress */}
          <Card className="p-4 border border-gray-200 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-300">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-foreground">Progress</h3>
                  <span className="text-xs font-bold text-blue-600">{Math.round(analytics.completionPercentage)}%</span>
                </div>
                <Progress value={analytics.completionPercentage} className="h-2 bg-gray-200" />
              </div>
              <span className="text-xs text-gray-600 whitespace-nowrap font-medium">{analytics.completedTasks}/{analytics.totalTasks}</span>
            </div>
          </Card>

          {/* Main Grid - Balanced 2 Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Column - Workspaces & Calendar */}
            <div className="space-y-4">
              {/* Calendar */}
              <Card className="p-4 border border-gray-200 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-300">
                <h3 className="text-xs font-semibold text-foreground mb-3">{monthYear}</h3>
                <div className="grid grid-cols-7 gap-0.5">
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                    <div key={index} className="text-center text-[10px] font-semibold text-gray-600 h-5 flex items-center justify-center">
                      {day}
                    </div>
                  ))}
                  {calendarDays.map((day, idx) => (
                    <button
                      key={idx}
                      className={`text-center text-[10px] h-7 flex items-center justify-center rounded-md transition-all font-medium ${day === null
                        ? ""
                        : day === today
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "text-foreground hover:bg-gray-100 border border-gray-200 hover:border-gray-300"
                        }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </Card>

              {/* Workspaces */}
              <Card className="p-4 border border-gray-200 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-foreground">Workspaces</h3>
                  <Button onClick={openCreateWorkspaceModal} variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]">
                    <Plus className="h-3 w-3" />
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
                        className="w-full p-2.5 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-left shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{workspace.name}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{workspace.members}M • {workspace.projects}P</p>
                          </div>
                          <ChevronRight className="h-3 w-3 text-gray-400 flex-shrink-0 ml-2" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Right Column - Projects & Status */}
            <div className="space-y-4">
              {/* Task Status Pie Chart */}
              <Card className="p-4 border border-gray-200 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-300">
                <h3 className="text-xs font-semibold text-foreground mb-3">Task Analytics</h3>
                {tasksByStatus.length > 0 ? (
                  <>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={tasksByStatus}
                            dataKey="value"
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={55}
                            paddingAngle={2}
                            startAngle={90}
                            endAngle={-270}
                          >
                            {tasksByStatus.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#ffffff",
                              border: "1px solid #e5e7eb",
                              borderRadius: "8px",
                              padding: "6px 10px",
                              fontSize: "11px",
                            }}
                            formatter={(value: any) => [`${value} tasks`, "Count"]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-1.5 border-t border-gray-200 pt-3 mt-3">
                      {tasksByStatus.map((status) => (
                        <div key={status.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />
                            <span className="text-[11px] text-gray-700 font-medium">{status.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-bold text-foreground">{status.value}</span>
                            <span className="text-[10px] text-gray-500">
                              ({Math.round((status.value / analytics.totalTasks) * 100 || 0)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-48 flex items-center justify-center">
                    <p className="text-xs text-gray-600">No tasks yet</p>
                  </div>
                )}
              </Card>

              {/* Projects */}
              <Card className="p-4 border border-gray-200 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-foreground">Projects</h3>
                  <Button onClick={openCreateProjectModal} variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]">
                    <Plus className="h-3 w-3" />
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
                        className="w-full p-2.5 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-left shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{project.name}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Progress value={project.progress} className="h-1 flex-1 bg-gray-200 [&>div]:bg-blue-600" />
                              <span className="text-[10px] font-semibold text-foreground whitespace-nowrap">{project.progress}%</span>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1">{project.tasks} tasks</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* Due Alerts & Team Activity - 2 Column */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Due Alerts */}
            <Card className="p-4 border border-gray-200 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-300">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-2 mb-3">
                <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                Due Today
              </h3>
              {isLoadingTasks ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : dueAlerts.length === 0 ? (
                <p className="text-xs text-gray-600 py-4">No tasks due</p>
              ) : (
                <div className="space-y-2">
                  {dueAlerts.map((alert) => (
                    <button
                      key={alert.id}
                      onClick={() => router.push(`/workspaces/${workspaceId}/tasks/${alert.id}`)}
                      className="w-full p-2.5 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-left shadow-sm hover:shadow-md"
                    >
                      <p className="text-xs font-medium text-foreground line-clamp-2">{alert.title}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-gray-500">{alert.dueDate}</span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${alert.priority === "high"
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

            {/* Team Activity */}
            <Card className="p-4 border border-gray-200 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-300">
              <button
                onClick={() => setExpandTeamActivity(!expandTeamActivity)}
                className="w-full flex items-center justify-between hover:opacity-75 transition-opacity mb-3"
              >
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5" />
                  Team Activity
                </h3>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandTeamActivity ? "rotate-0" : "-rotate-90"}`} />
              </button>
              {expandTeamActivity && (
                <div className="space-y-2">
                  {isLoadingTasks ? (
                    <div className="flex items-center justify-center h-24">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : teamActivity.length === 0 ? (
                    <p className="text-xs text-gray-600 py-4">No recent activity</p>
                  ) : (
                    teamActivity.map((activity) => {
                      const getActivityIcon = (type: string) => {
                        switch (type) {
                          case "task":
                            return <ListTodo className="h-3 w-3" />
                          case "pr":
                            return <GitBranch className="h-3 w-3" />
                          case "comment":
                            return <MessageSquare className="h-3 w-3" />
                          case "status":
                            return <TrendingUp className="h-3 w-3" />
                          default:
                            return <Activity className="h-3 w-3" />
                        }
                      }

                      return (
                        <div key={activity.id} className="pb-1.5 border-b border-gray-200 last:border-0 last:pb-0 flex items-start gap-2.5">
                          <div className="p-1.5 rounded-md bg-gray-50 text-gray-600 flex-shrink-0 mt-0.5">
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-foreground">
                              <span className="text-blue-600">{activity.user}</span> {activity.action}
                            </p>
                            <p className="text-[10px] text-gray-600 truncate">{activity.item}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{activity.time}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Sprint Summary */}
          {activeSprint ? (
            <Card className="p-4 border border-gray-200 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-600" />
                  <h3 className="text-xs font-semibold text-foreground">{activeSprint.name}</h3>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 mb-4">
                <div className="p-2.5 rounded-lg border border-blue-100 bg-blue-50">
                  <p className="text-[10px] text-gray-600 font-medium">Total Tasks</p>
                  <p className="text-lg font-bold text-blue-600 mt-1">{activeSprint.totalTasks}</p>
                </div>
                <div className="p-2.5 rounded-lg border border-green-100 bg-green-50">
                  <p className="text-[10px] text-gray-600 font-medium">Completed</p>
                  <p className="text-lg font-bold text-green-600 mt-1">{activeSprint.completedTasks}</p>
                </div>
                <div className="p-2.5 rounded-lg border border-amber-100 bg-amber-50">
                  <p className="text-[10px] text-gray-600 font-medium">Pending</p>
                  <p className="text-lg font-bold text-amber-600 mt-1">{activeSprint.pendingTasks}</p>
                </div>
                <div className="p-2.5 rounded-lg border border-purple-100 bg-purple-50">
                  <p className="text-[10px] text-gray-600 font-medium">Velocity</p>
                  <p className="text-lg font-bold text-purple-600 mt-1">
                    {activeSprint.totalTasks > 0
                      ? Math.round((activeSprint.completedTasks / activeSprint.totalTasks) * 100)
                      : 0}
                    %
                  </p>
                </div>
                <div className="p-2.5 rounded-lg border border-indigo-100 bg-indigo-50">
                  <p className="text-[10px] text-gray-600 font-medium">Health</p>
                  <p className="text-lg font-bold text-indigo-600 mt-1">
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

          {/* Add Task Button */}
          {!isLoadingTasks && (
            <div className="flex justify-end pt-1">
              <Button
                onClick={openCreateTaskModal}
                className="!bg-[#2663ec] hover:!bg-blue-700 text-white font-medium px-5 py-1.5 text-sm rounded-xl shadow-sm hover:shadow-md transition-all"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Task
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
