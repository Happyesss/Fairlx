"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  // Clock,
  // FileText,
  // MessageCircle,
  // Paperclip,
  // PenLine,
  // Plus,
  History as HistoryIcon,
  Reply,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useGetComments } from "@/features/comments/hooks/use-get-comments";
import { CommentContent } from "@/features/comments/components/comment-content";
import { useGetAttachments } from "@/features/attachments/hooks/use-get-attachments";
import { useGetTimeLogs } from "@/features/time-tracking/api/use-get-time-logs";
import { useUpdateComment } from "@/features/comments/hooks/use-update-comment";
import { useDeleteComment } from "@/features/comments/hooks/use-delete-comment";
import { useCreateComment } from "@/features/comments/hooks/use-create-comment";
import { useConfirm } from "@/hooks/use-confirm";
import { PopulatedTask } from "@/features/tasks/types";
import { Attachment } from "@/features/attachments/types";
import { PopulatedComment } from "@/features/comments/types";

interface TaskHistoryProps {
  task: PopulatedTask;
  workspaceId: string;
  currentUserId?: string;
  isAdmin?: boolean;
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
  comment?: PopulatedComment;
}



const getHistoryColor = (type: HistoryItem["type"]) => {
  switch (type) {
    case "created":
      return "bg-blue-500";
    case "updated":
      return "bg-orange-500";
    case "comment":
      return "bg-emerald-500";
    case "attachment":
      return "bg-purple-500";
    case "timelog":
      return "bg-cyan-500";
    default:
      return "bg-gray-500";
  }
};

