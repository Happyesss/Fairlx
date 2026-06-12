"use client";

import { InferRequestType } from "hono";
import { client } from "@/lib/rpc";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ExternalLink,
  Link,
  Copy,
  Loader2,
  Trash as TrashIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import IconHelp from "@/components/icon-help";
import { Attachment } from "@/features/attachments/types";
import { TaskAttachments } from "@/features/attachments/components/task-attachments";
import { useLocalDraft } from "@/hooks/use-local-draft";


import { useGetTask } from "../api/use-get-task";
import { useTaskPreviewModal } from "../hooks/use-task-preview-modal";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { PopulatedTask } from "../types";

import { useUpdateTask } from "../api/use-update-task";
import { useDeleteTask } from "../api/use-delete-task";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useConfirm } from "@/hooks/use-confirm";
import { useGetProject } from "@/features/projects/api/use-get-project";
import { useCurrent } from "@/features/auth/api/use-current";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { useProjectPermissions } from "@/hooks/use-project-permissions";
import { CommentList } from "@/features/comments/components/comment-list";
import { CommentInput } from "@/features/comments/components/comment-input";

import { StatusSelector } from "@/features/custom-columns/components/status-selector";
import { PrioritySelector } from "./priority-selector";
import { TypeSelector } from "./type-selector";
import { AssigneeMultiSelect } from "./assignee-multi-select";
import { DatePicker } from "@/components/date-picker";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { WorkItemIcon } from "@/features/timeline/components/work-item-icon";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor, setMentionMembers } from "@/components/editor";
import { LabelSelector } from "./label-management";

// Default work item type labels
const typeLabels: Record<string, string> = {
  TASK: "Task",
  BUG: "Bug",
  EPIC: "Epic",
  STORY: "Story",
  SUBTASK: "Subtask",
};

type UpdateTaskPayload = InferRequestType<typeof client.api.tasks[":taskId"]["$patch"]>["json"];

