"use client";

import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { ProjectAvatar } from "@/features/projects/components/project-avatar";

import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/date-picker";
import { DottedSeparator } from "@/components/dotted-separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { updateTaskSchema } from "../schemas";
import { useUpdateTask } from "../api/use-update-task";
import { Task } from "../types";
import { StatusSelector } from "@/features/custom-columns/components/status-selector";
import { PrioritySelector } from "./priority-selector";
import { LabelSelector } from "./label-management";
import { Textarea } from "@/components/ui/textarea";
import { AssigneeMultiSelect } from "./assignee-multi-select";
import { CreateTaskAttachmentUpload } from "@/features/attachments/components/create-task-attachment-upload";

interface EditTaskFormProps {
  onCancel?: () => void;
  projectOptions: { id: string; name: string; imageUrl: string }[];
  memberOptions: { id: string; name: string; imageUrl?: string | null }[];
  initialValues: Task;
}

export const EditTaskForm = ({
  onCancel,
  projectOptions,
  memberOptions,
  initialValues,
}: EditTaskFormProps) => {
  const { mutate, isPending } = useUpdateTask();
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  // Mock available labels - in a real app, this would come from an API
  const availableLabels = [
    "frontend", "backend", "bug", "feature", "urgent", "documentation",
    "testing", "design", "security", "performance", "api", "ui/ux"
  ];

  const form = useForm<z.infer<typeof updateTaskSchema>>({
    resolver: zodResolver(updateTaskSchema),
    defaultValues: {
      ...initialValues,
      dueDate: initialValues.dueDate
        ? new Date(initialValues.dueDate)
        : undefined,
      endDate: initialValues.endDate
        ? new Date(initialValues.endDate)
        : undefined,
      assigneeIds: initialValues.assigneeIds || (initialValues.assigneeId ? [initialValues.assigneeId] : []),
      assignedTeamId: initialValues.assignedTeamId ?? undefined,
      flagged: initialValues.flagged ?? false,
    },
  });

  const onSubmit = (values: z.infer<typeof updateTaskSchema>) => {
    mutate(
      {
        json: values,
        param: { taskId: initialValues.$id },
      },
      {
        onSuccess: () => {
          form.reset();
          onCancel?.();
        },
      }
    );
  };

  return (
    <Card className="w-full h-full border-none shadow-none">
      <CardHeader className="flex p-7">
        <CardTitle className="text-xl font-bold">Edit the task</CardTitle>
      </CardHeader>
      <div className="px-7">
        <DottedSeparator />
      </div>
      <CardContent className="p-7">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter task name" {...field} />
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
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <DatePicker {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date (Optional)</FormLabel>
                    <FormControl>
                      <DatePicker {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assigneeIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignees</FormLabel>
                    <FormControl>
                      <AssigneeMultiSelect
                        memberOptions={memberOptions}
                        selectedAssigneeIds={field.value || []}
                        onAssigneesChange={field.onChange}
                        placeholder="Select assignees..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <StatusSelector
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select status"
                        projectId={initialValues.projectId}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                      </FormControl>
                      <FormMessage />
                      <SelectContent>
                        {projectOptions.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            <div className="flex items-center gap-x-2">
                              <ProjectAvatar
                                className="size-6"
                                name={project.name}
                                image={project.imageUrl}
                              />
                              {project.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimatedHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Hours (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="Enter estimated hours..."
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(value === "" ? undefined : parseFloat(value) || undefined);
                        }}
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
                    <FormLabel>Priority (Optional)</FormLabel>
                    <FormControl>
                      <PrioritySelector
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Select priority"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="labels"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Labels (Optional)</FormLabel>
                    <FormControl>
                      <LabelSelector
                        selectedLabels={field.value ?? []}
                        onLabelsChange={field.onChange}
                        availableLabels={availableLabels}
                        placeholder="Add labels..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter task description..."
                        className="resize-none"
                        rows={4}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="flagged"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Flag this task
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Mark this task as flagged for quick identification
                      </p>
                    </div>
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <Label>Attachments (Optional)</Label>
                <CreateTaskAttachmentUpload
                  files={attachmentFiles}
                  onFilesChange={setAttachmentFiles}
                />
              </div>
            </div>
            <DottedSeparator className="py-7" />
            <div className="flex items-center justify-between">
              <Button
                type="button"
                size="lg"
                variant="secondary"
                onClick={onCancel}
                disabled={isPending}
                className={cn(!onCancel && "invisible")}
              >
                Cancel
              </Button>
              <Button type="submit" size="lg" disabled={isPending}>
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
