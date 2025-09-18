"use client"

import { useState, useMemo } from "react"
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  differenceInDays,
  parseISO,
  startOfDay,
  isSameDay,
  isWeekend,
} from "date-fns"
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, ProjectorIcon, CheckSquare, Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import { TaskStatus, type PopulatedTask } from "../types"
import { MemberAvatar } from "./member-avatar"
import { cn } from "@/lib/utils"

interface EnhancedTimelineProps {
  data: PopulatedTask[]
}

type ViewType = "week" | "month" | "quarter"

const statusConfig = {
  [TaskStatus.BACKLOG]: {
    color: "bg-orange-500",
    lightColor: "bg-orange-100",
    borderColor: "border-orange-200",
    textColor: "text-orange-700",
  },
  [TaskStatus.TODO]: {
    color: "bg-orange-500",
    lightColor: "bg-orange-100",
    borderColor: "border-orange-200",
    textColor: "text-orange-700",
  },
  [TaskStatus.IN_PROGRESS]: {
    color: "bg-blue-500",
    lightColor: "bg-blue-100",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
  },
  [TaskStatus.IN_REVIEW]: {
    color: "bg-blue-500",
    lightColor: "bg-blue-100",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
  },
  [TaskStatus.DONE]: {
    color: "bg-green-500",
    lightColor: "bg-green-100",
    borderColor: "border-green-200",
    textColor: "text-green-700",
  },
}

const getTaskTypeIcon = (status: TaskStatus) => {
  if (status === TaskStatus.DONE) {
    return <CheckSquare className="h-4 w-4 text-green-600" />
  }
  return <Square className="h-4 w-4 text-blue-600" />
}

