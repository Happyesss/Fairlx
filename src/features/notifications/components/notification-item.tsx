"use client";

import { formatDistanceToNow } from "date-fns";
import {
  MessageSquare,
  CheckCircle2,
  UserPlus,
  ArrowRight,
  Flag,
  Calendar,
  Paperclip,
  Trash2,
  AtSign,
  Reply,
  FileText,
  Bell,
  X,
  Gift,
} from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { PopulatedNotification, NotificationType, NotificationMetadata } from "../types";
import { useMarkNotificationRead } from "../api/use-mark-notification-read";
import { useDeleteNotification } from "../api/use-delete-notification";

interface NotificationItemProps {
  notification: PopulatedNotification;
  workspaceId: string;
}

// Clean icon config per type
const getTypeConfig = (type: NotificationType) => {
  const configs: Record<string, { icon: typeof Bell; accent: string; bg: string }> = {
    [NotificationType.TASK_ASSIGNED]: {
      icon: UserPlus,
      accent: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/40",
    },
    [NotificationType.TASK_COMMENT]: {
      icon: MessageSquare,
      accent: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
    },
    [NotificationType.TASK_MENTION]: {
      icon: AtSign,
      accent: "text-violet-500",
      bg: "bg-violet-50 dark:bg-violet-950/40",
    },
    [NotificationType.TASK_REPLY]: {
      icon: Reply,
      accent: "text-sky-500",
      bg: "bg-sky-50 dark:bg-sky-950/40",
    },
    [NotificationType.TASK_COMPLETED]: {
      icon: CheckCircle2,
      accent: "text-green-500",
      bg: "bg-green-50 dark:bg-green-950/40",
    },
    [NotificationType.TASK_STATUS_CHANGED]: {
      icon: ArrowRight,
      accent: "text-purple-500",
      bg: "bg-purple-50 dark:bg-purple-950/40",
    },
    [NotificationType.TASK_PRIORITY_CHANGED]: {
      icon: Flag,
      accent: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-950/40",
    },
    [NotificationType.TASK_DUE_DATE_CHANGED]: {
      icon: Calendar,
      accent: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/40",
    },
    [NotificationType.TASK_ATTACHMENT_ADDED]: {
      icon: Paperclip,
      accent: "text-cyan-500",
      bg: "bg-cyan-50 dark:bg-cyan-950/40",
    },
    [NotificationType.TASK_ATTACHMENT_DELETED]: {
      icon: Trash2,
      accent: "text-red-500",
      bg: "bg-red-50 dark:bg-red-950/40",
    },
    [NotificationType.TASK_UPDATED]: {
      icon: FileText,
      accent: "text-slate-500",
      bg: "bg-slate-50 dark:bg-slate-800/40",
    },
    [NotificationType.REWARD_CREDITED]: {
      icon: Gift,
      accent: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-950/40",
    },
  };

  return configs[type] || {
    icon: Bell,
    accent: "text-slate-500",
    bg: "bg-slate-50 dark:bg-slate-800/40",
  };
};

const parseMetadata = (metadata?: string): NotificationMetadata | null => {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata);
  } catch {
    return null;
  }
};

// Render compact inline detail for status/priority changes
const renderInlineDetail = (type: NotificationType, metadata: NotificationMetadata | null) => {
  if (!metadata) return null;

  if (type === NotificationType.TASK_STATUS_CHANGED && metadata.oldStatus && metadata.newStatus) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <span className="line-through">{metadata.oldStatus.replace(/_/g, " ")}</span>
        <ArrowRight className="size-3" />
        <span className="font-medium text-foreground">{metadata.newStatus.replace(/_/g, " ")}</span>
      </span>
    );
  }

  if (type === NotificationType.TASK_PRIORITY_CHANGED && metadata.oldPriority && metadata.newPriority) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <span className="line-through">{metadata.oldPriority}</span>
        <ArrowRight className="size-3" />
        <span className="font-medium text-foreground">{metadata.newPriority}</span>
      </span>
    );
  }

  return null;
};

