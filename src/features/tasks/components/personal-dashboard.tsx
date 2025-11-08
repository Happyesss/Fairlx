"use client"

import { useRouter } from "next/navigation"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import {
  Activity,
  Search,
  Star,
  Zap,
  Plus,
  TrendingUp,
  Target,
  Calendar,
  Code,
  Users,
  ArrowUpRight,
} from "lucide-react"
import {
  LineChart,
  Line,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

interface PersonalDashboardProps {
  className?: string
}

const mockData = {
  user: {
    name: "John Doe",
    role: "Senior Developer",
    avatar: "JD",
    notifications: [
      { id: 1, type: "mention", message: "@johndoe mentioned you in Task #123", time: "10m ago" },
      { id: 2, type: "assigned", message: "You were assigned to Task #456", time: "1h ago" },
      { id: 3, type: "dueDate", message: "Task #789 is due tomorrow", time: "2h ago" },
    ],
    upcomingDeadlines: [
      { id: 1, title: "Complete API Integration", project: "E-commerce Platform", due: "Tomorrow" },
      { id: 2, title: "Code Review", project: "Mobile App", due: "In 2 days" },
    ],
    sprintInfo: {
      current: "Sprint 24",
      remaining: "5 days",
      progress: 65,
      tasks: {
        total: 28,
        completed: 18,
        inProgress: 7,
        blocked: 3,
      },
    },
    storyPoints: {
      completed: 45,
      total: 65,
      thisWeek: 12,
      lastWeek: 8,
      history: [
        { week: "W1", points: 15, completed: 12 },
        { week: "W2", points: 22, completed: 20 },
        { week: "W3", points: 18, completed: 15 },
        { week: "W4", points: 25, completed: 22 },
        { week: "W5", points: 12, completed: 8 },
      ],
    },
    performance: {
      taskCompletion: 92,
      onTimeDelivery: 88,
      qualityScore: 95,
      velocity: 85,
      trends: [
        { metric: "Story Points", score: 85, trend: "+5%" },
        { metric: "Code Quality", score: 95, trend: "+2%" },
        { metric: "Sprint Goals", score: 88, trend: "+3%" },
        { metric: "Team Impact", score: 90, trend: "+4%" },
      ],
    },
    recentProjects: [
      { id: 1, name: "E-commerce Platform", color: "#1f2937", lastVisited: "2 hours ago", progress: 75, tasks: 12 },
      { id: 2, name: "Mobile App", color: "#1f2937", lastVisited: "5 hours ago", progress: 40, tasks: 8 },
      { id: 3, name: "API Gateway", color: "#1f2937", lastVisited: "1 day ago", progress: 90, tasks: 15 },
    ],
    frequentWorkspaces: [
      { id: 1, name: "Development Team", lastVisited: "1 hour ago", members: 8, activity: "high" },
      { id: 2, name: "Product Team", lastVisited: "3 hours ago", members: 12, activity: "medium" },
      { id: 3, name: "Mobile Team", lastVisited: "2 days ago", members: 6, activity: "low" },
    ],
    workDistribution: [
      { type: "Feature Development", hours: 24, color: "#3b82f6" },
      { type: "Code Review", hours: 10, color: "#8b5cf6" },
      { type: "Meetings", hours: 8, color: "#ec4899" },
      { type: "Documentation", hours: 6, color: "#f59e0b" },
    ],
    activityTimeline: [
      { date: "Mon", tasks: 5, meetings: 2 },
      { date: "Tue", tasks: 7, meetings: 3 },
      { date: "Wed", tasks: 4, meetings: 1 },
      { date: "Thu", tasks: 8, meetings: 4 },
      { date: "Fri", tasks: 6, meetings: 2 },
    ],
    tasks: {
      priority: [
        { level: "Blocker", count: 2, color: "#dc2626" },
        { level: "High", count: 5, color: "#f43f5e" },
        { level: "Medium", count: 8, color: "#eab308" },
        { level: "Low", count: 12, color: "#22c55e" },
      ],
      assigned: [
        {
          id: 1,
          title: "Implement authentication flow",
          project: "E-commerce Platform",
          status: "In Progress",
          priority: "Blocker",
          type: "Bug",
          due: "Today",
          sprint: "Sprint 24",
          assignedBy: "Sarah Manager",
          timeTracked: "4h 30m",
          timeEstimated: "6h",
        },
        {
          id: 2,
          title: "Review API documentation",
          project: "API Gateway",
          status: "In Review",
          priority: "High",
          type: "Task",
          due: "Tomorrow",
          sprint: "Sprint 24",
          assignedBy: "Mike Tech Lead",
          timeTracked: "2h",
          timeEstimated: "4h",
        },
        {
          id: 3,
          title: "Fix navigation bug",
          project: "Mobile App",
          status: "In Progress",
          priority: "High",
          type: "Bug",
          due: "Tomorrow",
          sprint: "Sprint 24",
          assignedBy: "Jane PM",
          timeTracked: "1h 30m",
          timeEstimated: "3h",
        },
      ],
    },
  },
}

const PersonalDashboard = ({ className = "" }: PersonalDashboardProps) => {
  const router = useRouter()
  const user = mockData.user
  const [activeTimeRange, setActiveTimeRange] = useState<"daily" | "weekly" | "monthly">("daily")

  const activityData = useMemo(() => {
    switch (activeTimeRange) {
      case "daily":
        return user.activityTimeline
      case "weekly":
        return [
          { date: "Week 1", tasks: 25, meetings: 8 },
          { date: "Week 2", tasks: 32, meetings: 12 },
          { date: "Week 3", tasks: 28, meetings: 10 },
          { date: "Week 4", tasks: 35, meetings: 15 }
        ]
      case "monthly":
        return [
          { date: "Jan", tasks: 95, meetings: 35 },
          { date: "Feb", tasks: 88, meetings: 30 },
          { date: "Mar", tasks: 105, meetings: 40 },
          { date: "Apr", tasks: 84, meetings: 28 },
          { date: "May", tasks: 98, meetings: 38 }
        ]
      default:
        return user.activityTimeline
    }
  }, [activeTimeRange, user.activityTimeline])
  const totalHours = user.workDistribution.reduce((acc, type) => acc + type.hours, 0)

  return (
    <div className={`p-6 space-y-6 ${className}`}>
      {/* Premium Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-light tracking-tight">{user.name}</h1>
          <p className="text-sm text-muted-foreground">
            {user.role} • {user.sprintInfo.current}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-10 h-8 text-sm bg-accent/50 border-0" />
            </div>
            <Button size="sm" className="h-8 px-3 bg-primary hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create Project
            </Button>
            <Button size="sm" variant="outline" className="h-8 px-3">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create Workspace
            </Button>

          </div>

        </div>
      </div>

      {/* KPI Overview - Horizontal Scroll Cards */}
      <div className="grid grid-cols-4 gap-3">
        {/* Performance Card */}
        <Card className="p-4 border-0 bg-accent/30 backdrop-blur-sm hover:bg-accent/50 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Performance</p>
              <Activity className="h-3.5 w-3.5 text-primary/60" />
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-light">{user.performance.taskCompletion}%</span>
              <span className="text-xs text-green-600 flex items-center gap-0.5">
                <ArrowUpRight className="h-3 w-3" />
                +5%
              </span>
            </div>
            <Progress value={user.performance.taskCompletion} className="h-1 bg-primary/20 [&>div]:bg-primary" />
          </div>
        </Card>

        {/* Velocity Card */}
        <Card className="p-4 border-0 bg-accent/30 backdrop-blur-sm hover:bg-accent/50 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Velocity</p>
              <Zap className="h-3.5 w-3.5 text-amber-500/60" />
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-light">{user.performance.velocity}</span>
              <span className="text-xs text-muted-foreground">pts/sprint</span>
            </div>
            <Progress value={user.performance.velocity} className="h-1 bg-primary/20 [&>div]:bg-primary" />
          </div>
        </Card>

        {/* Quality Card */}
        <Card className="p-4 border-0 bg-accent/30 backdrop-blur-sm hover:bg-accent/50 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quality</p>
              <Star className="h-3.5 w-3.5 text-purple-500/60" />
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-light">{user.performance.qualityScore}</span>
              <span className="text-xs text-muted-foreground">score</span>
            </div>
            <Progress value={user.performance.qualityScore} className="h-1 bg-primary/20 [&>div]:bg-primary" />
          </div>
        </Card>

        {/* Sprint Progress Card */}
        <Card className="p-4 border-0 bg-accent/30 backdrop-blur-sm hover:bg-accent/50 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sprint</p>
              <Target className="h-3.5 w-3.5 text-cyan-500/60" />
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-light">
                {user.sprintInfo.tasks.completed}/{user.sprintInfo.tasks.total}
              </span>
              <span className="text-xs text-muted-foreground">tasks</span>
            </div>
            <Progress value={user.sprintInfo.progress} className="h-1 bg-primary/20 [&>div]:bg-primary" />
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Column - Charts & Analytics */}
        <div className="col-span-8 space-y-4">
          {/* Activity Timeline - Full Width */}
          <Card className="p-4 border-0 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Activity</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTimeRange("daily")}
                  className={`text-xs px-2 py-1 rounded transition-colors ${activeTimeRange === "daily"
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-primary"
                    }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setActiveTimeRange("weekly")}
                  className={`text-xs px-2 py-1 rounded transition-colors ${activeTimeRange === "weekly"
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-primary"
                    }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setActiveTimeRange("monthly")}
                  className={`text-xs px-2 py-1 rounded transition-colors ${activeTimeRange === "monthly"
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-primary"
                    }`}
                >
                  Monthly
                </button>
                <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
              </div>
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activityData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tasksArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="meetingsArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.08} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    tickLine={false}
                    axisLine={false}
                  />
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      padding: "8px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)"
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="tasks"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ fill: "var(--primary)", r: 2.5 }}
                    activeDot={{ r: 4, strokeWidth: 2 }}
                    fill="url(#taskGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="meetings"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    strokeOpacity={0.5}
                    dot={{ fill: "var(--primary)", r: 2.5, fillOpacity: 0.5 }}
                    activeDot={{ r: 4, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Performance Trends */}
            <Card className="p-4 border-0 bg-card/50 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium">Performance Trends</h3>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart
                    data={user.performance.trends}
                    barSize={20}
                    margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="metric"
                      tick={{ fontSize: 10 }}
                      stroke="currentColor"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      stroke="currentColor"
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                    />
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      vertical={false}
                    />
                    <Tooltip
                      cursor={{
                        fill: 'var(--primary)',
                        opacity: 0.1
                      }}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        padding: "8px",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)"
                      }}
                      formatter={(value) => [`${value}%`]}
                    />
                    <Bar
                      dataKey="score"
                      fill="var(--primary)"
                      radius={[6, 6, 0, 0]}
                      opacity={0.8}
                    />
                  </RechartsBarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-between mt-2 px-2">
                  {user.performance.trends.map((trend) => (
                    <div key={trend.metric} className="text-center">
                      <span className="text-xs text-green-500">{trend.trend}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Work Distribution */}
            <Card className="p-4 border-0 bg-card/50 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium">Work Distribution</h3>
              </div>
              <div className="h-[160px] flex items-center justify-center">
                <div className="w-full h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                          padding: "8px",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)"
                        }}
                        formatter={(value, name) => [`${value}h`, name]}
                      />
                      <Pie
                        data={user.workDistribution}
                        dataKey="hours"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {user.workDistribution.map((entry) => (
                          <Cell
                            key={entry.type}
                            fill="var(--primary)"
                            fillOpacity={entry.type === "Feature Development" ? 1 :
                              entry.type === "Code Review" ? 0.8 :
                                entry.type === "Meetings" ? 0.6 : 0.4}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="absolute right-4 top-12 space-y-1">
                  {user.workDistribution.map((entry) => (
                    <div key={entry.type} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full bg-primary`}
                        style={{
                          opacity: entry.type === "Feature Development" ? 1 :
                            entry.type === "Code Review" ? 0.8 :
                              entry.type === "Meetings" ? 0.6 : 0.4
                        }} />
                      <span className="text-xs text-muted-foreground">{entry.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Tasks Section */}
          <Card className="p-4 border-0 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Active Tasks</h3>
              <span className="text-xs text-muted-foreground">{user.tasks.assigned.length} assigned</span>
            </div>
            <div className="space-y-2.5">
              {user.tasks.assigned.map((task) => (
                <div
                  key={task.id}
                  className="p-2.5 rounded-md border border-border/50 hover:border-border hover:bg-accent/20 transition-all group cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-1.5 h-1.5 mt-1.5 rounded-full flex-shrink-0 ${task.priority === "Blocker"
                        ? "bg-red-500"
                        : task.priority === "High"
                          ? "bg-orange-500"
                          : task.priority === "Medium"
                            ? "bg-amber-500"
                            : "bg-green-500"
                        }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium group-hover:text-primary transition-colors">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">{task.project}</span>
                        <span className="text-[10px] text-muted-foreground">•</span>
                        <span className="text-[10px] text-muted-foreground">
                          {task.timeTracked}/{task.timeEstimated}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap ${task.status === "In Progress"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : task.status === "In Review"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                        }`}
                    >
                      {task.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column - Projects & Sidebar */}
        <div className="col-span-4 space-y-4">
          {/* Notifications */}
          <Card className="p-4 border-0 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Recent Notifications</h3>
              <span className="text-xs text-primary font-medium">View All</span>
            </div>
            <div className="space-y-3">
              {user.notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-2 rounded-lg bg-accent/40 hover:bg-accent/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{notification.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          {/* Recent Projects */}
          <Card className="p-4 border-0 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Recent Projects</h3>
              <Code className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              {user.recentProjects.map((project) => (
                <button
                  key={project.id}
                  className="w-full p-2 rounded-md border border-border/30 hover:border-border hover:bg-accent/20 transition-all text-left group"
                >
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded flex items-center justify-center bg-primary/10 flex-shrink-0 mt-0.5">
                      <Code className="h-3 w-3 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium group-hover:text-primary transition-colors">{project.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Progress value={project.progress} className="h-1 flex-1 bg-primary/20 [&>div]:bg-primary" />
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{project.progress}%</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Workspaces */}
          <Card className="p-4 border-0 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Workspaces</h3>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              {user.frequentWorkspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  className="w-full p-2 rounded-md border border-border/30 hover:border-border hover:bg-accent/20 transition-all text-left group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded flex items-center justify-center bg-primary/10 flex-shrink-0">
                      <Users className="h-3 w-3 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium group-hover:text-primary transition-colors truncate">
                        {workspace.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{workspace.members} members</p>
                    </div>
                    <div
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${workspace.activity === "high"
                        ? "bg-green-500"
                        : workspace.activity === "medium"
                          ? "bg-yellow-500"
                          : "bg-gray-400"
                        }`}
                    />
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Story Points Summary */}
          <Card className="p-4 border-0 bg-card/50 backdrop-blur-sm">
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium">Story Points</p>
                  <span className="text-xs text-muted-foreground">
                    {user.storyPoints.completed}/{user.storyPoints.total}
                  </span>
                </div>
                <Progress
                  value={(user.storyPoints.completed / user.storyPoints.total) * 100}
                  className="h-1.5 bg-primary/20 [&>div]:bg-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded bg-accent/50">
                  <p className="text-[10px] text-muted-foreground">This Week</p>
                  <p className="text-sm font-medium">+{user.storyPoints.thisWeek}</p>
                </div>
                <div className="p-2 rounded bg-accent/50">
                  <p className="text-[10px] text-muted-foreground">Last Week</p>
                  <p className="text-sm font-medium">+{user.storyPoints.lastWeek}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default PersonalDashboard
