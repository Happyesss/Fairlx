"use client";

import { Loader2, MessageSquare } from "lucide-react";

import { useGetComments } from "../hooks/use-get-comments";
import { CommentItem } from "./comment-item";

interface CommentListProps {
  taskId: string;
  workspaceId: string;
  currentUserId: string;
  isAdmin?: boolean;
}

export const CommentList = ({
  taskId,
  workspaceId,
  currentUserId,
  isAdmin = false,
}: CommentListProps) => {
  const { data: comments, isLoading, isError } = useGetComments({
    taskId,
    workspaceId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Failed to load comments. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comments && comments.length > 0 ? (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.$id}
              comment={comment}
              taskId={taskId}
              workspaceId={workspaceId}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No comments yet</p>
          <p className="text-xs text-muted-foreground">
            Be the first to add a comment
          </p>
        </div>
      )}
    </div>
  );
};
