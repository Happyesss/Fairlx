"use client";

import { Layers, Clock, Trophy, Flag, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { RichTextEditor } from "@/components/editor";
import { DatePicker } from "@/components/date-picker";
import { AssigneeMultiSelect } from "@/features/tasks/components/assignee-multi-select";
import { LabelSelector } from "@/features/tasks/components/label-management";
import { TypeSelector } from "@/features/tasks/components/type-selector";
import { PrioritySelector } from "@/features/tasks/components/priority-selector";
import { CreateTaskAttachmentUpload } from "@/features/attachments/components/create-task-attachment-upload";
import { useUploadAttachment } from "@/features/attachments/hooks/use-upload-attachment";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useGetProject } from "@/features/projects/api/use-get-project";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useCreateWorkItem } from "../api/use-create-work-item";
import { useGetEpics } from "../api/use-get-epics";
import { useCreateWorkItemModal } from "../hooks/use-create-work-item-modal";
import { WorkItemType, WorkItemStatus, WorkItemPriority, WorkItem } from "../types";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.nativeEnum(WorkItemType),
  status: z.union([z.nativeEnum(WorkItemStatus), z.string()]),
  priority: z.nativeEnum(WorkItemPriority),
  projectId: z.string().min(1, "Project is required"),
  sprintId: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
  epicId: z.string().optional(),
  description: z.string().optional(),
  startDate: z.date().optional(),
  dueDate: z.date().optional(),
  storyPoints: z.number().min(0).optional(),
  estimatedHours: z.number().min(0).optional(),
  labels: z.array(z.string()).optional(),
  flagged: z.boolean().optional().default(false),
});

