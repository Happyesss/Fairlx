"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { parseContentWithMentions } from "../utils/mention-utils";

interface CommentContentProps {
  content: string;
  workspaceId: string;
  className?: string;
}

export const CommentContent = ({
  content,
  workspaceId,
  className,
}: CommentContentProps) => {
  const { data: members } = useGetMembers({ workspaceId });

  const parts = useMemo(() => {
    return parseContentWithMentions(content, members?.documents);
  }, [content, members?.documents]);

  return (
    <p className={cn("text-sm mt-1 whitespace-pre-wrap break-words", className)}>
      {parts.map((part, index) => {
        if (part.type === "mention") {
          return (
            <span
              key={index}
              className="inline-flex items-center px-1 py-0.5 rounded bg-primary/10 text-primary font-medium text-sm cursor-default hover:bg-primary/20 transition-colors"
            >
              @{part.name}
            </span>
          );
        }
        return <span key={index}>{part.content}</span>;
      })}
    </p>
  );
};
