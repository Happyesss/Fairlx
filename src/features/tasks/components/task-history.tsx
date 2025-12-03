"use client";

import { useMemo } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Clock,
  FileText,
  MessageCircle,
  Paperclip,
  PenLine,
  Plus,
  History as HistoryIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { useGetComments } from "@/features/comments/hooks/use-get-comments";
import { useGetAttachments } from "@/features/attachments/hooks/use-get-attachments";
import { useGetTimeLogs } from "@/features/time-tracking/api/use-get-time-logs";
import { PopulatedTask } from "@/features/tasks/types";
import { Attachment } from "@/features/attachments/types";

interface TaskHistoryProps {
  task: PopulatedTask;
  workspaceId: string;
}

interface HistoryItem {
  id: string;
  type: "created" | "updated" | "comment" | "attachment" | "timelog";
  timestamp: string;
  description: string;
  userName?: string;
  userEmail?: string;
  userImage?: string;
  metadata?: Record<string, unknown>;
}

const getHistoryIcon = (type: HistoryItem["type"]) => {
  switch (type) {
    case "created":
      return Plus;
    case "updated":
      return PenLine;
    case "comment":
      return MessageCircle;
    case "attachment":
      return Paperclip;
    case "timelog":
      return Clock;
    default:
      return FileText;
  }
};

const getHistoryColor = (type: HistoryItem["type"]) => {
  switch (type) {
    case "created":
      return "bg-green-100 text-green-700";
    case "updated":
      return "bg-blue-100 text-blue-700";
    case "comment":
      return "bg-purple-100 text-purple-700";
    case "attachment":
      return "bg-orange-100 text-orange-700";
    case "timelog":
      return "bg-cyan-100 text-cyan-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const HistoryItemComponent = ({ item }: { item: HistoryItem }) => {
  const Icon = getHistoryIcon(item.type);
  const colorClass = getHistoryColor(item.type);
  
  const initials = item.userName
    ? item.userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2)
    : "??";

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0">
      <div className="relative">
        <Avatar className="h-8 w-8 border border-border">
          <AvatarImage src={item.userImage} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className={`absolute -bottom-1 -right-1 rounded-full p-0.5 ${colorClass}`}>
          <Icon className="h-2.5 w-2.5" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">
            {item.userName || "Unknown User"}
          </span>
          <span className="text-sm text-muted-foreground">
            {item.description}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
          </span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(item.timestamp), "MMM d, yyyy 'at' h:mm a")}
          </span>
        </div>
      </div>

      <Badge variant="secondary" className={`text-xs ${colorClass} capitalize`}>
        {item.type === "timelog" ? "time log" : item.type}
      </Badge>
    </div>
  );
};

export const TaskHistory = ({ task, workspaceId }: TaskHistoryProps) => {
  // Fetch related data
  const { data: comments, isLoading: commentsLoading } = useGetComments({
    taskId: task.$id,
    workspaceId,
  });

  const { data: attachments, isLoading: attachmentsLoading } = useGetAttachments({
    taskId: task.$id,
    workspaceId,
  });

  const { data: timeLogs, isLoading: timeLogsLoading } = useGetTimeLogs({
    taskId: task.$id,
    workspaceId,
  });

  const isLoading = commentsLoading || attachmentsLoading || timeLogsLoading;

  // Build unified history from all sources
  const historyItems = useMemo(() => {
    const items: HistoryItem[] = [];

    // Task created event
    items.push({
      id: `task-created-${task.$id}`,
      type: "created",
      timestamp: task.$createdAt,
      description: "created this task",
      userName: task.assignee?.name || "Someone",
      userEmail: task.assignee?.email,
      userImage: task.assignee?.profileImageUrl || undefined,
    });

    // Task updated event (if different from created)
    if (task.$updatedAt && task.$updatedAt !== task.$createdAt) {
      items.push({
        id: `task-updated-${task.$id}`,
        type: "updated",
        timestamp: task.$updatedAt,
        description: "updated this task",
        userName: task.assignee?.name || "Someone",
        userEmail: task.assignee?.email,
        userImage: task.assignee?.profileImageUrl || undefined,
      });
    }

    // Comments
    if (comments) {
      comments.forEach((comment) => {
        items.push({
          id: `comment-${comment.$id}`,
          type: "comment",
          timestamp: comment.$createdAt,
          description: "added a comment",
          userName: comment.author?.name,
          userEmail: comment.author?.email,
          userImage: comment.author?.profileImageUrl || undefined,
          metadata: { content: comment.content.substring(0, 100) },
        });
      });
    }

    // Attachments - returns array directly
    if (attachments && Array.isArray(attachments)) {
      (attachments as Attachment[]).forEach((attachment) => {
        items.push({
          id: `attachment-${attachment.$id}`,
          type: "attachment",
          timestamp: attachment.$createdAt,
          description: `uploaded "${attachment.name}"`,
          userName: "Someone",
          metadata: { fileName: attachment.name },
        });
      });
    }

    // Time logs - returns { documents: [...] }
    if (timeLogs?.documents) {
      timeLogs.documents.forEach((log) => {
        const logHours = log.hours || 0;
        const totalMinutes = Math.round(logHours * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const durationText = hours > 0 
          ? `${hours}h ${minutes}m` 
          : `${minutes}m`;
        
        items.push({
          id: `timelog-${log.$id}`,
          type: "timelog",
          timestamp: log.$createdAt,
          description: `logged ${durationText} of work`,
          userName: log.user?.name || "Someone",
          userEmail: log.user?.email,
          metadata: { hours: logHours, description: log.description },
        });
      });
    }

    // Sort by timestamp (newest first)
    return items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [task, comments, attachments, timeLogs]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (historyItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <HistoryIcon className="h-10 w-10 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-3">
        <HistoryIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {historyItems.length} {historyItems.length === 1 ? "event" : "events"}
        </span>
      </div>
      <div className="max-h-[400px] overflow-y-auto pr-2">
        {historyItems.map((item) => (
          <HistoryItemComponent key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
};
