"use client";

import { z } from "zod";
import Image from "next/image";
import { ArrowLeftIcon, ImageIcon, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { DottedSeparator } from "@/components/dotted-separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { updateProjectSchema } from "../schemas";
import { Project } from "../types";
import { useUpdateProject } from "../api/use-update-project";
import { useConfirm } from "@/hooks/use-confirm";
import { useDeleteProject } from "../api/use-delete-project";
import { WorkTypesSettings } from "./work-types-settings";
import { PrioritySettings } from "./priority-settings";
import { LabelSettings } from "./label-settings";
import { CopySettingsDialog } from "./copy-settings-dialog";
import { WebhookSettings } from "@/features/webhooks/components/webhook-settings";

interface EditProjectFormProps {
  onCancel?: () => void;
  initialValues: Project;
}

export const EditProjectForm = ({
  onCancel,
  initialValues,
}: EditProjectFormProps) => {
  const router = useRouter();
  const { mutate, isPending } = useUpdateProject();
  const { mutate: deleteProject, isPending: isDeletingProject } =
    useDeleteProject();

  const { isAdmin } = useCurrentMember({ workspaceId: initialValues.workspaceId });

  const [DeleteDialog, confirmDelete] = useConfirm(
    "Delete Project",
    "This action cannot be undone. All data will be lost.",
    "destructive"
  );

  const [isCopySettingsOpen, setIsCopySettingsOpen] = useState(false);

  // Placeholder for copy settings dialog - in real imp would be a modal
  const handleCopySettings = () => {
    setIsCopySettingsOpen(true);
  }

  const inputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof updateProjectSchema>>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: {
      ...initialValues,
      image: initialValues.imageUrl ?? "",
      defaultSwimlane:
        initialValues.defaultSwimlane && ["type", "none", "assignee", "epic"].includes(initialValues.defaultSwimlane)
          ? (initialValues.defaultSwimlane as "type" | "none" | "assignee" | "epic")
          : undefined,
      customWorkItemTypes: initialValues.customWorkItemTypes || [],
      customPriorities: initialValues.customPriorities || [],
      customLabels: initialValues.customLabels || [],
    },
  });

  const handleDelete = async () => {
    const ok = await confirmDelete();

    if (!ok) return;

    deleteProject(
      { param: { projectId: initialValues.$id } },
      {
        onSuccess: () => {
          window.location.href = `/workspaces/${initialValues.workspaceId}`;
        },
      }
    );
  };

  const onSubmit = (values: z.infer<typeof updateProjectSchema>) => {
    // Convert nullable fields to undefined and build final values object
    const finalValues: Record<string, unknown> = {};

    Object.entries(values).forEach(([key, value]) => {
      if (key === "image") {
        // Issue 16: Properly handle image removal
        // - If null, explicitly send empty string to clear the image on backend
        // - If File, send the file
        // - Otherwise send empty string (covers existing string URLs that weren't changed)
        if (value === null) {
          finalValues[key] = ""; // Explicitly clear image
        } else if (value instanceof File) {
          finalValues[key] = value;
        } else {
          // Keep existing image URL or empty
          finalValues[key] = value || "";
        }
      } else if (value === null) {
        finalValues[key] = undefined;
      } else {
        finalValues[key] = value;
      }
    });

    mutate({ form: finalValues, param: { projectId: initialValues.$id } });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("image", file);
    }
  };

  return (
    <div className="flex flex-col gap-y-4">
      <DeleteDialog />
      <CopySettingsDialog
        open={isCopySettingsOpen}
        onOpenChange={setIsCopySettingsOpen}
        currentProjectId={initialValues.$id}
        workspaceId={initialValues.workspaceId}
      />
      <Card className="w-full h-full border-none shadow-none">
        <CardHeader className="flex flex-row items-center gap-x-4 p-7 space-y-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={
              onCancel
                ? onCancel
                : () =>
                  router.push(
                    `/workspaces/${initialValues.workspaceId}/projects/${initialValues.$id}`
                  )
            }
          >
            <ArrowLeftIcon className="size-4" />
            Back
          </Button>
          <CardTitle className="text-xl font-bold">
            Project Settings: {initialValues.name}
          </CardTitle>
        </CardHeader>
        <div className="px-7">
          <DottedSeparator />
        </div>
        <CardContent className="p-7">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-6">
                  <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground px-6 py-3">General</TabsTrigger>
                  <TabsTrigger value="types" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground px-6 py-3">Work Types</TabsTrigger>
                  <TabsTrigger value="priorities" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground px-6 py-3">Priorities</TabsTrigger>
                  <TabsTrigger value="labels" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground px-6 py-3">Labels</TabsTrigger>
                  <TabsTrigger value="webhooks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground px-6 py-3">Webhooks</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-6">
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={handleCopySettings}>
                      <Copy className="size-3.5 mr-2" />
                      Copy Settings from Project...
                    </Button>
                  </div>

                  <div className="flex flex-col gap-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter project name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="image"
                      render={({ field }) => (
                        <div className="flex flex-col gap-y-2">
                          <div className="flex items-center gap-x-5">
                            {field.value ? (
                              <div className="size-[72px] relative rounded-md overflow-hidden">
                                <Image
                                  src={
                                    field.value instanceof File
                                      ? URL.createObjectURL(field.value)
                                      : field.value
                                  }
                                  alt="Logo"
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <Avatar className="size-[72px]">
                                <AvatarFallback>
                                  <ImageIcon className="size-[36px] text-muted-foreground" />
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div className="flex flex-col">
                              <p className="text-sm">Project Icon</p>
                              <p className="text-sm text-muted-foreground">
                                JPG, PNG, SVG or JPEG, max 1MB
                              </p>
                              <input
                                className="hidden"
                                accept=".jpg, .png, .jpeg, .svg"
                                type="file"
                                ref={inputRef}
                                onChange={handleImageChange}
                                disabled={isPending}
                              />
                              {field.value ? (
                                <Button
                                  variant="destructive"
                                  type="button"
                                  disabled={isPending}
                                  size="xs"
                                  className="w-fit mt-2"
                                  onClick={() => {
                                    field.onChange(null);
                                    if (inputRef.current) {
                                      inputRef.current.value = "";
                                    }
                                  }}
                                >
                                  Remove Image
                                </Button>
                              ) : (
                                <Button
                                  variant="teritary"
                                  type="button"
                                  disabled={isPending}
                                  size="xs"
                                  className="w-fit mt-2"
                                  onClick={() => inputRef.current?.click()}
                                >
                                  Upload Image
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="types">
                  <FormField
                    control={form.control}
                    name="customWorkItemTypes"
                    render={({ field }) => (
                      <WorkTypesSettings
                        types={field.value || []}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </TabsContent>

                <TabsContent value="priorities">
                  <FormField
                    control={form.control}
                    name="customPriorities"
                    render={({ field }) => (
                      <PrioritySettings
                        priorities={field.value || []}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </TabsContent>

                <TabsContent value="labels">
                  <FormField
                    control={form.control}
                    name="customLabels"
                    render={({ field }) => (
                      <LabelSettings
                        labels={field.value || []}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </TabsContent>
                <TabsContent value="webhooks">
                  <WebhookSettings projectId={initialValues.$id} />
                </TabsContent>
              </Tabs>

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

      {/* Moved Danger Zone to its own card outside the main form card, always visible at bottom */}
      {isAdmin && (
        <Card className="w-full h-full border-none shadow-none bg-destructive/5">
          <CardContent className="p-7">
            <div className="flex flex-col">
              <h3 className="font-bold text-red-600">Danger Zone</h3>
              <p className="text-sm text-muted-foreground">
                Deleting a project is irreversible and will remove all
                associated data.
              </p>
              <DottedSeparator className="py-7" />
              <Button
                className="mt-6 w-fit ml-auto"
                size="sm"
                variant="destructive"
                type="button"
                disabled={isPending || isDeletingProject}
                onClick={handleDelete}
              >
                Delete Project
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