export const NotificationItem = ({
  notification,
  workspaceId,
}: NotificationItemProps) => {
  const { mutate: markAsRead, isPending: isMarkingRead } = useMarkNotificationRead();
  const { mutate: deleteNotification, isPending: isDeleting } = useDeleteNotification();

  const config = getTypeConfig(notification.type);
  const Icon = config.icon;
  const metadata = parseMetadata(notification.metadata);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!notification.read) {
      markAsRead({ param: { notificationId: notification.$id }, workspaceId });
    } else {
      deleteNotification({ param: { notificationId: notification.$id }, workspaceId });
    }
  };

  const taskLink = notification.type === NotificationType.REWARD_CREDITED
    ? `/workspaces/${workspaceId}/rewards`
    : (notification.taskId && notification.taskId !== "reward-event")
      ? `/workspaces/${workspaceId}/tasks/${notification.taskId}`
      : "#";

  const timeAgo = formatDistanceToNow(new Date(notification.$createdAt), { addSuffix: true });
  const userName = notification.triggeredByUser?.name || "Someone";
  const userInitial = userName.charAt(0).toUpperCase();

  // Check if this is a comment/mention/reply type with content
  const hasCommentContent = metadata?.commentContent && (
    notification.type === NotificationType.TASK_COMMENT ||
    notification.type === NotificationType.TASK_MENTION ||
    notification.type === NotificationType.TASK_REPLY
  );

  // Strip mention format markers: @Name[id] -> @Name
  const commentPreview = metadata?.commentContent
    ? metadata.commentContent.replace(/\[([a-zA-Z0-9]+)\]/g, "").slice(0, 140)
    : null;

  return (
    <Link href={taskLink} className="block">
      <div
        className={cn(
          "relative flex items-start gap-3 px-4 py-3 transition-colors group",
          "hover:bg-muted/50",
          !notification.read && "bg-blue-50/60 dark:bg-blue-950/15"
        )}
      >
        {/* Unread dot */}
        {!notification.read && (
          <div className="absolute left-1 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-blue-500" />
        )}

        {/* User avatar with type icon overlay */}
        <div className="relative flex-shrink-0">
          <Avatar className="size-9">
            <AvatarImage
              src={notification.triggeredByUser?.profileImageUrl || undefined}
              alt={userName}
            />
            <AvatarFallback className="text-xs font-medium bg-muted">
              {userInitial}
            </AvatarFallback>
          </Avatar>
          <div className={cn(
            "absolute -bottom-0.5 -right-0.5 size-[18px] rounded-full flex items-center justify-center border-2 border-background",
            config.bg
          )}>
            <Icon className={cn("size-2.5", config.accent)} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-0.5">
          {/* Main message */}
          <p className="text-[13px] leading-snug">
            <span className="font-semibold text-foreground">{userName}</span>
            {" "}
            <span className="text-muted-foreground">{notification.message.replace(userName, "").trim()}</span>
          </p>

          {/* Comment preview */}
          {hasCommentContent && commentPreview && (
            <div className="mt-1 px-2.5 py-1.5 rounded-md bg-muted/60 border-l-2 border-muted-foreground/20">
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 italic">
                &ldquo;{commentPreview}&rdquo;
              </p>
            </div>
          )}

          {/* Inline status/priority detail */}
          {renderInlineDetail(notification.type, metadata)}

          {/* Timestamp */}
          <p className="text-[11px] text-muted-foreground/60">{timeAgo}</p>
        </div>

        {/* Dismiss button - visible on hover */}
        <Button
          size="icon"
          variant="ghost"
          className="size-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          onClick={handleDismiss}
          disabled={isMarkingRead || isDeleting}
          title={notification.read ? "Remove" : "Dismiss"}
        >
          <X className="size-3" />
        </Button>
      </div>
    </Link>
  );
};
