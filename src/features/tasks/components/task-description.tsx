"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, GitCommit, Copy, Check } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RichTextEditor, setMentionMembers } from "@/components/editor";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useLocalDraft } from "@/hooks/use-local-draft";

import { useUpdateTask } from "../api/use-update-task";
import { Task } from "../types";

interface TaskDescriptionProps {
  task: Task;
  canEdit?: boolean;
  workspaceId?: string;
  projectId?: string;
}

export const TaskDescription = ({
  task,
  canEdit = true,
  workspaceId,
  projectId
}: TaskDescriptionProps) => {
  const { mutate: updateTask } = useUpdateTask();
  const { data: members } = useGetMembers({ workspaceId: workspaceId || "" });
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    navigator.clipboard.writeText(`git commit -m "feat: [${task.key}] your message"`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Commit command copied");
  };

  // Convert GitHub asset URLs to proxy URLs for rendering/display
  const toProxyUrl = useCallback((text: string) => {
    if (!projectId) return text;
    const githubAssetRegex = /(https:\/\/github\.com\/user-attachments\/assets\/[a-zA-Z0-9.\/_-]+|https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/assets\/[0-9]+\/[a-zA-Z0-9.\/_-]+)/g;
    return text.replace(githubAssetRegex, (match) => {
      return `/api/github/image-proxy?projectId=${projectId}&url=${encodeURIComponent(match)}`;
    });
  }, [projectId]);

  // Convert proxy URLs back to original GitHub asset URLs for saving
  const fromProxyUrl = useCallback((text: string) => {
    const proxyRegex = /\/api\/github\/image-proxy\?projectId=[a-zA-Z0-9_-]+&url=([^"'\s>]+)/g;
    return text.replace(proxyRegex, (match, urlParam) => {
      try {
        return decodeURIComponent(urlParam);
      } catch {
        return urlParam;
      }
    });
  }, []);

  // Use localStorage-based draft
  const {
    content: value,
    setContent: setValue,
    isSyncing: isSaving,
  } = useLocalDraft({
    taskId: task.$id,
    initialContent: toProxyUrl(task.description || ""),
    onSync: async (content) => {
      updateTask({
        param: { taskId: task.$id },
        json: { description: fromProxyUrl(content) },
      });
    },
  });

  // Update mention members when they load
  useEffect(() => {
    if (members?.documents) {
      setMentionMembers(
        members.documents.map((member) => ({
          // CRITICAL: Use userId for mention data-id, not member document $id
          // This ensures notifications are routed to the correct user
          id: member.userId,
          name: member.name || "",
          email: member.email,
          imageUrl: member.profileImageUrl,
        }))
      );
    }
  }, [members]);

  const handleChange = (content: string) => {
    if (!canEdit) return;
    setValue(content);
  };

  // Handle image upload for inline images in description
  const handleImageUpload = useCallback(async (file: File): Promise<string | null> => {
    if (!workspaceId) return null;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("taskId", task.$id);
      formData.append("workspaceId", workspaceId);

      const response = await fetch('/api/attachments/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        toast.error("Failed to upload image");
        return null;
      }

      const data = await response.json();
      const url = data?.data?.url;
      return url;
    } catch {
      toast.error("Failed to upload image");
      return null;
    }
  }, [task.$id, workspaceId]);

  return (
    <div className="relative">
      {/* Status indicator */}
      {isSaving && (
        <div className="absolute -top-6 right-0 flex items-center gap-1 text-xs text-gray-400 z-10">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Saving...</span>
        </div>
      )}

      <RichTextEditor
        content={value}
        onChange={handleChange}
        placeholder="Add a description... Use @ to mention team members, / for commands"
        editable={canEdit}
        workspaceId={workspaceId}
        projectId={projectId}
        minHeight="100px"
        showToolbar={canEdit}
        onImageUpload={canEdit && workspaceId ? handleImageUpload : undefined}
        className={cn(
          "border-0 bg-transparent",
          !canEdit && "pointer-events-none"
        )}
      />

      <div className="mt-8 flex items-center justify-between rounded-lg border border-dashed border-border p-3 bg-muted/10">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <GitCommit className="size-3.5 text-blue-500" />
            Link GitHub Commits & PRs
          </p>
          <p className="text-[11px] text-muted-foreground">
            Include <span className="font-mono font-medium text-foreground bg-muted px-1 py-0.5 rounded">[{task.key}]</span> in your commit message or branch name.
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={onCopy}>
          {copied ? <Check className="size-3 mr-1 text-green-500" /> : <Copy className="size-3 mr-1" />}
          {copied ? "Copied" : "Copy Command"}
        </Button>
      </div>
    </div>
  );
};
