"use client";

import { useState, useMemo } from "react";
import { Filter, Loader2 } from "lucide-react";

import { useGetProjectActivityLogs } from "@/features/audit-logs/hooks/use-get-project-activity-logs";
import { ActivityTableView } from "@/features/audit-logs/components/activity-table-view";
import { ActivityType, type ActivityLog } from "@/features/audit-logs/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { PageLoader } from "@/components/page-loader";
import { PageError } from "@/components/page-error";

type EnrichedActivityLog = ActivityLog & { description: string };

type PageData = {
  data: EnrichedActivityLog[];
  nextCursor?: string;
  hasMore: boolean;
};

export default function ProjectAuditLogsPage() {
  const workspaceId = useWorkspaceId();
  const projectId = useProjectId();

  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");

  const {
    data,
    isLoading: isLoadingActivities,
    error: activitiesError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useGetProjectActivityLogs({
    workspaceId,
    projectId,
    limit: 50,
  });

  // Flatten all pages into a single array
  const allActivities = useMemo((): EnrichedActivityLog[] => {
    if (!data?.pages) return [];
    return (data.pages as PageData[]).flatMap((page) => page.data);
  }, [data]);

  // Frontend filtering
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

      return true;
    });
  }, [allActivities, selectedType, selectedAction, selectedUser]);

  // Get unique users for filter
  const uniqueUsers = useMemo(() => {
    const usersMap = new Map<string, { id: string; name: string }>();

    allActivities.forEach((activity: EnrichedActivityLog) => {
      if (activity.userId && activity.userName) {
        usersMap.set(activity.userId, {
          id: activity.userId,
          name: activity.userName,
        });
      }
    });

    return Array.from(usersMap.values());
  }, [allActivities]);

  if (isLoadingActivities && !data) {
    return <PageLoader />;
  }

  if (activitiesError) {
    return <PageError message="Failed to load audit logs" />;
  }

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Project Audit Logs</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="size-4" />
              Activity Logs
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.values(ActivityType).map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0) + type.slice(1).toLowerCase().replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="updated">Updated</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {uniqueUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingActivities && !data ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <>
              <ActivityTableView activities={activities || []} />

              {/* Load More Button */}
              {hasNextPage && (
                <div className="flex justify-center mt-6">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="gap-2"
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load More"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
