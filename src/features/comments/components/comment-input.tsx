"use client";

import { useState } from "react";

import { useCreateComment } from "../hooks/use-create-comment";
import { MentionInput } from "./mention-input";

interface CommentInputProps {
  taskId: string;
  workspaceId: string;
  parentId?: string;
  placeholder?: string;
  onSuccess?: () => void;
  autoFocus?: boolean;
}

export const CommentInput = ({
  taskId,
  workspaceId,
  parentId,
  placeholder = "Write a comment... Use @ to mention someone",
  onSuccess,
  autoFocus = false,
}: CommentInputProps) => {
  const [content, setContent] = useState("");
  const { mutate: createComment, isPending } = useCreateComment();

  const handleSubmit = () => {
    if (!content.trim()) return;

    createComment(
      {
        content: content.trim(),
        taskId,
        workspaceId,
        parentId,
      },
      {
        onSuccess: () => {
          setContent("");
          onSuccess?.();
        },
      }
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <MentionInput
        workspaceId={workspaceId}
        value={content}
        onChange={setContent}
        onSubmit={handleSubmit}
        placeholder={placeholder}
        disabled={isPending}
        autoFocus={autoFocus}
      />
    </form>
  );
};
