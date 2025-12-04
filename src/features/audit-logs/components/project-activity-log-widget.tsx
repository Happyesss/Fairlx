"use client";

import { Clock, ExternalLink, CheckSquare, Zap, FileText, Timer, Paperclip, Users, Pin } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberAvatar } from "@/features/members/components/member-avatar";

import { useGetRecentProjectActivityLogs } from "../hooks/use-get-project-activity-logs";
import { ActivityType } from "../types";

interface ProjectActivityLogWidgetProps {
  workspaceId: string;
  projectId: string;
  limit?: number;
}

const getActivityIcon = (type: ActivityType) => {
  switch (type) {
    case ActivityType.TASK:
      return <CheckSquare className="size-4" />;
    case ActivityType.SPRINT:
      return <Zap className="size-4" />;
    case ActivityType.WORK_ITEM:
      return <FileText className="size-4" />;
    case ActivityType.TIME_LOG:
      return <Timer className="size-4" />;
    case ActivityType.ATTACHMENT:
      return <Paperclip className="size-4" />;
    case ActivityType.MEMBER:
      return <Users className="size-4" />;
    default:
      return <Pin className="size-4" />;
  }
};

const getActionColor = (action: string) => {
  switch (action) {
    case "created":
      return "text-green-600";
    case "updated":
      return "text-blue-600";
    case "deleted":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
};

export const ProjectActivityLogWidget = ({
  workspaceId,
  projectId,
  limit = 5,
}: ProjectActivityLogWidgetProps) => {
  const { data, isLoading, error } = useGetRecentProjectActivityLogs({
    workspaceId,
    projectId,
    limit,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="size-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="size-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Failed to load activity logs
          </p>
        </CardContent>
      </Card>
    );
  }

  const activities = data.data || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="size-4" />
            Recent Activity
          </CardTitle>
          <Link
            href={`/workspaces/${workspaceId}/projects/${projectId}/audit-logs`}
          >
            <Button variant="ghost" size="sm" className="h-8 gap-2">
              View All
              <ExternalLink className="size-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No activity yet
          </p>
        ) : (
          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {activity.userName && (
                        <MemberAvatar
                          name={activity.userName}
                          imageUrl={activity.userImageUrl}
                          className="size-6"
                          tooltipText={activity.userName}
                        />
                      )}
                      <p className="text-sm font-medium truncate">
                        {activity.userName || "Someone"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(activity.timestamp), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className={getActionColor(activity.action)}>
                      {activity.action}
                    </span>{" "}
                    {activity.description || activity.entityName || "an item"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
