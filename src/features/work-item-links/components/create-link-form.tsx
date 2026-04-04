"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateWorkItemLink } from "../api/use-create-work-item-link";
import { createWorkItemLinkSchema } from "../schemas";
import { WorkItemLinkType, LINK_TYPE_METADATA } from "../types";

interface CreateLinkFormProps {
  workspaceId: string;
  sourceItemId?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
}

const formSchema = createWorkItemLinkSchema;
type FormValues = z.infer<typeof formSchema>;

export const CreateLinkForm = ({
  workspaceId,
  sourceItemId,
  onCancel,
  onSuccess,
}: CreateLinkFormProps) => {
  const { mutate: createLink, isPending } = useCreateWorkItemLink();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      workspaceId,
      sourceItemId: sourceItemId || "",
      targetItemId: "",
      linkType: WorkItemLinkType.RELATES_TO,
      description: "",
      createInverse: true,
    },
  });

  const onSubmit = (values: FormValues) => {
    createLink(
      { json: values },
      {
        onSuccess: () => {
          form.reset();
          onSuccess?.();
        },
      }
    );
  };

  const linkTypes = Object.entries(LINK_TYPE_METADATA);

  return (
    <Card className="w-full h-full border-none shadow-none">
      <CardHeader className="flex p-7">
        <CardTitle className="text-xl font-bold">Create Link</CardTitle>
      </CardHeader>
      <CardContent className="p-7">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="linkType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select link type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {linkTypes.map(([value, metadata]) => (
                        <SelectItem key={value} value={value}>
                          {metadata.label}
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
              name="sourceItemId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source Item ID</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter source work item ID"
                      disabled={isPending || !!sourceItemId}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetItemId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Item ID</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter target work item ID"
                      disabled={isPending}
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
                      {...field}
                      placeholder="Describe the relationship..."
                      disabled={isPending}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-end gap-2 pt-4">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create Link"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