interface TaskPreviewContentProps {
  task: PopulatedTask;
  workspaceId: string;
  onEdit: () => void;
  onClose: () => void;
  onAttachmentPreview?: (attachment: Attachment) => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

const TaskPreviewContent = ({ task, workspaceId, onEdit, onClose, onAttachmentPreview, onDelete, canEdit = false, canDelete = false }: TaskPreviewContentProps) => {
  const { mutate: updateTask, isPending: isUpdating } = useUpdateTask();
  const { data: members } = useGetMembers({ workspaceId });
  const { data: project } = useGetProject({ projectId: task.projectId });
  const { data: user } = useCurrent();

  const [title, setTitle] = useState(task.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Optimistic local state for dates — updates instantly on pick
  const [localStartDate, setLocalStartDate] = useState<Date | undefined>(
    task.startDate ? new Date(task.startDate) : undefined
  );
  const [localDueDate, setLocalDueDate] = useState<Date | undefined>(
    task.dueDate ? new Date(task.dueDate) : undefined
  );

  // Optimistic local state for status, type, priority, assignees — instant UI like dates
  const [localStatus, setLocalStatus] = useState<string>(task.status);
  const [localType, setLocalType] = useState<string>(task.type || "TASK");
  const [localPriority, setLocalPriority] = useState<string | undefined>(task.priority);
  const [localAssigneeIds, setLocalAssigneeIds] = useState<string[]>(task.assigneeIds || []);

  // Helper to convert plain text to HTML if needed
  const normalizeDescription = (desc: string | null | undefined): string => {
    if (!desc) return "";

    // Check if content is already HTML (contains HTML tags)
    const isHTML = /<[a-z][\s\S]*>/i.test(desc);

    if (isHTML) {
      return desc;
    }

    // Convert plain text to HTML paragraphs
    const paragraphs = desc
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => `<p>${line}</p>`)
      .join('');

    return paragraphs || '<p></p>';
  };

  // Convert GitHub asset URLs to proxy URLs for rendering/display
  const toProxyUrl = useCallback((text: string) => {
    if (!task.projectId) return text;
    const githubAssetRegex = /https:\/\/github\.com\/user-attachments\/assets\/[a-zA-Z0-9-]+/g;
    return text.replace(githubAssetRegex, (match) => {
      return `/api/github/image-proxy?projectId=${task.projectId}&url=${encodeURIComponent(match)}`;
    });
  }, [task.projectId]);

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

  // Use localStorage-based draft for description
  const {
    content: description,
    setContent: setDescription,
    isSyncing: isSavingDescription,
    syncNow: syncDescriptionNow,
  } = useLocalDraft({
    taskId: task.$id,
    initialContent: toProxyUrl(normalizeDescription(task.description)),
    onSync: async (content) => {
      updateTask({
        param: { taskId: task.$id },
        json: { description: fromProxyUrl(content) },
      });
    },
  });

  // Handle close with sync - await the sync to ensure data is saved
  const handleCloseWithSync = async () => {
    await syncDescriptionNow();
    onClose();
  };

  // Sync title when task changes
  useEffect(() => {
    setTitle(task.title);
  }, [task.title]);

  // Sync dates when task changes (e.g. from server or other updates)
  useEffect(() => {
    setLocalStartDate(task.startDate ? new Date(task.startDate) : undefined);
  }, [task.startDate]);

  useEffect(() => {
    setLocalDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
  }, [task.dueDate]);

  // Sync status, type, priority, assignees when task changes from server
  useEffect(() => {
    setLocalStatus(task.status);
  }, [task.status]);

  useEffect(() => {
    setLocalType(task.type || "TASK");
  }, [task.type]);

  useEffect(() => {
    setLocalPriority(task.priority);
  }, [task.priority]);

  useEffect(() => {
    setLocalAssigneeIds(task.assigneeIds || []);
  }, [task.assigneeIds]);

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

  const memberOptions = members?.documents.map((member) => ({
    id: member.$id,
    name: member.name,
    imageUrl: member.profileImageUrl,
  })) || [];

  const handleUpdate = (updates: UpdateTaskPayload) => {
    updateTask({
      param: { taskId: task.$id },
      json: updates,
    });
  };

  // Optimistic handlers for status, type, priority, assignees — instant UI like dates
  const handleStatusChange = useCallback((value: string) => {
    const prev = localStatus;
    setLocalStatus(value);
    updateTask(
      { param: { taskId: task.$id }, json: { status: value } },
      { onError: () => { setLocalStatus(prev); } }
    );
  }, [task.$id, localStatus, updateTask]);

  const handleTypeChange = useCallback((value: string) => {
    const prev = localType;
    setLocalType(value);
    updateTask(
      { param: { taskId: task.$id }, json: { type: value } },
      { onError: () => { setLocalType(prev); } }
    );
  }, [task.$id, localType, updateTask]);

  const handlePriorityChange = useCallback((value: string) => {
    const prev = localPriority;
    setLocalPriority(value);
    updateTask(
      { param: { taskId: task.$id }, json: { priority: value } },
      { onError: () => { setLocalPriority(prev); } }
    );
  }, [task.$id, localPriority, updateTask]);

  const handleAssigneesChange = useCallback((ids: string[]) => {
    const prev = localAssigneeIds;
    setLocalAssigneeIds(ids);
    updateTask(
      { param: { taskId: task.$id }, json: { assigneeIds: ids } },
      { onError: () => { setLocalAssigneeIds(prev); } }
    );
  }, [task.$id, localAssigneeIds, updateTask]);

  // Immediate date update — optimistic UI updates local state instantly.
  // Edge-case: if the new start date is after the existing end date, clear end date.
  // Edge-case: if the new end date is before the existing start date (shouldn't happen
  //            because we pass minDate to the picker, but guard anyway).
  const handleStartDateChange = useCallback((date: Date | undefined) => {
    // Optimistic: update local state immediately
    setLocalStartDate(date);

    const prevDueDate = localDueDate;
    if (date && prevDueDate && date > prevDueDate) {
      // Start pushed past end → clear end date so they are consistent
      setLocalDueDate(undefined);
      updateTask(
        { param: { taskId: task.$id }, json: { startDate: date, dueDate: undefined } },
        {
          onError: () => {
            // Revert on failure
            setLocalStartDate(task.startDate ? new Date(task.startDate) : undefined);
            setLocalDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
          },
        }
      );
    } else {
      updateTask(
        { param: { taskId: task.$id }, json: { startDate: date } },
        {
          onError: () => {
            setLocalStartDate(task.startDate ? new Date(task.startDate) : undefined);
          },
        }
      );
    }
  }, [task.$id, task.startDate, task.dueDate, localDueDate, updateTask]);

  const handleEndDateChange = useCallback((date: Date | undefined) => {
    const prevStartDate = localStartDate;
    // Guard: end date must not be before start date
    if (date && prevStartDate && date < prevStartDate) return;

    // Optimistic: update local state immediately
    setLocalDueDate(date);

    updateTask(
      { param: { taskId: task.$id }, json: { dueDate: date } },
      {
        onError: () => {
          setLocalDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
        },
      }
    );
  }, [task.$id, task.dueDate, localStartDate, updateTask]);

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (title !== task.title) {
      handleUpdate({ name: title });
    }
  };