export const CreateWorkItemModal = () => {
  const workspaceId = useWorkspaceId();
  const { 
    isOpen, 
    close, 
    projectId: preselectedProjectId,
    sprintId: preselectedSprintId,
    initialStatus: preselectedStatus
  } = useCreateWorkItemModal();
  const { mutate: createWorkItem, isPending } = useCreateWorkItem();
  const { mutate: uploadAttachment } = useUploadAttachment();
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  
  const { data: projects } = useGetProjects({ workspaceId });
  const { data: members } = useGetMembers({ workspaceId });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      type: WorkItemType.TASK,
      priority: WorkItemPriority.MEDIUM,
      projectId: "",
      assigneeIds: [],
      epicId: undefined,
      description: "",
      dueDate: undefined,
    },
  });

  const selectedProjectId = form.watch("projectId");
  const { data: epics } = useGetEpics({ 
    workspaceId, 
    projectId: selectedProjectId || undefined 
  });

  // Reset form when dialog opens/closes, and set preselected project
  useEffect(() => {
    if (isOpen) {
      form.reset({
        title: "",
        type: WorkItemType.TASK,
        status: (preselectedStatus as WorkItemStatus) || WorkItemStatus.TODO,
        priority: WorkItemPriority.MEDIUM,
        projectId: preselectedProjectId || "",
        sprintId: preselectedSprintId || undefined,
        assigneeIds: [],
        epicId: undefined,
        description: "",
        startDate: undefined,
        dueDate: undefined,
        storyPoints: undefined,
        estimatedHours: undefined,
        labels: [],
        flagged: false,
      });
      setAttachmentFiles([]);
    }
  }, [isOpen, preselectedProjectId, preselectedSprintId, preselectedStatus, form]);

  const { data: project } = useGetProject({ projectId: selectedProjectId });
  
  const availableLabels = useMemo(() => {
    const defaultLabels = [
      "frontend", "backend", "bug", "feature", "urgent", "documentation",
      "testing", "design", "security", "performance", "api", "ui/ux"
    ];
    const customLabels = project?.customLabels || [];
    const customLabelNames = customLabels.map((l: { name: string }) => l.name);
    return Array.from(new Set([...defaultLabels, ...customLabelNames]));
  }, [project]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createWorkItem(
      {
        title: values.title,
        type: values.type,
        priority: values.priority,
        workspaceId,
        projectId: values.projectId,
        sprintId: values.sprintId,
        status: values.status,
        assigneeIds: values.assigneeIds || [],
        epicId: values.epicId,
        description: values.description,
        startDate: values.startDate as unknown as Date,
        dueDate: values.dueDate as unknown as Date,
        flagged: values.flagged || false,
        storyPoints: values.storyPoints,
        estimatedHours: values.estimatedHours,
        labels: values.labels,
      },
      {
        onSuccess: (data) => {
          // Upload attachments if any
          if (attachmentFiles.length > 0 && data?.data) {
            const taskId = (data.data as WorkItem).$id;
            attachmentFiles.forEach((file) => {
              const formData = new FormData();
              formData.append("file", file);
              formData.append("taskId", taskId);
              formData.append("workspaceId", workspaceId);

              uploadAttachment({ form: formData });
            });
          }

          form.reset();
          setAttachmentFiles([]);
          close();
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Work Item</DialogTitle>
          <DialogDescription>
            Add a new work item to your project backlog
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Project Selection - Hidden if preselected */}
            {!preselectedProjectId && (
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projects?.documents.map((project) => (
                          <SelectItem key={project.$id} value={project.$id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Title Field */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="What needs to be done?"
                      disabled={isPending}
                      autoFocus
                      className="h-11 shadow-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Type and Priority in a grid */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <TypeSelector
                        value={field.value}
                        onValueChange={field.onChange}
                        project={project ?? undefined}
                        customTypes={project?.customWorkItemTypes}
                        className="h-11 shadow-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <FormControl>
                      <PrioritySelector
                        value={field.value}
                        onValueChange={field.onChange}
                        customPriorities={project?.customPriorities}
                        className="h-11 shadow-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Epic, Start Date, and Due Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="epicId"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Epic (Optional)</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                      value={field.value || "none"}
                      disabled={!selectedProjectId}
                    >
                      <FormControl>
                        <SelectTrigger className="h-11 shadow-sm">
                          <SelectValue placeholder="Select Epic">
                            {field.value ? (
                              <div className="flex items-center gap-1.5">
                                <Layers className="size-3.5 text-purple-500" />
                                <span>{epics?.documents.find(e => e.$id === field.value)?.title || "Select Epic"}</span>
                              </div>
                            ) : (
                              "No Epic"
                            )}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">No Epic</span>
                        </SelectItem>
                        {epics?.documents.map((epic) => (
                          <SelectItem key={epic.$id} value={epic.$id}>
                            <div className="flex items-center gap-1.5">
                              <Layers className="size-3.5 text-purple-500" />
                              <span>{epic.title}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date (Optional)</FormLabel>
                    <FormControl>
                      <DatePicker {...field} className="h-11 shadow-sm w-full" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date (Optional)</FormLabel>
                    <FormControl>
                      <DatePicker {...field} className="h-11 shadow-sm w-full" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Assignee */}
            <FormField
              control={form.control}
              name="assigneeIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assignees (Optional)</FormLabel>
                  <FormControl>
                    <AssigneeMultiSelect
                      memberOptions={members?.documents.map(m => ({ id: m.$id, name: m.name, imageUrl: m.profileImageUrl })) || []}
                      selectedAssigneeIds={field.value || []}
                      onAssigneesChange={field.onChange}
                      placeholder="Select assignees..."
                      className="min-h-[44px] shadow-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Labels, Story Points and Estimated Hours */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="labels"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Labels (Optional)</FormLabel>
                    <FormControl>
                      <LabelSelector
                        selectedLabels={field.value || []}
                        onLabelsChange={field.onChange}
                        availableLabels={availableLabels}
                        placeholder="Add labels..."
                        className="h-11 shadow-sm w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="storyPoints"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Trophy className="size-3.5 text-amber-500" />
                        Points
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                          className="h-11 shadow-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="estimatedHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-blue-500" />
                        Hours
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                          className="h-11 shadow-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Flagged */}
            <FormField
              control={form.control}
              name="flagged"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 bg-muted/20">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="flex items-center gap-2">
                      <Flag className={cn("size-4", field.value && "fill-red-500 text-red-500")} />
                      Flag this work item
                    </FormLabel>
                    <p className="text-[10px] text-muted-foreground">
                      Mark as flagged for quick identification or urgency
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      content={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="Add more details about this work item... Use @ to mention team members"
                      workspaceId={workspaceId}
                      projectId={selectedProjectId}
                      minHeight="120px"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Attachments Section */}
            <div className="space-y-2">
              <FormLabel className="flex items-center gap-2">
                <Upload className="size-4" />
                Attachments (Optional)
              </FormLabel>
              <CreateTaskAttachmentUpload
                files={attachmentFiles}
                onFilesChange={setAttachmentFiles}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={close}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create Work Item"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