// Reply Component for nested replies
const ReplyItem = ({
  reply,
  taskId,
  workspaceId,
  currentUserId,
  isAdmin,
}: {
  reply: PopulatedComment;
  taskId: string;
  workspaceId: string;
  currentUserId?: string;
  isAdmin?: boolean;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);

  const { mutate: updateComment, isPending: isUpdating } = useUpdateComment({
    taskId,
    workspaceId,
  });
  const { mutate: deleteComment, isPending: isDeleting } = useDeleteComment({
    taskId,
    workspaceId,
  });

  const [DeleteDialog, confirmDelete] = useConfirm(
    "Delete Reply",
    "Are you sure you want to delete this reply?",
    "destructive"
  );

  const isAuthor = reply.authorId === currentUserId;
  const canEdit = isAuthor;
  const canDelete = isAuthor || isAdmin;

  const initials = reply.author?.name
    ? reply.author.name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2)
    : "??";

  const handleEdit = () => {
    if (!editContent.trim()) return;
    updateComment(
      { param: { commentId: reply.$id }, json: { content: editContent.trim(), workspaceId } },
      { onSuccess: () => setIsEditing(false) }
    );
  };

  const handleDelete = async () => {
    const ok = await confirmDelete();
    if (!ok) return;
    deleteComment({ param: { commentId: reply.$id }, json: { workspaceId } });
  };

  return (
    <>
      <DeleteDialog />
      <div className="flex gap-3 py-2 ml-8 group">
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarImage src={reply.author?.profileImageUrl || undefined} />
          <AvatarFallback className="text-xs bg-emerald-400 text-white">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="bg-muted/50 border border-border rounded-lg px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">
                  {reply.author?.name || "Unknown User"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(reply.$createdAt), { addSuffix: true })}
                </span>
              </div>

              {(canEdit || canDelete) && !isEditing && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEdit && (
                        <DropdownMenuItem onClick={() => setIsEditing(true)}>
                          <Pencil className="h-3 w-3 mr-2" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem onClick={handleDelete} disabled={isDeleting} className="text-destructive">
                          <Trash2 className="h-3 w-3 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[60px] resize-none text-sm"
                  disabled={isUpdating}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleEdit} disabled={isUpdating || !editContent.trim()}>
                    <Check className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setIsEditing(false); setEditContent(reply.content); }} disabled={isUpdating}>
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <CommentContent content={reply.content} workspaceId={workspaceId} />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// Comment component with reply functionality
const CommentHistoryItem = ({
  item,
  taskId,
  workspaceId,
  currentUserId,
  isAdmin,
}: {
  item: HistoryItem;
  taskId: string;
  workspaceId: string;
  currentUserId?: string;
  isAdmin?: boolean;
}) => {
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(item.comment?.content || "");

  const { mutate: createComment, isPending: isCreating } = useCreateComment();
  const { mutate: updateComment, isPending: isUpdating } = useUpdateComment({
    taskId,
    workspaceId,
  });
  const { mutate: deleteComment, isPending: isDeleting } = useDeleteComment({
    taskId,
    workspaceId,
  });

  const [DeleteDialog, confirmDelete] = useConfirm(
    "Delete Comment",
    "Are you sure you want to delete this comment? This will also delete all replies.",
    "destructive"
  );

  const comment = item.comment;
  const isAuthor = comment?.authorId === currentUserId;
  const canEdit = isAuthor;
  const canDelete = isAuthor || isAdmin;

  const initials = item.userName
    ? item.userName.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2)
    : "??";

  const handleReply = () => {
    if (!replyContent.trim() || !comment) return;
    createComment(
      { taskId, workspaceId, content: replyContent.trim(), parentId: comment.$id },
      {
        onSuccess: () => {
          setReplyContent("");
          setIsReplying(false);
        },
      }
    );
  };

  const handleEdit = () => {
    if (!editContent.trim() || !comment) return;
    updateComment(
      { param: { commentId: comment.$id }, json: { content: editContent.trim(), workspaceId } },
      { onSuccess: () => setIsEditing(false) }
    );
  };

  const handleDelete = async () => {
    if (!comment) return;
    const ok = await confirmDelete();
    if (!ok) return;
    deleteComment({ param: { commentId: comment.$id }, json: { workspaceId } });
  };

  return (
    <>
      <DeleteDialog />
      <div className="flex gap-3 py-3 group">
        <div className="flex-1 min-w-0">
          <div className="bg-muted/50 border border-border rounded-lg px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarImage src={item.userImage} />
                  <AvatarFallback className="text-xs bg-emerald-500 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground">
                  {item.userName || "Unknown User"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                </span>

                {!isEditing && (
                  <div className="flex items-center gap-1 ">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setIsReplying(!isReplying)}
                    >
                      <Reply className="h-3.5 w-3.5" />
                    </Button>
                    {(canEdit || canDelete) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEdit && (
                            <DropdownMenuItem onClick={() => setIsEditing(true)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem onClick={handleDelete} disabled={isDeleting} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )}
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[80px] resize-none"
                  disabled={isUpdating}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleEdit} disabled={isUpdating || !editContent.trim()}>
                    <Check className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setIsEditing(false); setEditContent(comment?.content || ""); }} disabled={isUpdating}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <CommentContent content={comment?.content || (item.metadata?.content as string) || ""} workspaceId={workspaceId} />
            )}
          </div>

          {/* Replies */}
          {comment?.replies && comment.replies.length > 0 && (
            <div className="mt-1">
              {comment.replies.map((reply) => (
                <ReplyItem
                  key={reply.$id}
                  reply={reply}
                  taskId={taskId}
                  workspaceId={workspaceId}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}

          {/* Reply Input */}
          {isReplying && (
            <div className="mt-3 ml-8">
              <div className="flex gap-2">
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply..."
                  className="min-h-[60px] resize-none text-sm"
                  disabled={isCreating}
                  autoFocus
                />
              </div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={handleReply} disabled={isCreating || !replyContent.trim()}>
                  Reply
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setIsReplying(false); setReplyContent(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const HistoryItemComponent = ({
  item,
  taskId,
  workspaceId,
  currentUserId,
  isAdmin,
}: {
  item: HistoryItem;
  taskId: string;
  workspaceId: string;
  currentUserId?: string;
  isAdmin?: boolean;
}) => {
  const colorClass = getHistoryColor(item.type);

  // For comments, use the enhanced comment component with replies
  if (item.type === "comment") {
    return (
      <CommentHistoryItem
        item={item}
        taskId={taskId}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
    );
  }


  return (
    <div className="flex items-center gap-3 py-2">
      <div className={`w-2 h-2 rounded-full ${colorClass}`} />
      <span className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{item.userName || "Unknown"}</span>
        {" "}
        {item.description}
        {" · "}
        <span className="text-muted-foreground">
          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
        </span>
      </span>
    </div>
  );
};

export const TaskHistory = ({ task, workspaceId, currentUserId, isAdmin = false }: TaskHistoryProps) => {
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

    // Task created event - use reporter (creator) info, not assignee
    items.push({
      id: `task-created-${task.$id}`,
      type: "created",
      timestamp: task.$createdAt,
      description: "created this task",
      userName: task.reporter?.name || "Someone",
      userEmail: task.reporter?.email,
      userImage: task.reporter?.profileImageUrl || undefined,
    });

    // Task updated event (if different from created)
    // Note: We don't currently track lastModifiedBy user info, so show generic message
    if (task.$updatedAt && task.$updatedAt !== task.$createdAt) {
      items.push({
        id: `task-updated-${task.$id}`,
        type: "updated",
        timestamp: task.$updatedAt,
        description: "updated this task",
        userName: "Someone", // TODO: Would need lastModifiedBy user lookup
        userEmail: undefined,
        userImage: undefined,
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
          metadata: { content: comment.content },
          comment: comment,
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

    // Sort by timestamp (oldest first) so chat flows top->oldest ... bottom->newest
    return items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [task, comments, attachments, timeLogs]);

  // Auto-scroll container to bottom when items change so the latest is next to the input
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    // Use requestAnimationFrame to wait for layout to finish
    requestAnimationFrame(() => {
      try {
        containerRef.current!.scrollTop = containerRef.current!.scrollHeight;
      } catch {
        // ignore
      }
    });
  }, [historyItems.length]);

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
    <div ref={containerRef} className="space-y-1 overflow-y-auto">
      {historyItems.map((item) => (
        <HistoryItemComponent
          key={item.id}
          item={item}
          taskId={task.$id}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  );
};
