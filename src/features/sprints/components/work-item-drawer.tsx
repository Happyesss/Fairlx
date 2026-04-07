"use client";

import { useState } from "react";
import {
  MoreHorizontal,
  Calendar,
  Tag as TagIcon,
  User,
  Link2,
  MessageSquare,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  Layers,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { PopulatedWorkItem, WorkItemStatus, WorkItemType } from "../types";
import { SubtasksList } from "@/features/subtasks/components";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import DOMPurify from "dompurify";
import { RichTextEditor } from "@/components/editor/rich-text-editor";

interface WorkItemDrawerProps {
  workItem: PopulatedWorkItem | null;
  open: boolean;
  onCloseAction: () => void;
  onUpdate?: (workItemId: string, updates: Partial<PopulatedWorkItem>) => void;
  onDelete?: (workItemId: string) => void;
  // Permission props
  canEdit?: boolean;
  canDelete?: boolean;
}

export const WorkItemDrawer = ({
  workItem,
  open,
  onCloseAction,
  onUpdate,
  onDelete,
  canEdit = true,
  canDelete = true,
}: WorkItemDrawerProps) => {
  const [title, setTitle] = useState(workItem?.title || "");
  const [description, setDescription] = useState(workItem?.description || "");
  const [status, setStatus] = useState(workItem?.status || WorkItemStatus.TODO);
  const [type, setType] = useState(workItem?.type || WorkItemType.TASK);
  const [storyPoints, setStoryPoints] = useState(workItem?.storyPoints?.toString() || "");
  const [comments, setComments] = useState<Array<{ id: string; author: string; text: string; date: string }>>([]);
  const [newComment, setNewComment] = useState("");
  const [isDescriptionDialogOpen, setIsDescriptionDialogOpen] = useState(false);
  const [editingDescription, setEditingDescription] = useState("");

  if (!workItem) return null;

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(workItem.$id, {
        title,
        description,
        status,
        type,
        storyPoints: storyPoints ? parseInt(storyPoints) : undefined,
      });
    }
    onCloseAction();
  };

  const handleDelete = () => {
    if (onDelete && confirm("Are you sure you want to delete this work item?")) {
      onDelete(workItem.$id);
      onCloseAction();
    }
  };

  const handleAddComment = () => {
    if (newComment.trim()) {
      setComments([
        ...comments,
        {
          id: `comment-${Date.now()}`,
          author: "Current User",
          text: newComment,
          date: new Date().toISOString(),
        },
      ]);
      setNewComment("");
    }
  };

  return (
  <>
    <Sheet open={open} onOpenChange={onCloseAction}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {/* Header */}
        <SheetHeader className="space-y-4">
          <SheetTitle className="sr-only">
            {workItem.key} - {workItem.title}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Edit work item details, description, subtasks, links, and comments
          </SheetDescription>
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs font-mono">
                  {workItem.key}
                </Badge>
                {/* Type Selector */}
                <Select value={type} onValueChange={(value) => setType(value as WorkItemType)} disabled={canEdit === false}>
                  <SelectTrigger className="w-28 h-7 text-xs" disabled={canEdit === false}>
                    <Layers className="size-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WorkItemType.TASK}>Task</SelectItem>
                    <SelectItem value={WorkItemType.BUG}>Bug</SelectItem>
                    <SelectItem value={WorkItemType.STORY}>Story</SelectItem>
                    <SelectItem value={WorkItemType.EPIC}>Epic</SelectItem>
                    <SelectItem value={WorkItemType.SUBTASK}>Subtask</SelectItem>
                  </SelectContent>
                </Select>
                {/* Status Selector */}
                <Select value={status} onValueChange={(value) => setStatus(value as WorkItemStatus)} disabled={canEdit === false}>
                  <SelectTrigger className="w-32 h-7 text-xs" disabled={canEdit === false}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WorkItemStatus.TODO}>TO DO</SelectItem>
                    <SelectItem value={WorkItemStatus.IN_PROGRESS}>IN PROGRESS</SelectItem>
                    <SelectItem value={WorkItemStatus.IN_REVIEW}>IN REVIEW</SelectItem>
                    <SelectItem value={WorkItemStatus.DONE}>DONE</SelectItem>
                    <SelectItem value={WorkItemStatus.ASSIGNED}>ASSIGNED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-lg font-semibold border-none px-0 focus-visible:ring-0"
                placeholder="Work item title"
                disabled={canEdit === false}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Copy className="size-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ExternalLink className="size-4 mr-2" />
                  Open in new tab
                </DropdownMenuItem>
                {canDelete !== false && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600" onClick={handleDelete}>
                      <Trash2 className="size-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SheetHeader>

        <Separator className="my-4" />

        {/* Tabs */}
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="comments">
              Comments
              {comments.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {comments.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-6 mt-6">
            {/* Assignee */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <User className="size-4" />
                Assignee
              </Label>
              <div className="flex items-center gap-2">
                {/* Filter null assignees to handle deleted users or permission-masked relations */}
                {(() => {
                  const validAssignees = workItem.assignees?.filter(
                    (a): a is NonNullable<typeof a> => a != null && typeof a.$id === "string"
                  ) ?? [];
                  return validAssignees.length > 0 ? (
                    validAssignees.map((assignee) => (
                      <div key={assignee.$id} className="flex items-center gap-2">
                        <Avatar className="size-8">
                          <AvatarImage src={assignee.profileImageUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {(assignee.name ?? "?").substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{assignee.name}</span>
                      </div>
                    ))
                  ) : (
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                      <Plus className="size-3 mr-1" />
                      Assign
                    </Button>
                  );
                })()}
              </div>
            </div>

            {/* Labels */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <TagIcon className="size-4" />
                Labels
              </Label>
              <div className="flex flex-wrap gap-2">
                {workItem.labels && workItem.labels.length > 0 ? (
                  workItem.labels.map((label, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {label}
                    </Badge>
                  ))
                ) : (
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <Plus className="size-3 mr-1" />
                    Add label
                  </Button>
                )}
              </div>
            </div>

            {/* Epic */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Parent Epic</Label>
              {workItem.epic ? (
                <Badge variant="outline" className="text-xs">
                  {workItem.epic.key}: {workItem.epic.title}
                </Badge>
              ) : (
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <Plus className="size-3 mr-1" />
                  Add to epic
                </Button>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="size-4" />
                  Start Date
                </Label>
                <Input type="date" className="h-9 text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="size-4" />
                  Due Date
                </Label>
                <Input type="date" className="h-9 text-sm" />
              </div>
            </div>

            {/* Story Points */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Story Points</Label>
              <Input
                type="number"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                className="h-9 text-sm w-24"
                placeholder="0"
                min="0"
                disabled={canEdit === false}
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Priority</Label>
              <Select defaultValue={workItem.priority} disabled={canEdit === false}>
                <SelectTrigger className="h-9 text-sm" disabled={canEdit === false}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Description Tab */}
          <TabsContent value="description" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Description</Label>
              {canEdit !== false && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingDescription(description || workItem.description || "");
                    setIsDescriptionDialogOpen(true);
                  }}
                >
                  Edit
                </Button>
              )}
            </div>
            <div
              className="prose prose-sm max-w-none dark:prose-invert min-h-[200px] p-4 border rounded-md bg-muted/30"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(description || workItem.description || "<p class='text-muted-foreground'>No description added yet</p>")
              }}
            />
          </TabsContent>

          {/* Subtasks Tab */}
          <TabsContent value="subtasks" className="space-y-4 mt-6">
            <SubtasksList
              parentTaskId={workItem.$id}
              workspaceId={workItem.workspaceId}
            />
          </TabsContent>

          {/* Links Tab */}
          <TabsContent value="links" className="space-y-4 mt-6">
            <div className="text-center py-12 text-muted-foreground">
              <Link2 className="size-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm">No linked work items</p>
              <Button variant="outline" size="sm" className="mt-4">
                <Plus className="size-4 mr-2" />
                Add link
              </Button>
            </div>
          </TabsContent>

          {/* Comments Tab */}
          <TabsContent value="comments" className="space-y-4 mt-6">
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-6">
                      <AvatarFallback className="text-xs">
                        {comment.author.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{comment.author}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(comment.date).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm pl-8">{comment.text}</p>
                </div>
              ))}
            </div>

            {comments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="size-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">No comments yet</p>
              </div>
            )}

            <div className="space-y-2 pt-4 border-t">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="min-h-[100px] text-sm"
              />
              <Button onClick={handleAddComment} size="sm">
                <MessageSquare className="size-4 mr-2" />
                Add comment
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-6 border-t mt-6">
          <Button variant="outline" onClick={onCloseAction}>
            {canEdit === false ? "Close" : "Cancel"}
          </Button>
          {canEdit !== false && <Button onClick={handleSave}>Save changes</Button>}
        </div>
      </SheetContent>
    </Sheet>

    {/* Description Edit Dialog */}
    <Dialog open={isDescriptionDialogOpen} onOpenChange={setIsDescriptionDialogOpen}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Description</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          <RichTextEditor
            content={editingDescription}
            onChange={(content) => setEditingDescription(content)}
            workspaceId={workItem?.workspaceId}
            placeholder="Add a description..."
            minHeight="250px"
          />
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setIsDescriptionDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setDescription(editingDescription);
              setIsDescriptionDialogOpen(false);
            }}
          >
            Save Description
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
};
