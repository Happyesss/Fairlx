"use client";

import { MessageCircle } from "lucide-react";
import { DottedSeparator } from "@/components/dotted-separator";

import { CommentInput } from "./comment-input";
import { CommentList } from "./comment-list";

interface TaskCommentsProps {
  taskId: string;
  workspaceId: string;
  currentUserId: string;
  isAdmin?: boolean;
}

export const TaskComments = ({
  taskId,
  workspaceId,
  currentUserId,
  isAdmin = false,
}: TaskCommentsProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Comments</h3>
      </div>
      
      <DottedSeparator />

      {/* Comment List */}
      <CommentList
        taskId={taskId}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />

      <DottedSeparator />

      {/* New Comment Input */}
      <CommentInput taskId={taskId} workspaceId={workspaceId} />
    </div>
  );
};
