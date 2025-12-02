"use client"
import { PageError } from "@/components/page-error"
import { PageLoader } from "@/components/page-loader"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { useGetMembers } from "@/features/members/api/use-get-members"
import { MemberAvatar } from "@/features/members/components/member-avatar"
import type { Member } from "@/features/members/types"
import { useGetProjects } from "@/features/projects/api/use-get-projects"
import { ProjectAvatar } from "@/features/projects/components/project-avatar"
import { useCreateProjectModal } from "@/features/projects/hooks/use-create-project-modal"
import type { Project } from "@/features/projects/types"
import { useGetTasks } from "@/features/tasks/api/use-get-tasks"
import { useCreateTaskModal } from "@/features/tasks/hooks/use-create-task-modal"
import type { Task } from "@/features/tasks/types"
import { useGetWorkspaceAnalytics } from "@/features/workspaces/api/use-get-workspace-analytics"
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id"
import { useCurrentMember } from "@/features/members/hooks/use-current-member"

import { formatDistanceToNow } from "date-fns"
import {
  CalendarIcon,
  PlusIcon,
  SettingsIcon,
  AlertCircleIcon,
  FilterIcon,
  XIcon,
  SearchIcon,
  Zap,
  Bug,
  CheckSquare,
  TrendingUp,
  Users,
  Layers,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer } from "recharts"