  // Sync description on blur
  const handleDescriptionBlur = () => {
    syncDescriptionNow();
  };

  // Handle image upload for inline images in description
  const handleImageUpload = useCallback(async (file: File): Promise<string | null> => {
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

      const data = await response.json() as { data: { url: string } };
      return data.data.url;
    } catch {
      toast.error("Failed to upload image");
      return null;
    }
  }, [task.$id, workspaceId]);

  const handleCopyUrl = async () => {
    try {
      const url = typeof window !== "undefined"
        ? `${window.location.origin}/workspaces/${workspaceId}/tasks/${task.$id}`
        : `/workspaces/${workspaceId}/tasks/${task.$id}`;
      await navigator.clipboard.writeText(url);
      toast.success("Task URL copied to clipboard.");
    } catch {
      toast.error("Failed to copy task URL.");
    }
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(task.$id);
      toast.success("Task ID copied to clipboard.");
    } catch {
      toast.error("Failed to copy task ID.");
    }
  };

  // Get type label from custom types or defaults
  const getTypeLabel = (typeKey: string) => {
    const customType = project?.customWorkItemTypes?.find((t: { key: string }) => t.key === typeKey);
    if (customType) return customType.label;
    return typeLabels[typeKey] || typeKey;
  };

  // Get recent comments (last 3) -> now handled by CommentList


  return (
    <div className="flex w-full  flex-col h-full max-h-[90vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {/* Work Item Type Badge */}
          {task.type && (
            <Badge variant="outline" className="px-2 py-1 text-xs font-medium gap-1.5 flex items-center">
              <WorkItemIcon
                type={task.type}
                className="size-3.5"
                project={project}
              />
              <span>{getTypeLabel(task.type)}</span>
            </Badge>
          )}
          <StatusSelector
            value={task.status}
            onChange={canEdit ? (value) => handleUpdate({ status: value }) : () => { }}
            projectId={task.projectId}
            placeholder="Status"
            disabled={!canEdit}
          />
          <span className="text-xs text-muted-foreground font-mono">{task.key}</span>          {(isUpdating || isSavingDescription) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Saving...</span>
            </div>
          )}        </div>

        <div className="flex items-center gap-1">
          <IconHelp content="Copy task URL" side="bottom">
            <button
              className="hover:bg-accent p-1.5 rounded-md transition-colors"
              onClick={handleCopyUrl}
            >
              <Link size={16} strokeWidth={1.5} className="text-muted-foreground" />
            </button>
          </IconHelp>

          <IconHelp content="Copy task ID" side="bottom">
            <button
              className="hover:bg-accent p-1.5 rounded-md transition-colors"
              onClick={handleCopyId}
            >
              <Copy size={16} strokeWidth={1.5} className="text-muted-foreground" />
            </button>
          </IconHelp>

          <IconHelp content="Edit task" side="bottom">
            <button
              className="hover:bg-accent p-1.5 rounded-md transition-colors"
              onClick={onEdit}
            >
              <ExternalLink size={16} strokeWidth={1.5} className="text-muted-foreground" />
            </button>
          </IconHelp>

          {canDelete && onDelete && (
            <IconHelp content="Delete task" side="bottom">
              <button
                className="hover:bg-accent p-1.5 rounded-md transition-colors"
                onClick={onDelete}
              >
                <TrashIcon size={16} strokeWidth={1.5} className="text-red-500" />
              </button>
            </IconHelp>
          )}

          <button
            className="hover:bg-accent p-1.5 rounded-md transition-colors ml-1"
            onClick={handleCloseWithSync}
          >
            <X size={18} strokeWidth={1.5} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5">
            {/* Task Title */}
            <div className="mb-4">
              {isEditingTitle && canEdit ? (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleBlur();
                  }}
                  autoFocus
                  className="text-xl font-semibold h-auto py-2 px-2"
                />
              ) : (
                <h1
                  className={`text-xl font-semibold text-foreground border border-transparent rounded p-2 -ml-2 transition-colors ${canEdit ? 'hover:border-border cursor-text' : ''}`}
                  onClick={() => canEdit && setIsEditingTitle(true)}
                >
                  {task.title}
                </h1>
              )}
            </div>

            {/* Description */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Description
                </h3>
                {isSavingDescription && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Saving...</span>
                  </div>
                )}
              </div>
              <div className="min-h-[100px]">
                <RichTextEditor
                  content={description}
                  onChange={canEdit ? setDescription : () => { }}
                  onBlur={canEdit ? handleDescriptionBlur : () => { }}
                  placeholder={canEdit ? "Add a description... Use @ to mention team members, / for commands" : "No description"}
                  editable={canEdit}
                  workspaceId={workspaceId}
                  projectId={task.projectId}
                  minHeight="100px"
                  showToolbar={canEdit}
                  onImageUpload={canEdit ? handleImageUpload : undefined}
                />
              </div>
            </div>

            {/* Comments Section */}
            <div className="border-t pt-5">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
                Activity & Comments
              </h3>

              <div className="mb-4">
                <CommentInput
                  taskId={task.$id}
                  workspaceId={workspaceId}
                  placeholder="Write a comment..."
                />
              </div>

              <CommentList
                taskId={task.$id}
                workspaceId={workspaceId}
                currentUserId={user?.$id || ""}
              />
            </div>
          </div>
        </div>

        {/* Right Panel - Properties */}
        <div className="w-[320px] border-l border-border bg-background overflow-y-auto">
          <div className="p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
              Properties
            </h3>

            <div className="space-y-4">
              {/* Status */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
                <StatusSelector
                  value={localStatus}
                  onChange={canEdit ? handleStatusChange : () => { }}
                  projectId={task.projectId}
                  disabled={!canEdit}
                />
              </div>

              {/* Work Item Type */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Type</label>
                <TypeSelector
                  value={localType}
                  onValueChange={canEdit ? handleTypeChange : () => { }}
                  project={project}
                  customTypes={project?.customWorkItemTypes}
                  className="w-full bg-card border-border"
                  disabled={!canEdit}
                />
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Priority</label>
                <PrioritySelector
                  value={localPriority}
                  onValueChange={canEdit ? handlePriorityChange : () => { }}
                  customPriorities={project?.customPriorities}
                  disabled={!canEdit}
                />
              </div>

              {/* Assignee */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Assignees</label>
                <AssigneeMultiSelect
                  memberOptions={memberOptions}
                  selectedAssigneeIds={localAssigneeIds}
                  onAssigneesChange={canEdit ? handleAssigneesChange : () => { }}
                  placeholder="Select assignees"
                  disabled={!canEdit}
                />
              </div>

              {/* Dates - side by side */}
              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0">
                  <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Start Date</label>
                  <DatePicker
                    value={localStartDate}
                    onChange={canEdit ? handleStartDateChange : () => {}}
                    placeholder="Set start date"
                    className="w-full bg-card border-border h-8 text-xs overflow-hidden"
                    disabled={!canEdit}
                    minDate={new Date()}
                    maxDate={localDueDate}
                  />
                </div>
                <div className="min-w-0">
                  <label className="text-[10px] text-muted-foreground mb-1 block font-medium">End Date</label>
                  <DatePicker
                    value={localDueDate}
                    onChange={canEdit ? handleEndDateChange : () => {}}
                    placeholder="Set end date"
                    className="w-full bg-card border-border h-8 text-xs overflow-hidden"
                    disabled={!canEdit}
                    minDate={localStartDate ?? new Date()}
                  />
                </div>
              </div>

              {/* Labels */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Labels</label>
                <LabelSelector
                  selectedLabels={task.labels || []}
                  onLabelsChange={canEdit ? (labels) => handleUpdate({ labels }) : () => {}}
                  availableLabels={[
                    ...(project?.customLabels?.map((l: { name: string }) => l.name) || []),
                    "Bug", "Feature", "Improvement", "Documentation", "Design", "Research",
                    "Frontend", "Backend",
                  ].filter((v, i, a) => a.indexOf(v) === i)}
                  placeholder="Add label..."
                  className="h-8 text-xs w-full"
                  disabled={!canEdit}
                />
              </div>

              {/* Time Estimate */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Time Estimate (hours)</label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="None"
                  defaultValue={task.estimatedHours}
                  onBlur={canEdit ? (e) => {
                    const val = e.target.value ? parseFloat(e.target.value) : null;
                    if (val !== task.estimatedHours) {
                      handleUpdate({ estimatedHours: val || undefined });
                    }
                  } : () => { }}
                  className="h-9 bg-card border-border"
                  disabled={!canEdit}
                />
              </div>

              {/* Story Points */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Story Points</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="None"
                  defaultValue={task.storyPoints}
                  onBlur={canEdit ? (e) => {
                    const val = e.target.value ? parseInt(e.target.value) : null;
                    if (val !== task.storyPoints) {
                      handleUpdate({ storyPoints: val || undefined });
                    }
                  } : () => { }}
                  className="h-9 bg-card border-border"
                  disabled={!canEdit}
                />
              </div>

              {/* Flagged */}
              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  checked={task.flagged}
                  onCheckedChange={canEdit ? (checked) => handleUpdate({ flagged: checked as boolean }) : () => { }}
                  id="flagged"
                  disabled={!canEdit}
                />
                <label htmlFor="flagged" className="text-sm font-medium text-muted-foreground cursor-pointer">Flagged</label>
              </div>
            </div>
          </div>
          {/* Attachments */}
          <div className="pt-2 border-t px-4">
            <TaskAttachments taskId={task.$id} workspaceId={workspaceId} onPreview={onAttachmentPreview} />
          </div>

          {/* Edit Button */}
          <div className="px-4 py-4 bg-muted/50 border-t border-border sticky bottom-0">
            <Button
              onClick={onEdit}
              className="w-full"
              size="sm"
            >
              <ExternalLink size={14} className="mr-2" />
              Open Full View
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TaskPreviewModalWrapper = () => {
  const router = useRouter();
  const { taskId, close } = useTaskPreviewModal();
  const workspaceId = useWorkspaceId();
  const { data, isLoading } = useGetTask({ taskId: taskId || "" });
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const isOpen = !!taskId;

  // Get workspace admin status
  const { isAdmin } = useCurrentMember({ workspaceId });

  // Get project-level task permissions
  const {
    canEditTasksProject,
    canDeleteTasksProject,
  } = useProjectPermissions({
    projectId: data?.projectId || null,
    workspaceId
  });

  // Effective permissions: Admin OR has project-level permission
  const canEditTasks = isAdmin || canEditTasksProject;
  const canDeleteTasks = isAdmin || canDeleteTasksProject;

  // Delete handling using existing hook + confirm dialog
  const { mutate } = useDeleteTask();
  const [ConfirmDialog, confirm] = useConfirm(
    "Delete task?",
    "This action cannot be undone.",
    "destructive"
  );

  const handleDeleteTask = async () => {
    if (!data?.$id) return;
    const ok = await confirm();
    if (!ok) return;

    mutate(
      { param: { taskId: data.$id } },
      {
        onSuccess: () => {
          close();
          router.push(`/workspaces/${workspaceId}/tasks`);
        },
      }
    );
  };

  const handleEdit = () => {
    if (!workspaceId || !data?.$id) return;   // <-- Ensures ID exists

    const target = `/workspaces/${workspaceId}/tasks/${data.$id}`;


    try {
      router.push(target);
    } catch {
      // Navigation error handled silently
    }
  };


  const handleClose = useCallback(() => {
    close();
  }, [close]);

  const handleAttachmentPreview = (attachment: Attachment) => {
    setPreviewAttachment(attachment);
  };

  const closeAttachmentPreview = () => setPreviewAttachment(null);

  // Reset attachment preview when the task changes
  useEffect(() => {
    setPreviewAttachment(null);
  }, [taskId]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60  z-50 animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex  items-center justify-center p-4 pointer-events-none">
        <div
          className="relative bg-card border border-border rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden pointer-events-auto animate-in zoom-in-95 fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {isLoading ? (
            <div className="flex flex-col h-[500px]">
              {/* Header skeleton */}
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </div>
              {/* Content skeleton */}
              <div className="flex flex-1">
                <div className="flex-1 p-5">
                  <Skeleton className="h-7 w-3/4 mb-4" />
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-20 w-full" />
                </div>
                <div className="w-[260px] border-l bg-background p-4">
                  <Skeleton className="h-4 w-20 mb-4" />
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
              </div>
            </div>
          ) : !data ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-muted-foreground">Task not found</p>
            </div>
          ) : (
            <>
              <ConfirmDialog />

              <TaskPreviewContent
                task={data}
                workspaceId={workspaceId}
                onEdit={handleEdit}
                onClose={handleClose}
                onAttachmentPreview={handleAttachmentPreview}
                onDelete={handleDeleteTask}
                canEdit={canEditTasks}
                canDelete={canDeleteTasks}
              />

              {/* Attachment preview overlay */}
              {previewAttachment && (
                <div className="absolute inset-0 z-60 flex flex-col bg-background rounded-lg">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-sm font-medium truncate">{previewAttachment.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{previewAttachment.mimeType}</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto p-4 flex items-center justify-center relative">
                    <IconHelp content="Close Attachment Preview" side="left">
                      <button
                        onClick={closeAttachmentPreview}
                        className="absolute top-6 right-4 z-10 p-1 rounded-md bg-background hover:bg-accent border border-border shadow-md transition-colors"
                        title="Close attachment preview"
                      >
                        <X className="size-4" />
                      </button>
                    </IconHelp>
                    {previewAttachment.mimeType.startsWith("image/") ? (
                      // Image preview
                      // Use the preview endpoint
                      // eslint-disable-next-line @next/next/no-img-element -- Dynamic preview URL not compatible with Next.js Image
                      <img
                        src={`/api/attachments/${previewAttachment.$id}/preview?workspaceId=${workspaceId}`}
                        alt={previewAttachment.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      // Fallback to iframe for PDFs and other previewable types
                      <iframe
                        src={`/api/attachments/${previewAttachment.$id}/preview?workspaceId=${workspaceId}`}
                        title={previewAttachment.name}
                        className="w-full h-full border-0"
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};
