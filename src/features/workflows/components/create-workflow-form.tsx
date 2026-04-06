"use client";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { GitBranch } from "lucide-react";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { cn } from "@/lib/utils";
import { DottedSeparator } from "@/components/dotted-separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";


import { createWorkflowSchema } from "../schemas";
import { useCreateWorkflow } from "../api/use-create-workflow";


interface CreateWorkflowFormProps {
  onCancel?: () => void;
  workspaceId?: string;
  spaceId?: string;
  projectId?: string;
}

export const CreateWorkflowForm = ({ onCancel, workspaceId: propWorkspaceId, spaceId, projectId }: CreateWorkflowFormProps) => {
  const hookWorkspaceId = useWorkspaceId();
  const workspaceId = propWorkspaceId || hookWorkspaceId;
  const { mutate, isPending } = useCreateWorkflow();

  const form = useForm<z.infer<typeof createWorkflowSchema>>({
    resolver: zodResolver(createWorkflowSchema.omit({ workspaceId: true })),
    defaultValues: {
      name: "",
      key: "",
      description: "",
      isDefault: false,
    },
  });

  const onSubmit = (values: z.infer<typeof createWorkflowSchema>) => {
    mutate(
      {
        json: {
          ...values,
          workspaceId,
          spaceId: spaceId || undefined,
          projectId: projectId || undefined,
        }
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
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <GitBranch className="size-5" />
          Create Workflow
        </CardTitle>
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
                    <FormLabel>Workflow Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Software Development, Bug Tracking"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          // Auto-generate key from name
                          if (!form.getValues("key")) {
                            const generatedKey = e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]/g, "_")
                              .replace(/_{2,}/g, "_")
                              .substring(0, 50);
                            form.setValue("key", generatedKey);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workflow Key</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., SOFTWARE_DEV, BUG_TRACKING"
                        {...field}
                        className="font-mono"
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Unique identifier (auto-generated from name). Letters, numbers, and underscores only.
                    </FormDescription>
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
                        placeholder="Describe this workflow"
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Set as default workflow</FormLabel>
                      <FormDescription>
                        New projects will use this workflow by default
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
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
                Create Workflow
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