export const WorkspaceIdClient = () => {
  const workspaceId = useWorkspaceId()
  const { data: analytics, isLoading: isLoadingAnalytics } = useGetWorkspaceAnalytics({ workspaceId })
  const { data: tasks, isLoading: isLoadingTasks } = useGetTasks({
    workspaceId,
  })
  const { data: projects, isLoading: isLoadingProjects } = useGetProjects({
    workspaceId,
  })
  const { data: members, isLoading: isLoadingMembers } = useGetMembers({
    workspaceId,
  })

  const isLoading = isLoadingAnalytics || isLoadingTasks || isLoadingProjects || isLoadingMembers

  const [showFilterModal, setShowFilterModal] = useState(false)
  const [activeFilterCategory, setActiveFilterCategory] = useState<string | null>(null)
  const [searchAssignee, setSearchAssignee] = useState("")
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([])
  const [selectedDueDates, setSelectedDueDates] = useState<string[]>([])
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([])

  if (isLoading) {
    return <PageLoader />
  }

  if (!analytics || !tasks || !projects || !members) {
    return <PageError message="Failed to load workspace data." />
  }

  const statusOverviewData = [
    { id: "status-1", name: "Done", value: 48, color: "#10b981" },
    { id: "status-2", name: "In Progress", value: 12, color: "#3b82f6" },
    { id: "status-3", name: "To Do", value: 24, color: "#a78bfa" },
  ]

  const epicProgressData = [
    { id: "epic-1", name: "Auth System", progress: 85 },
    { id: "epic-2", name: "Dashboard", progress: 60 },
    { id: "epic-3", name: "API Integration", progress: 45 },
    { id: "epic-4", name: "Mobile App", progress: 30 },
    { id: "epic-5", name: "Payment System", progress: 72 },
  ]

  // Team workload (dummy data for now)
  const teamWorkloadData = [
    { id: "workload-1", name: "John Doe", tasksCompleted: 24, tasksTotal: 28 },
    { id: "workload-2", name: "Sarah Smith", tasksCompleted: 18, tasksTotal: 22 },
    { id: "workload-3", name: "Mike Johnson", tasksCompleted: 32, tasksTotal: 35 },
    { id: "workload-4", name: "Emma Wilson", tasksCompleted: 15, tasksTotal: 20 },
  ]

  const typesOfWorkData = [
    { id: "type-1", name: "Subtask", count: 36, total: 100, icon: CheckSquare },
    { id: "type-2", name: "Epic", count: 27, total: 100, icon: Zap },
    { id: "type-3", name: "Feature", count: 27, total: 100, icon: Bug },
  ]

  const recentActivityData = [
    {
      id: "activity-1",
      user: "John Doe",
      action: "changed the Assignee to",
      item: "SCRUM-4: Tasks Car",
      status: "TO DO",
      time: "12 minutes ago",
    },
    {
      id: "activity-2",
      user: "Sarah Smith",
      action: "changed the Assignee to",
      item: "SCRUM-12: Project D",
      status: "DONE",
      time: "12 minutes ago",
    },
  ]

  const dueTasksData = [
    { id: "due-1", task: "Complete API Documentation", dueIn: "2 days", priority: "high" },
    { id: "due-2", task: "Review Pull Requests", dueIn: "1 day", priority: "medium" },
    { id: "due-3", task: "Update Database Schema", dueIn: "3 days", priority: "high" },
  ]

  const filterCategories = [
    {
      id: "filter-1",
      name: "Assignee",
      subcategories: [
        { id: "assignee-1", name: "John Doe" },
        { id: "assignee-2", name: "Sarah Smith" },
        { id: "assignee-3", name: "Mike Johnson" },
        { id: "assignee-4", name: "Emma Wilson" },
      ],
      hasSearch: true,
    },
    {
      id: "filter-2",
      name: "Status",
      subcategories: [
        { id: "status-open", name: "Open" },
        { id: "status-progress", name: "In Progress" },
        { id: "status-completed", name: "Completed" },
        { id: "status-blocked", name: "Blocked" },
      ],
    },
    {
      id: "filter-3",
      name: "Priority",
      subcategories: [
        { id: "priority-high", name: "High" },
        { id: "priority-medium", name: "Medium" },
        { id: "priority-low", name: "Low" },
      ],
    },
    {
      id: "filter-4",
      name: "Due Date",
      subcategories: [
        { id: "due-today", name: "Today" },
        { id: "due-week", name: "This Week" },
        { id: "due-month", name: "This Month" },
        { id: "due-overdue", name: "Overdue" },
      ],
    },
    {
      id: "filter-5",
      name: "Work Type",
      subcategories: [
        { id: "type-feature", name: "Feature" },
        { id: "type-bug", name: "Bug" },
        { id: "type-task", name: "Task" },
      ],
    },
  ]

  const filteredAssignees =
    filterCategories
      .find((f) => f.id === "filter-1")
      ?.subcategories.filter((a) => a.name.toLowerCase().includes(searchAssignee.toLowerCase())) || []

  const toggleAssignee = (assigneeId: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(assigneeId) ? prev.filter((id) => id !== assigneeId) : [...prev, assigneeId],
    )
  }

  const toggleFromSet = (id: string, setFn: (updater: (prev: string[]) => string[]) => void) => {
    setFn((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))
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

                      {selectedAssignees.length > 0 && (
                        <div className="flex flex-wrap gap-2 animate-in fade-in duration-200">
                          {selectedAssignees.map((assigneeId) => {
                            const assignee = filterCategories
                              .find((f) => f.id === "filter-1")
                              ?.subcategories.find((a) => a.id === assigneeId)
                            return (
                              <div
                                key={assigneeId}
                                className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium hover:shadow-md transition-all duration-200"
                              >
                                <span>{assignee?.name}</span>
                                <button
                                  onClick={() => toggleAssignee(assigneeId)}
                                  className="hover:text-blue-900 transition-all duration-200 hover:scale-110 active:scale-95"
                                >
                                  <XIcon className="size-3" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {filteredAssignees.map((assignee) => (
                          <label
                            key={assignee.id}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-lg cursor-pointer transition-all duration-200 active:scale-95"
                          >
                            <input
                              type="checkbox"
                              checked={selectedAssignees.includes(assignee.id)}
                              onChange={() => toggleAssignee(assignee.id)}
                              className="rounded border-border cursor-pointer transition-all duration-200"
                            />
                            <span className="text-sm text-foreground">{assignee.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filterCategories
                        .find((f) => f.id === activeFilterCategory)
                        ?.subcategories.map((sub) => {
                          const isStatus = activeFilterCategory === "filter-2"
                          const isPriority = activeFilterCategory === "filter-3"
                          const isDue = activeFilterCategory === "filter-4"
                          const isWorkType = activeFilterCategory === "filter-5"

                          const checked = isStatus
                            ? selectedStatuses.includes(sub.id)
                            : isPriority
                              ? selectedPriorities.includes(sub.id)
                              : isDue
                                ? selectedDueDates.includes(sub.id)
                                : isWorkType
                                  ? selectedWorkTypes.includes(sub.id)
                                  : false

                          const onToggle = () => {
                            if (isStatus) return toggleFromSet(sub.id, setSelectedStatuses)
                            if (isPriority) return toggleFromSet(sub.id, setSelectedPriorities)
                            if (isDue) return toggleFromSet(sub.id, setSelectedDueDates)
                            if (isWorkType) return toggleFromSet(sub.id, setSelectedWorkTypes)
                          }

                          return (
                            <label
                              key={sub.id}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-lg cursor-pointer transition-all duration-200 active:scale-95"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={onToggle}
                                className="rounded border-border cursor-pointer transition-all duration-200"
                              />
                              <span className="text-sm text-foreground">{sub.name}</span>
                            </label>
                          )
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-3 hover:shadow-md transition-all duration-200 cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Completed</p>
              <p className="text-xl font-bold text-foreground">1</p>
              <p className="text-xs text-muted-foreground mt-1">last 7 days</p>
            </div>
            <div className="text-lg text-green-600">✓</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 hover:shadow-md transition-all duration-200 cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Updated</p>
              <p className="text-xl font-bold text-foreground">9</p>
              <p className="text-xs text-muted-foreground mt-1">last 7 days</p>
            </div>
            <div className="text-lg text-blue-600">↻</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 hover:shadow-md transition-all duration-200 cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Created</p>
              <p className="text-xl font-bold text-foreground">9</p>
              <p className="text-xs text-muted-foreground mt-1">last 7 days</p>
            </div>
            <div className="text-lg text-blue-600">+</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 hover:shadow-md transition-all duration-200 cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Due Soon</p>
              <p className="text-xl font-bold text-foreground">0</p>
              <p className="text-xs text-muted-foreground mt-1">next 7 days</p>
            </div>
            <div className="text-lg text-orange-600">📅</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status Overview - Pie Chart */}
        <div className="bg-card border border-border rounded-lg p-4 hover:shadow-lg transition-all duration-200">
          <h3 className="text-sm font-semibold text-foreground mb-2">Status Overview</h3>
          <p className="text-xs text-muted-foreground mb-4">Get a snapshot of your work items.</p>
          <div className="flex justify-center">
            <ResponsiveContainer width="100%" height={180}>
              <RechartsPieChart>
                <Pie
                  data={statusOverviewData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusOverviewData.map((entry) => (
                    <Cell key={`cell-${entry.id}`} fill={entry.color} />
                  ))}
                </Pie>
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1.5">
            {statusOverviewData.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-foreground">{item.name}</span>
                </div>
                <span className="font-semibold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity + Due Alerts */}
        <div className="lg:col-span-2 space-y-4">
          {/* Recent Activity */}
          <div className="bg-card border border-border rounded-lg p-4 hover:shadow-lg transition-all duration-200">
            <h3 className="text-sm font-semibold text-foreground mb-2">Recent Activity</h3>
            <p className="text-xs text-muted-foreground mb-3">Stay up to date with what&apos;s happening.</p>
            <div className="space-y-2">
              {(() => {
                const selectedAssigneeNames = filterCategories
                  .find((f) => f.id === "filter-1")?.subcategories
                  .filter((a) => selectedAssignees.includes(a.id))
                  .map((a) => a.name) || []

                const statusIdsToNames: Record<string, string> = {
                  "status-open": "OPEN",
                  "status-progress": "IN PROGRESS",
                  "status-completed": "COMPLETED",
                  "status-blocked": "BLOCKED",
                }

                const filtered = recentActivityData.filter((activity) => {
                  const statusOk =
                    selectedStatuses.length === 0 ||
                    selectedStatuses.some((id) => statusIdsToNames[id]?.toLowerCase() === activity.status.toLowerCase())
                  const assigneeOk =
                    selectedAssigneeNames.length === 0 || selectedAssigneeNames.includes(activity.user)
                  return statusOk && assigneeOk
                })

                return filtered.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex gap-2 pb-2 border-b border-border last:border-0 hover:bg-muted/50 p-1.5 -mx-1.5 rounded transition-all duration-200 cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
                      {activity.user.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        <span className="font-semibold">{activity.user}</span> {activity.action}
                      </p>
                      <p className="text-xs text-blue-600 font-medium mt-0.5">{activity.item}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                          {activity.status}
                        </span>
                        <span className="text-xs text-muted-foreground">{activity.time}</span>
                      </div>
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>

          {/* Due Alerts */}
          <div className="bg-card border border-border rounded-lg p-4 hover:shadow-lg transition-all duration-200">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <AlertCircleIcon className="size-4 text-red-500" />
              Due Alerts
            </h3>
            <div className="space-y-2">
              {(() => {
                const priorityIdsToNames: Record<string, string> = {
                  "priority-high": "high",
                  "priority-medium": "medium",
                  "priority-low": "low",
                }

                const dueIdToPredicate: Record<string, (days: number) => boolean> = {
                  "due-today": (d) => d === 0,
                  "due-week": (d) => d >= 0 && d <= 7,
                  "due-month": (d) => d >= 0 && d <= 30,
                  "due-overdue": (d) => d < 0,
                }

                const parseDays = (dueIn: string) => {
                  const m = /(-?\d+)\s*day/.exec(dueIn)
                  return m ? parseInt(m[1], 10) : 0
                }

                const filtered = dueTasksData.filter((item) => {
                  const prioOk =
                    selectedPriorities.length === 0 ||
                    selectedPriorities.some((id) => priorityIdsToNames[id] === item.priority)

                  const days = parseDays(item.dueIn)
                  const dueOk =
                    selectedDueDates.length === 0 ||
                    selectedDueDates.some((id) => dueIdToPredicate[id]?.(days))

                  return prioOk && dueOk
                })

                return filtered.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 p-2 bg-muted rounded-lg hover:shadow-md transition-all duration-200 cursor-pointer hover:bg-muted/80"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{item.task}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.dueIn}</p>
                    </div>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap transition-all duration-200 flex-shrink-0 font-medium ${item.priority === "high" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                        }`}
                    >
                      {item.priority}
                    </span>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TaskList data={tasks.documents} total={tasks.total} />
        <ProjectList data={projects.documents} total={projects.total} />
        <MemberList data={members.documents} total={members.total} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Epic Progress - Full Width Style */}
        <div className="bg-card border border-border rounded-lg p-4 hover:shadow-lg transition-all duration-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="size-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-foreground">Epic Progress</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-2">See how your epics are progressing.</p>
          <div className="space-y-1.5">
            {epicProgressData.map((epic) => (
              <div key={epic.id} className="hover:bg-muted/50 p-1.5 -mx-1.5 rounded transition-all duration-200">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-foreground truncate">{epic.name}</p>
                  <p className="text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded-full flex-shrink-0">
                    {epic.progress}%
                  </p>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500 bg-blue-500"
                    style={{ width: `${epic.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Workload - Card Grid Style */}
        <div className="bg-card border border-border rounded-lg p-4 hover:shadow-lg transition-all duration-200">
          <div className="flex items-center gap-2 mb-2">
            <Users className="size-4 text-green-500" />
            <h3 className="text-sm font-semibold text-foreground">Team Workload</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-2">Monitor team capacity and distribution.</p>
          <div className="space-y-1.5">
            {(() => {
              const selectedAssigneeNames = filterCategories
                .find((f) => f.id === "filter-1")?.subcategories
                .filter((a) => selectedAssignees.includes(a.id))
                .map((a) => a.name) || []

              const visibleMembers = teamWorkloadData.filter((m) =>
                selectedAssigneeNames.length === 0 || selectedAssigneeNames.includes(m.name),
              )

              const totalWorkloadTasks = visibleMembers.reduce((sum, m) => sum + m.tasksTotal, 0) || 1
              return visibleMembers.map((member) => {
                const progress = Math.round((member.tasksTotal / totalWorkloadTasks) * 100)
                return (
                  <div
                    key={member.id}
                    className="bg-muted/50 rounded-lg p-2 hover:bg-muted transition-all duration-200"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-foreground truncate">{member.name}</p>
                      <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full flex-shrink-0 bg-blue-500">
                        {progress}%
                      </span>
                    </div>
                    <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500 bg-blue-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-1">
                      {member.tasksTotal}/{totalWorkloadTasks} tasks
                    </p>
                  </div>
                )
              })
            })()}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-3 hover:shadow-md transition-all duration-200">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="size-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-foreground">Types of Work</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Work breakdown by type</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(() => {
            const workTypeIdsToNames: Record<string, string> = {
              "type-feature": "Feature",
              "type-bug": "Bug",
              "type-task": "Task",
            }
            const filtered = typesOfWorkData.filter((w) => {
              if (selectedWorkTypes.length === 0) return true
              // Match by display name
              return selectedWorkTypes.some((id) => workTypeIdsToNames[id] === w.name)
            })
            return filtered.map((workType) => {
              const IconComponent = workType.icon
              return (
                <div
                  key={workType.id}
                  className="bg-muted/30 rounded-lg p-2.5 hover:bg-muted/50 transition-all duration-200 border border-border/30"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-md text-white flex-shrink-0 bg-blue-500">
                      <IconComponent className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{workType.name}</p>
                    </div>
                  </div>
                  <div className="w-full bg-background rounded-full h-1.5 overflow-hidden mb-1">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500 bg-blue-500"
                      style={{ width: `${workType.count}%` }}
                    />
                  </div>
                  <p className="text-xs font-bold text-foreground text-center">{workType.count}%</p>
                </div>
              )
            })
          })()}
        </div>
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
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Tasks</h2>
          <p className="text-xs text-muted-foreground">{total} total</p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            size="icon"
            onClick={createTask}
            className="rounded-lg hover:bg-muted transition-colors bg-transparent h-8 w-8 hover:scale-110 active:scale-95"
          >
            <PlusIcon className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg p-3 space-y-2 flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-2">
          {data.slice(0, 5).map((task) => (
            <li key={task.$id}>
              <Link href={`/workspaces/${workspaceId}/tasks/${task.$id}`}>
                <Card className="shadow-none border border-border rounded-lg hover:shadow-sm hover:border-muted-foreground transition-all duration-200 hover:bg-muted/50">
                  <CardContent className="p-2.5">
                    <p className="text-xs font-medium text-foreground truncate">{task.name}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <span className="truncate">{task.project?.name}</span>
                      <div className="size-0.5 rounded-full bg-border" />
                      <div className="flex items-center gap-0.5">
                        <CalendarIcon className="size-2.5" />
                        <span className="truncate">{formatDistanceToNow(new Date(task.dueDate))}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
          <li className="text-xs text-muted-foreground text-center hidden first-of-type:block py-4">No tasks</li>
        </ul>

        {data.length > 5 && (
          <Button
            variant="outline"
            className="w-full mt-2 rounded-lg border-border hover:bg-muted transition-colors bg-transparent text-xs h-8"
            asChild
          >
            <Link href={`/workspaces/${workspaceId}/tasks`}>View All</Link>
          </Button>
        )}
      </div>
    </div>
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
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Projects</h2>
          <p className="text-xs text-muted-foreground">{total} total</p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            size="icon"
            onClick={createProject}
            className="rounded-lg hover:bg-muted transition-colors bg-transparent h-8 w-8 hover:scale-110 active:scale-95"
          >
            <PlusIcon className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg p-3">
        <ul className="grid grid-cols-2 gap-2">
          {data.slice(0, 4).map((project) => (
            <li key={project.$id}>
              <Link href={`/workspaces/${workspaceId}/projects/${project.$id}`}>
                <Card className="shadow-none border border-border rounded-lg hover:shadow-sm hover:border-muted-foreground transition-all duration-200 h-full hover:bg-muted/50">
                  <CardContent className="flex flex-col items-center gap-2 p-2.5">
                    <ProjectAvatar
                      name={project.name}
                      image={project.imageUrl}
                      className="size-7 flex-shrink-0"
                      fallbackClassName="text-xs"
                    />
                    <p className="text-xs font-medium text-foreground truncate text-center line-clamp-2">
                      {project.name}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
          <li className="text-xs text-muted-foreground text-center hidden first-of-type:block col-span-full py-4">
            No projects
          </li>
        </ul>

        {data.length > 4 && (
          <Button
            variant="outline"
            className="w-full mt-2 rounded-lg border-border hover:bg-muted transition-colors bg-transparent text-xs h-8"
            asChild
          >
            <Link href={`/workspaces/${workspaceId}/projects`}>View All</Link>
          </Button>
        )}
      </div>
    </div >
  )
}

interface MemberListProps {
  data: Member[]
  total: number
}

export const MemberList = ({ data, total }: MemberListProps) => {
  const workspaceId = useWorkspaceId()

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Members</h2>
          <p className="text-xs text-muted-foreground">{total} team</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          asChild
          className="rounded-lg hover:bg-muted transition-colors bg-transparent h-8 w-8 hover:scale-110 active:scale-95"
        >
          <Link href={`/workspaces/${workspaceId}/members`}>
            <SettingsIcon className="size-3.5" />
          </Link>
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg p-3">
        <ul className="grid grid-cols-2 gap-2">
          {data.slice(0, 4).map((member) => {
            const displayName = member.name?.trim() || member.email || "Unknown"
            const displayEmail = member.email || "Unknown"

            return (
              <li key={member.$id}>
                <Card className="shadow-none border border-border rounded-lg overflow-hidden hover:shadow-sm hover:border-muted-foreground transition-all duration-200 hover:bg-muted/50">
                  <CardContent className="p-2.5 flex flex-col items-center gap-1.5 text-center">
                    <MemberAvatar
                      name={displayName}
                      className="size-7"
                      imageUrl={member.profileImageUrl}
                      tooltipText={displayName}
                    />
                    <div className="flex flex-col items-center overflow-hidden w-full">
                      <p className="text-xs font-semibold text-foreground line-clamp-1">{displayName}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{displayEmail}</p>
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
          <li className="text-xs text-muted-foreground text-center hidden first-of-type:block col-span-full py-4">
            No members
          </li>
        </ul>

        {data.length > 4 && (
          <Button
            variant="outline"
            className="w-full mt-2 rounded-lg border-border hover:bg-muted transition-colors bg-transparent text-xs h-8"
            asChild
          >
            <Link href={`/workspaces/${workspaceId}/members`}>View All</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
