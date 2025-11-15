"use client";

import { Plus, Layers } from "lucide-react";
import { useState, useEffect } from "react";
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

import { useCreateWorkItem } from "../api/use-create-work-item";
import { useGetEpics } from "../api/use-get-epics";
import { WorkItemType, WorkItemStatus, WorkItemPriority } from "../types";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.nativeEnum(WorkItemType),
  priority: z.nativeEnum(WorkItemPriority),
  epicId: z.string().optional(),
});

interface CreateWorkItemBarProps {
  workspaceId: string;
  projectId: string;
  sprintId?: string | null;
  onSuccess?: () => void;
  onCreateEpic?: () => void;
}

export const CreateWorkItemBar = ({
  workspaceId,
  projectId,
  sprintId,
  onSuccess,
  onCreateEpic,
}: CreateWorkItemBarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { mutate: createWorkItem, isPending } = useCreateWorkItem();
  const { data: epics } = useGetEpics({ workspaceId, projectId });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      type: WorkItemType.STORY,
      priority: WorkItemPriority.MEDIUM,
      epicId: undefined,
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createWorkItem(
      {
        ...values,
        workspaceId,
        projectId,
        sprintId,
        status: WorkItemStatus.TODO,
        assigneeIds: [],
        flagged: false,
      },
      {
        onSuccess: () => {
          form.reset();
          setIsOpen(false);
          onSuccess?.();
        },
      }
    );
  };

  return (
    <>
      <Button
        size="sm"
        onClick={() => setIsOpen(true)}
        className="px-3 py-1 bg-white text-white border border-gray-300 text-xs font-medium h-6"
      >
        <Plus className="size-3 mr-1" />
        Add work item
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Work Item</DialogTitle>
            <DialogDescription>
              Add a new work item to your {sprintId ? "sprint" : "backlog"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Title Field */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="What needs to be done?"
                        disabled={isPending}
                        autoFocus
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Type, Priority, Epic in a grid */}
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={WorkItemType.STORY}>Story</SelectItem>
                          <SelectItem value={WorkItemType.BUG}>Bug</SelectItem>
                          <SelectItem value={WorkItemType.TASK}>Task</SelectItem>
                          <SelectItem value={WorkItemType.EPIC}>Epic</SelectItem>
                          <SelectItem value={WorkItemType.SUBTASK}>Subtask</SelectItem>
                        </SelectContent>
                      </Select>
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
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={WorkItemPriority.LOW}>Low</SelectItem>
                          <SelectItem value={WorkItemPriority.MEDIUM}>Medium</SelectItem>
                          <SelectItem value={WorkItemPriority.HIGH}>High</SelectItem>
                          <SelectItem value={WorkItemPriority.URGENT}>Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="epicId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Epic (Optional)</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          if (value === "__create_new__") {
                            onCreateEpic?.();
                          } else {
                            field.onChange(value === "none" ? undefined : value);
                          }
                        }}
                        value={field.value || "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
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
                          {onCreateEpic && (
                            <SelectItem value="__create_new__">
                              <div className="flex items-center gap-1.5 text-primary font-medium">
                                <Plus className="size-3.5" />
                                <span>Create New Epic</span>
                              </div>
                            </SelectItem>
                          )}
                          {epics?.documents.map((epic) => (
                            <SelectItem key={epic.$id} value={epic.$id}>
                              <div className="flex items-center gap-1.5">
                                <Layers className="size-3.5 text-purple-500" />
                                <span>{epic.title}</span>
                                <span className="text-xs text-muted-foreground">({epic.key})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
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
    </>
  );
};