export const EnhancedTimeline = ({ data }: EnhancedTimelineProps) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewType, setViewType] = useState<ViewType>("month")
  const [selectedTask, setSelectedTask] = useState<string | null>(null)

  const { startDate, endDate } = useMemo(() => {
    const start = startOfWeek(currentDate)
    let end: Date

    switch (viewType) {
      case "week":
        end = endOfWeek(currentDate)
        break
      case "month":
        end = addDays(start, 120) // Show 4 months instead of 1
        break
      case "quarter":
        end = addDays(start, 90)
        break
      default:
        end = endOfWeek(currentDate)
    }

    return { startDate: start, endDate: end }
  }, [currentDate, viewType])

  const monthHeaders = useMemo(() => {
    if (viewType !== "month") return []

    const months = []
    const current = new Date(startDate)
    const end = new Date(endDate)

    while (current <= end) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1)
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0)
      const daysInMonth = monthEnd.getDate()

      months.push({
        label: format(monthStart, "MMM"),
        width: daysInMonth * 40, // 40px per day
        month: monthStart,
      })

      current.setMonth(current.getMonth() + 1)
    }

    return months
  }, [startDate, endDate, viewType])

  const timelineDays = useMemo(() => {
    if (viewType === "quarter") {
      const weeks = []
      let current = startDate
      while (current <= endDate) {
        weeks.push({
          date: current,
          label: format(current, "MMM dd"),
          isWeekStart: true,
          isWeekend: false,
          isToday: isSameDay(current, new Date()),
        })
        current = addDays(current, 7)
      }
      return weeks
    } else {
      return eachDayOfInterval({ start: startDate, end: endDate }).map((date) => ({
        date,
        label: format(date, viewType === "week" ? "EEE\ndd" : "dd"),
        shortLabel: format(date, "dd"),
        isWeekStart: date.getDay() === 0,
        isWeekend: isWeekend(date),
        isToday: isSameDay(date, new Date()),
      }))
    }
  }, [startDate, endDate, viewType])

  const processedTasks = useMemo(() => {
    return data
      .map((task) => {
        const taskStart = startOfDay(parseISO(task.dueDate))
        const taskEnd = task.endDate ? startOfDay(parseISO(task.endDate)) : taskStart

        const startOffset = Math.max(0, differenceInDays(taskStart, startDate))
        const endOffset = Math.min(timelineDays.length - 1, differenceInDays(taskEnd, startDate))
        const duration = Math.max(1, endOffset - startOffset + 1)

        const isVisible = taskStart <= endDate && taskEnd >= startDate

        return {
          ...task,
          startOffset,
          duration,
          endOffset,
          isVisible,
          taskStart,
          taskEnd,
          isMilestone: taskStart.getTime() === taskEnd.getTime(),
        }
      })
      .filter((task) => task.isVisible)
  }, [data, startDate, endDate, timelineDays.length])

  const navigate = (direction: "prev" | "next") => {
    const amount = viewType === "week" ? 7 : viewType === "month" ? 30 : 90
    const newDate = direction === "prev" ? addDays(currentDate, -amount) : addDays(currentDate, amount)
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const dayWidth = viewType === "quarter" ? 28 : viewType === "month" ? 40 : 80

  return (
    <TooltipProvider>
      <Card className="h-full bg-white">
        <CardHeader className="pb-0 border-b bg-gray-50">
          <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0 pb-4">
            <div className="flex items-center gap-4">
              <div className="flex border rounded-lg p-1 bg-white shadow-sm">
                {(["week", "month", "quarter"] as ViewType[]).map((view) => (
                  <Button
                    key={view}
                    variant={viewType === view ? "primary" : "ghost"}
                    size="sm"
                    onClick={() => setViewType(view)}
                    className={cn(
                      "capitalize text-sm px-3",
                      viewType === view ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100",
                    )}
                  >
                    {view}
                  </Button>
                ))}
              </div>

              <div className="text-sm font-medium text-gray-700">
                {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("prev")}
                className="h-8 w-8 p-0 border-gray-300 hover:bg-gray-50"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                className="h-8 px-3 border-gray-300 text-sm font-medium hover:bg-gray-50 bg-transparent"
              >
                Today
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("next")}
                className="h-8 w-8 p-0 border-gray-300 hover:bg-gray-50"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="border-t">
            <div className="flex bg-gray-50 sticky top-0 z-10 border-b">
              <div className="w-80 p-4 border-r bg-white">
                <div className="font-semibold text-sm flex items-center gap-2 text-gray-800">
                  <ProjectorIcon className="h-4 w-4 text-blue-600" />
                  Items
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="flex min-w-max">
                  {viewType === "month" && (
                    <div className="flex">
                      {monthHeaders.map((month, index) => (
                        <div
                          key={month.month.toISOString()}
                          className="px-4 py-3 text-center font-semibold text-gray-700 bg-gray-100 border-r"
                          style={{ width: `${month.width}px` }}
                        >
                          {month.label}
                        </div>
                      ))}
                    </div>
                  )}
                  {viewType !== "month" &&
                    timelineDays.map((day) => (
                      <div
                        key={day.date.toISOString()}
                        className={cn(
                          "flex-shrink-0 p-2 text-center border-r border-gray-200 relative bg-gray-50",
                          day.isWeekend && "bg-gray-100",
                          day.isToday && "bg-blue-50 border-blue-200",
                          day.isWeekStart && "border-l border-gray-300",
                        )}
                        style={{ width: `${dayWidth}px` }}
                      >
                        <div
                          className={cn(
                            "text-sm font-semibold whitespace-pre-line text-gray-700",
                            day.isToday && "text-blue-600",
                          )}
                        >
                          {format(day.date, "d")}
                        </div>
                        {viewType !== "quarter" && (
                          <div className={cn("text-xs text-gray-500 mt-1 font-medium", day.isToday && "text-blue-500")}>
                            {format(day.date, "EEE")}
                          </div>
                        )}
                        {day.isToday && (
                          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-2 h-1 bg-blue-500 rounded-full" />
                        )}
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </div>

            <ScrollArea className="h-[calc(100vh-180px)]">
              <div className="min-h-0 flex-1">
                {processedTasks.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-gray-500">
                    <div className="text-center">
                      <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <div>No tasks in the selected time range</div>
                    </div>
                  </div>
                ) : (
                  processedTasks.map((task, index) => (
                    <div
                      key={task.$id}
                      className={cn(
                        "flex hover:bg-blue-50/30 transition-colors relative group border-b border-gray-100",
                        selectedTask === task.$id && "bg-blue-50/50",
                      )}
                      style={{ height: "48px" }}
                    >
                      <div className="w-80 px-4 border-r bg-white flex items-center">
                        <div className="flex items-center gap-3 w-full">
                          <ChevronRightIcon className="h-3 w-3 text-gray-400 flex-shrink-0" />

                          <div className="flex-shrink-0">{getTaskTypeIcon(task.status as TaskStatus)}</div>

                          <Badge
                            variant="outline"
                            className="text-xs font-mono text-gray-600 bg-gray-50 border-gray-200 px-1.5 py-0.5"
                          >
                            TBT-{Math.floor(Math.random() * 100) + 10}
                          </Badge>

                          <div className="min-w-0 flex-grow">
                            <div className="font-medium text-sm text-gray-900 truncate" title={task.name}>
                              {task.name}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {task.assignee && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <MemberAvatar name={task.assignee.name} className="h-6 w-6 border border-gray-200" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{task.assignee.name}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 relative bg-white">
                        <div className="flex min-w-max relative h-full">
                          {timelineDays.map((day) => (
                            <div
                              key={day.date.toISOString()}
                              className={cn(
                                "flex-shrink-0 border-r border-gray-100 relative",
                                day.isWeekend && "bg-gray-50/50",
                                day.isToday && "bg-blue-50/30 border-blue-200",
                                day.isWeekStart && "border-l border-gray-200",
                              )}
                              style={{
                                width: `${dayWidth}px`,
                                height: "48px",
                              }}
                            />
                          ))}

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute top-1/2 transform -translate-y-1/2 cursor-pointer"
                                style={{
                                  left: `${task.startOffset * dayWidth + 4}px`,
                                  width: !task.isMilestone ? `${dayWidth - 8}px` : `${task.duration * dayWidth - 8}px`,
                                }}
                                onClick={() => setSelectedTask(selectedTask === task.$id ? null : task.$id)}
                              >
                                {!task.isMilestone ? (
                                  <div className="flex justify-center items-center h-full">
                                    <div
                                      className={cn(
                                        "w-3 h-3 transform rotate-45 border-2 border-white shadow-sm",
                                        statusConfig[task.status as TaskStatus].color,
                                        "hover:scale-110 transition-transform",
                                      )}
                                    />
                                  </div>
                                ) : (
                                  <div
                                    className={cn(
                                      "h-7 rounded-md flex items-center px-3 text-white text-xs font-medium overflow-hidden transition-all group-hover:shadow-lg relative border border-white/20",
                                      statusConfig[task.status as TaskStatus].color,
                                      selectedTask === task.$id && "ring-2 ring-blue-400 ring-offset-1",
                                    )}
                                    style={{
                                      minWidth: `${dayWidth - 10}px`,
                                    }}
                                  >
                                    <div className="flex items-center justify-between w-full gap-2">
                                      <span className="truncate font-medium">{task.name}</span>
                                      {task.assignee && (
                                        <div className="flex-shrink-0 rounded-full overflow-hidden border border-white/30">
                                          <MemberAvatar name={task.assignee.name} className="h-5 w-5" />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            {/* TOOL TIP */}
                            <TooltipContent className="bg-gray-900 text-white border-gray-700">
                              <div className="space-y-1">
                                <p className="font-medium">{task.name}</p>
                                <p className="text-xs opacity-90">
                                  {task.isMilestone ? "Milestone: " : "Duration: "}
                                  {format(task.taskStart, "MMM dd, yyyy")}
                                  {task.isMilestone && ` - ${format(task.taskEnd, "MMM dd, yyyy")}`}
                                </p>
                                <p className="text-xs opacity-90">Status: {task.status}</p>
                                {task.assignee && <p className="text-xs opacity-90">Assignee: {task.assignee.name}</p>}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
