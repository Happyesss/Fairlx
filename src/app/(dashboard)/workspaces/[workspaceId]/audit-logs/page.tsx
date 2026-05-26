"use client";

import { useState, useMemo } from "react";
import { Filter, List, Table as TableIcon, Loader2, Activity, CheckSquare, FolderKanban, Calendar, X, ChevronDown } from "lucide-react";

import { useGetActivityLogs, useGetActivityStats } from "@/features/audit-logs/hooks/use-get-activity-logs";
import { ActivityLogCard } from "@/features/audit-logs/components/activity-log-list";
import { ActivityTableView } from "@/features/audit-logs/components/activity-table-view";
import { ActivityType, type ActivityLog } from "@/features/audit-logs/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

type EnrichedActivityLog = ActivityLog & { description: string };

type PageData = {
  data: EnrichedActivityLog[];
  nextCursor?: string;
  hasMore: boolean;
};

export default function AuditLogsPage() {
  const workspaceId = useWorkspaceId();

  const [selectedType, setSelectedType] = useState<ActivityType | "all">("all");
  const [selectedAction, setSelectedAction] = useState<"created" | "updated" | "deleted" | "all">("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "all">("30d");
  const [viewMode, setViewMode] = useState<"list" | "table">("table");

  // Memoize date range calculation to prevent re-renders
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case "7d":
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return {
          startDate: sevenDaysAgo.toISOString(),
          endDate: new Date().toISOString(),
        };
      case "30d":
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return {
          startDate: thirtyDaysAgo.toISOString(),
          endDate: new Date().toISOString(),
        };
      default:
        return { startDate: undefined, endDate: undefined };
    }
  }, [dateRange]); // Only recalculate when dateRange changes

  // Fetch activities with infinite query
  const {
    data,
    isLoading: isLoadingActivities,
    error: activitiesError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useGetActivityLogs({
    workspaceId,
    startDate,
    endDate,
    limit: 50,
  });

  // Flatten all pages into a single array
  const allActivities = useMemo((): EnrichedActivityLog[] => {
    if (!data?.pages) return [];
    return (data.pages as PageData[]).flatMap((page) => page.data);
  }, [data]);

  // Frontend filtering - filter the fetched data based on selected filters
  const activities = useMemo((): EnrichedActivityLog[] => {
    if (!allActivities) return [];

    return allActivities.filter((activity: EnrichedActivityLog) => {
      // Type filter
      if (selectedType !== "all" && activity.type !== selectedType) {
        return false;
      }

      // Action filter
      if (selectedAction !== "all" && activity.action !== selectedAction) {
        return false;
      }

      // User filter
      if (selectedUser !== "all" && activity.userId !== selectedUser) {
        return false;
      }

      // Status filter
      if (selectedStatus !== "all") {
        const activityStatus = activity.metadata?.status as string | undefined;
        if (!activityStatus || activityStatus !== selectedStatus) {
          return false;
        }
      }

      // Priority filter
      if (selectedPriority !== "all") {
        const activityPriority = activity.metadata?.priority as string | undefined;
        if (!activityPriority || activityPriority !== selectedPriority) {
          return false;
        }
      }

      return true;
    });
  }, [allActivities, selectedType, selectedAction, selectedUser, selectedStatus, selectedPriority]);

  const { data: stats, isLoading: isLoadingStats, error: statsError } = useGetActivityStats({
    workspaceId,
    startDate,
    endDate,
  });

  // Extract unique users from activities for user filter
  const uniqueUsers = useMemo(() => {
    if (!allActivities) return [];
    const usersMap = new Map<string, { id: string; name: string }>();

    allActivities.forEach((activity) => {
      if (activity.userId && activity.userName) {
        usersMap.set(activity.userId, {
          id: activity.userId,
          name: activity.userName,
        });
      }
    });

    return Array.from(usersMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [allActivities]);

  // Extract unique statuses from activities
  const uniqueStatuses = useMemo(() => {
    if (!allActivities) return [];
    const statuses = new Set<string>();

    allActivities.forEach((activity) => {
      const status = activity.metadata?.status as string | undefined;
      if (status) {
        statuses.add(status);
      }
    });

    return Array.from(statuses).sort();
  }, [allActivities]);

  // Extract unique priorities from activities
  const uniquePriorities = useMemo(() => {
    if (!allActivities) return [];
    const priorities = new Set<string>();

    allActivities.forEach((activity) => {
      const priority = activity.metadata?.priority as string | undefined;
      if (priority) {
        priorities.add(priority);
      }
    });

    return Array.from(priorities).sort();
  }, [allActivities]);

  // Show error if queries fail
  if (activitiesError || statsError) {
    return (
      <div className="flex flex-col gap-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Activity className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Audit Log</h1>
            <p className="text-sm text-muted-foreground">
              Track all activities and changes in your workspace
            </p>
          </div>
        </div>
        <Card className="border shadow-sm">
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <div className="p-3 rounded-full bg-destructive/10 mb-4">
                <X className="size-6 text-destructive" />
              </div>
              <p className="text-sm font-medium mb-1">Failed to load activity logs</p>
              <p className="text-sm text-muted-foreground">Please try again later.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Count active filters
  const activeFilterCount = [
    selectedType !== "all",
    selectedAction !== "all",
    selectedUser !== "all",
    selectedStatus !== "all",
    selectedPriority !== "all",
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-y-5">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-center gap-3 mb-4">

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
            <p className="text-sm mt-1 text-muted-foreground">
              Track all activities and changes in your workspace
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
            <Button
              variant={viewMode === "table" ? "ghost" : "ghost"}
              size="xs"
              onClick={() => setViewMode("table")}
              className={`gap-1.5 h-8 ${viewMode === "table" ? "bg-blue-600 text-white shadow-sm hover:bg-blue-600 hover:text-white" : "hover:bg-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <TableIcon className="size-3.5" />
              Table
            </Button>
            <Button
              variant={viewMode === "list" ? "ghost" : "ghost"}
              size="xs"
              onClick={() => setViewMode("list")}
              className={`gap-1.5 h-8 ${viewMode === "list" ? "bg-blue-600 text-white shadow-sm hover:bg-blue-600 hover:text-white" : "hover:bg-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <List className="size-3.5" />
              List
            </Button>
          </div>

        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Activity className="size-4 text-blue-600" />
              </div>
              <div className="min-w-0 ">
                <p className="text-xs font-medium text-muted-foreground truncate">Total Activities</p>
                <div className="text-sm font-medium mt-0.5">
                  {isLoadingStats ? (
                    <Skeleton className="h-6 w-10" />
                  ) : (
                    stats?.totalActivities || 0
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckSquare className="size-4 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground truncate">Task Changes</p>
                <div className="text-sm font-medium mt-0.5">
                  {isLoadingStats ? (
                    <Skeleton className="h-6 w-10" />
                  ) : (
                    stats?.activitiesByType?.task || 0
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <FolderKanban className="size-4 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground truncate">Project Changes</p>
                <div className="text-sm font-medium mt-0.5">
                  {isLoadingStats ? (
                    <Skeleton className="h-6 w-10" />
                  ) : (
                    stats?.activitiesByType?.project || 0
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Calendar className="size-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground truncate">Time Period</p>
                <p className="text-sm font-medium mt-0.5">
                  {dateRange === "7d" ? "7 days" : dateRange === "30d" ? "30 days" : "All"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="size-4" />
              <span className="font-medium">Filters</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </div>

            <div className="h-4 w-px bg-border" />

            <Select value={selectedType} onValueChange={(value) => setSelectedType(value as ActivityType | "all")}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent >
                <SelectItem className="text-xs" value="all">All Types</SelectItem>
                <SelectItem className="text-xs" value={ActivityType.TASK}>Tasks</SelectItem>
                <SelectItem className="text-xs" value={ActivityType.PROJECT}>Projects</SelectItem>
                <SelectItem className="text-xs" value={ActivityType.SPRINT}>Sprints</SelectItem>
                <SelectItem className="text-xs" value={ActivityType.WORK_ITEM}>Work Items</SelectItem>
                <SelectItem className="text-xs" value={ActivityType.MEMBER}>Members</SelectItem>
                <SelectItem className="text-xs" value={ActivityType.TIME_LOG}>Time Logs</SelectItem>
                <SelectItem className="text-xs" value={ActivityType.ATTACHMENT}>Attachments</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedAction} onValueChange={(value) => setSelectedAction(value as "created" | "updated" | "deleted" | "all")}>
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="text-xs" value="all">All Actions</SelectItem>
                <SelectItem className="text-xs" value="created">Created</SelectItem>
                <SelectItem className="text-xs" value="updated">Updated</SelectItem>
                <SelectItem className="text-xs" value="deleted">Deleted</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="text-xs" value="all">All Users</SelectItem>
                {uniqueUsers.map((user) => (
                  <SelectItem className="text-xs" key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {uniqueStatuses.length > 0 && (
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem className="text-xs" value="all">All Statuses</SelectItem>
                  {uniqueStatuses.map((status) => (
                    <SelectItem className="text-xs" key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {uniquePriorities.length > 0 && (
              <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem className="text-xs" value="all">All Priorities</SelectItem>
                  {uniquePriorities.map((priority) => (
                    <SelectItem className="text-xs" key={priority} value={priority}>
                      {priority}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="h-4 w-px bg-border" />

            <Select value={dateRange} onValueChange={(value) => setDateRange(value as "7d" | "30d" | "all")}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <Calendar className="size-3.5 mr-1.5" />
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="text-xs" value="7d">Last 7 Days</SelectItem>
                <SelectItem className="text-xs" value="30d">Last 30 Days</SelectItem>
                <SelectItem className="text-xs" value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => {
                  setSelectedType("all");
                  setSelectedAction("all");
                  setSelectedUser("all");
                  setSelectedStatus("all");
                  setSelectedPriority("all");
                }}
              >
                <X className="size-3.5 mr-1" />
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Activity Log Content */}
      {viewMode === "table" ? (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between mb-4">
              <div>
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  Activity History
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {activities.length} {activities.length === 1 ? "activity" : "activities"} found
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingActivities ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 rounded-lg border">
                    <Skeleton className="size-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <ActivityTableView activities={activities || []} />
                </div>

                {/* Load More Button */}
                {hasNextPage && (
                  <div className="flex justify-center mt-6 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="gap-2"
                      size="sm"
                    >
                      {isFetchingNextPage ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <ChevronDown className="size-3.5" />
                          Load More Activities
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <ActivityLogCard
          workspaceId={workspaceId}
          activities={activities || []}
          isLoading={isLoadingActivities}
          title="Activity Feed"
        />
      )}
    </div>
  );
}
