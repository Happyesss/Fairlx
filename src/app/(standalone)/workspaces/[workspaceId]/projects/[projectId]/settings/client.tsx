"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Settings,
  Shield,
  Trash2,
  ImageIcon,
  Loader,
  Calendar,
  FolderKanban,
  BarChart3,
  Clock,
  CheckCircle2,
  AlertCircle,
  ListTodo,
  Copy,
  Tag,
  Flag,
  Layers,
  Webhook,
  Puzzle,
} from "lucide-react";
import { GoHome } from "react-icons/go";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { Navbar } from "@/components/navbar";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import { useGetProject } from "@/features/projects/api/use-get-project";
import { useUpdateProject, UpdateProjectRequest } from "@/features/projects/api/use-update-project";
import { useDeleteProject } from "@/features/projects/api/use-delete-project";
import { useGetProjectAnalytics } from "@/features/projects/api/use-get-project-analytics";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { updateProjectSchema } from "@/features/projects/schemas";
import { WorkTypesSettings } from "@/features/projects/components/work-types-settings";
import { PrioritySettings } from "@/features/projects/components/priority-settings";
import { LabelSettings } from "@/features/projects/components/label-settings";
import { CopySettingsDialog } from "@/features/projects/components/copy-settings-dialog";
import { WebhookSettings } from "@/features/webhooks/components/webhook-settings";
import { useProjectPermissions } from "@/hooks/use-project-permissions";
import { ProjectIntegrationsSettings } from "@/features/projects/components/project-integrations-settings";

const ProjectIdSettingsClientContent = () => {
  const projectId = useProjectId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("general");
  const [isCopySettingsOpen, setIsCopySettingsOpen] = useState(false);
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Data fetching
  const { data: project, isLoading: isLoadingProject } = useGetProject({ projectId });
  const { data: analytics, isLoading: isLoadingAnalytics } = useGetProjectAnalytics({ projectId });

  const { isLoading: isMemberLoading, isAdmin } = useCurrentMember({
    workspaceId: project?.workspaceId || "",
  });

  // Project-level permissions for delete
  const { canDeleteProject } = useProjectPermissions({
    projectId,
    workspaceId: project?.workspaceId,
  });

  // Mutations
  const { mutate: updateProject, isPending: isUpdating } = useUpdateProject();
  const { mutate: deleteProject, isPending: isDeleting } = useDeleteProject();

  // Form setup
  const form = useForm<z.infer<typeof updateProjectSchema>>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: {
      name: project?.name || "",
      description: project?.description || "",
      deadline: project?.deadline || "",
      image: project?.imageUrl || "",
      customWorkItemTypes: project?.customWorkItemTypes || [],
      customPriorities: project?.customPriorities || [],
      customLabels: project?.customLabels || [],
    },
  });

  // Update form when project data loads
  useEffect(() => {
    if (project && form.getValues("name") !== project.name && !isUpdating) {
      form.reset({
        name: project.name,
        description: project.description || "",
        deadline: project.deadline || "",
        image: project.imageUrl || "",
        customWorkItemTypes: project.customWorkItemTypes || [],
        customPriorities: project.customPriorities || [],
        customLabels: project.customLabels || [],
      });
    }
  }, [project, form, isUpdating]);

  const isLoading = isLoadingProject || isMemberLoading;

  if (isLoading) {
    return <PageLoader />;
  }

  if (!project) {
    return <PageError message="Project not found." />;
  }

  // Handlers
  const onSubmit = (values: z.infer<typeof updateProjectSchema>) => {
    // Convert nullable fields to undefined and build final values object
    const finalValues: Record<string, unknown> = {};

    Object.entries(values).forEach(([key, value]) => {
      if (value === null) {
        finalValues[key] = undefined;
      } else if (key === "image") {
        finalValues[key] = value instanceof File ? value : "";
      } else if (key === "customWorkItemTypes" || key === "customPriorities" || key === "customLabels") {
        // Stringify arrays for FormData
        finalValues[key] = JSON.stringify(value);
      } else {
        finalValues[key] = value;
      }
    });

    updateProject({ form: finalValues as unknown as UpdateProjectRequest["form"], param: { projectId: project.$id } });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("image", file);
    }
  };

  const handleDelete = () => {
    deleteProject(
      { param: { projectId: project.$id } },
      {
        onSuccess: () => {
          window.location.href = `/workspaces/${project.workspaceId}`;
        },
      }
    );
  };

  // Navigation items for the settings sidebar
  const settingsNavItems = [
    { id: "general", label: "General", icon: Settings },
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "types", label: "Work Types", icon: Layers },
    { id: "priorities", label: "Priorities", icon: Flag },
    { id: "labels", label: "Labels", icon: Tag },
    { id: "webhooks", label: "Webhooks", icon: Webhook },
    { id: "integrations", label: "Integrations", icon: Puzzle },
    ...((isAdmin || canDeleteProject) ? [{ id: "danger", label: "Danger Zone", icon: Shield, danger: true }] : []),
  ];

  return (
    <div className="min-h-screen flex">
      {/* Settings Sidebar — desktop only */}
      <aside className="h-screen bg-background w-[264px] overflow-hidden border-r border-border hidden lg:flex flex-col fixed left-0 top-0">
        <div className="flex items-center w-full py-5 px-4 border-b border-border flex-shrink-0">
          <Link href="/">
            <Image src="/Logo.png" className="object-contain" alt="logo" width={80} height={90} />
          </Link>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Navigation */}
          <div className="p-3 border-b border-border flex-shrink-0">
            <ul className="flex flex-col">
              <Link href={`/workspaces/${project.workspaceId}`}>
                <div className="flex items-center gap-2.5 p-2.5 rounded-md font-medium transition text-muted-foreground hover:bg-accent">
                  <GoHome className="size-5 text-muted-foreground" />
                  <p className="text-[13px] tracking-tight font-medium">Home</p>
                </div>
              </Link>
              <Link href={`/workspaces/${project.workspaceId}/projects/${project.$id}`}>
                <div className="flex items-center gap-2.5 p-2.5 rounded-md font-medium transition text-muted-foreground hover:bg-accent border border-transparent">
                  <FolderKanban className="size-5 text-muted-foreground" />
                  <p className="text-[13px] tracking-tight font-medium">Back to Project</p>
                </div>
              </Link>
            </ul>
          </div>

          {/* Settings Navigation */}
          <div className="p-3 flex-1 overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider px-2.5 mb-2">
              Project Settings
            </p>
            <ul className="flex flex-col">
              {settingsNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        "flex items-center gap-2.5 p-2.5 rounded-md font-medium transition w-full text-left",
                        isActive
                          ? "bg-accent shadow-sm text-primary"
                          : "text-muted-foreground hover:bg-muted/50",
                        item.danger && "text-destructive hover:bg-destructive/10"
                      )}
                    >
                      <Icon className={cn(
                        "size-5",
                        isActive ? "text-primary" : "text-muted-foreground",
                        item.danger && "text-destructive"
                      )} />
                      <p className="text-[13px] tracking-tight font-medium">{item.label}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-[264px] w-full min-h-screen bg-background flex flex-col">
        {/* Navbar */}
        <Navbar />

        {/* Mobile Settings Nav */}
        <div className="lg:hidden overflow-x-auto border-b bg-background sticky top-0 z-10">
          <div className="flex items-center gap-1 p-2 min-w-max">
            {settingsNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition",
                    isActive
                      ? "bg-accent text-primary"
                      : "text-muted-foreground hover:bg-muted/50",
                    item.danger && "text-destructive"
                  )}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-3 sm:p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Project Header Card */}
            <div className="w-full p-4 sm:p-5 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4 sm:gap-5">
                <Avatar className="size-24 border-2 border-border">
                  {project.imageUrl ? (
                    <AvatarImage src={project.imageUrl} alt={project.name} />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-3xl font-semibold">
                      {project.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex flex-col">
                  <h1 className="text-[22px] font-semibold text-foreground">{project.name}</h1>
                  <p className="text-[13px] text-muted-foreground">Project Settings</p>
                  <p className="text-[13px] text-muted-foreground">
                    Created {format(new Date(project.$createdAt), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white border-0" size="sm" onClick={() => setIsCopySettingsOpen(true)}>
                <Copy className="size-3.5 mr-2" />
                Copy Settings
              </Button>
            </div>

            <CopySettingsDialog
              open={isCopySettingsOpen}
              onOpenChange={setIsCopySettingsOpen}
              currentProjectId={project.$id}
              workspaceId={project.workspaceId}
            />

            {/* General Settings */}
            {activeTab === "general" && (
              <Card>
                <CardHeader className="mb-3">
                  <CardTitle className="!text-[18px]">Project Details</CardTitle>
                  <CardDescription className="!text-xs font-normal">
                    Update your project information and branding
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="flex items-center gap-2">
                              <FolderKanban className="size-4" />
                              Project Name
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter project name"
                                {...field}
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
                          <FormItem className="space-y-2">
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Enter project description"
                                className="resize-none"
                                rows={4}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="deadline"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="flex items-center gap-2">
                              <Calendar className="size-4" />
                              Project Deadline
                            </FormLabel>
                            <div className="pt-1">
                              <DatePicker
                                value={field.value ? new Date(field.value) : undefined}
                                onChange={(date) => {
                                  field.onChange(date ? date.toISOString() : "");
                                }}
                                className="h-10"
                                size="default"
                                placeholder="Select deadline"
                              />
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="image"
                        render={({ field }) => (
                          <FormItem className="space-y-2 !mb-5">
                            <FormLabel>Project Icon</FormLabel>
                            <div className="flex items-center gap-6">
                              {field.value ? (
                                <div className="size-24 relative rounded-lg overflow-hidden border-2 border-border">
                                  <Image
                                    src={
                                      field.value instanceof File
                                        ? URL.createObjectURL(field.value)
                                        : field.value
                                    }
                                    alt="Project icon"
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="size-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
                                  <ImageIcon className="size-8 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex flex-col gap-2">
                                <input
                                  className="hidden"
                                  accept=".jpg,.png,.jpeg,.svg"
                                  type="file"
                                  ref={inputRef}
                                  onChange={handleImageChange}
                                  disabled={isUpdating}
                                />
                                <Button
                                  variant="outline"
                                  type="button"
                                  size="sm"
                                  onClick={() => inputRef.current?.click()}
                                  disabled={isUpdating}
                                >
                                  {field.value ? "Change Icon" : "Upload Icon"}
                                </Button>
                                {field.value && (
                                  <Button
                                    variant="ghost"
                                    type="button"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                      field.onChange(null);
                                      if (inputRef.current) inputRef.current.value = "";
                                    }}
                                    disabled={isUpdating}
                                  >
                                    Remove Icon
                                  </Button>
                                )}
                                <p className="text-xs text-neutral-500">
                                  JPG, PNG, SVG or JPEG (max 1MB)
                                </p>
                              </div>
                            </div>
                          </FormItem>
                        )}
                      />

                      <Button type="submit" disabled={isUpdating} size="xs" className="text-xs font-medium px-6 rounded-sm py-3">
                        {isUpdating ? (
                          <>
                            <Loader className="size-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}



            {/* Overview */}
            {activeTab === "overview" && (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="size-12 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
                          <ListTodo className="size-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {isLoadingAnalytics ? "..." : analytics?.taskCount || 0}
                          </p>
                          <p className="text-sm text-neutral-500">Total Tasks</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="size-12 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center">
                          <CheckCircle2 className="size-6 text-green-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {isLoadingAnalytics ? "..." : analytics?.completedTaskCount || 0}
                          </p>
                          <p className="text-sm text-neutral-500">Completed</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="size-12 rounded-lg bg-amber-100 flex items-center justify-center">
                          <Clock className="size-6 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {isLoadingAnalytics ? "..." : analytics?.incompleteTaskCount || 0}
                          </p>
                          <p className="text-sm text-neutral-500">In Progress</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="size-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                          <AlertCircle className="size-6 text-red-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {isLoadingAnalytics ? "..." : analytics?.overdueTaskCount || 0}
                          </p>
                          <p className="text-sm text-neutral-500">Overdue</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="mb-3">
                    <CardTitle className="!text-[18px]">Project Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                        <Calendar className="size-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Created</p>
                          <p className="font-medium text-sm">
                            {format(new Date(project.$createdAt), "MMMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                        <Clock className="size-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-neutral-500">Last Updated</p>
                          <p className="font-medium text-sm">
                            {format(new Date(project.$updatedAt), "MMMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Work Types */}
            {activeTab === "types" && (
              <Card>
                <CardHeader className="mb-3">
                  <CardTitle className="!text-[18px]">Work Item Types</CardTitle>
                  <CardDescription className="!text-xs font-normal">
                    Customize the types of work items available in this project
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                      <Button type="submit" disabled={isUpdating} size="xs" className="text-xs font-medium px-6 rounded-sm py-3">
                        {isUpdating ? (
                          <>
                            <Loader className="size-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {/* Priorities */}
            {activeTab === "priorities" && (
              <Card>
                <CardHeader className="mb-3">
                  <CardTitle className="!text-[18px]">Priorities</CardTitle>
                  <CardDescription className="!text-xs font-normal">
                    Define custom priorities and their order
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                      <Button type="submit" disabled={isUpdating} size="xs" className="text-xs font-medium px-6 rounded-sm py-3">
                        {isUpdating ? (
                          <>
                            <Loader className="size-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {/* Labels */}
            {activeTab === "labels" && (
              <Card>
                <CardHeader className="mb-3">
                  <CardTitle className="!text-[18px]">Labels</CardTitle>
                  <CardDescription className="!text-xs font-normal">
                    Manage custom labels for this project
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                      <Button type="submit" disabled={isUpdating} size="xs" className="text-xs font-medium px-6 rounded-sm py-3">
                        {isUpdating ? (
                          <>
                            <Loader className="size-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {/* Webhooks */}
            {activeTab === "webhooks" && (
              <Card>
                <CardHeader className="mb-3">
                  <CardTitle className="!text-[18px]">Webhooks</CardTitle>
                  <CardDescription className="!text-xs font-normal">
                    Configure external integrations to receive real-time project events.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <WebhookSettings projectId={projectId} />
                </CardContent>
              </Card>
            )}

            {/* Integrations */}
            {activeTab === "integrations" && (
              <Card>
                <CardContent className="pt-6">
                  <ProjectIntegrationsSettings projectId={projectId} isAdmin={isAdmin} />
                </CardContent>
              </Card>
            )}

            {/* Danger Zone - Only show if user has DELETE_PROJECT permission */}
            {activeTab === "danger" && (isAdmin || canDeleteProject) && (
              <Card className="border-red-200">
                <CardHeader className="mb-3">
                  <CardTitle className="!text-[18px] flex items-center gap-2 text-red-600">
                    <Shield className="size-5" />
                    Danger Zone
                  </CardTitle>
                  <CardDescription className="!text-xs font-normal">
                    Irreversible and destructive actions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-destructive/10 border border-destructive/20 rounded-lg gap-3">
                    <div>
                      <p className="font-medium text-destructive text-sm">Delete this project</p>
                      <p className="text-xs text-muted-foreground">
                        Once deleted, the project and all its data cannot be recovered.
                        This includes all tasks, sprints, comments, and attachments.
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={isDeleting}>
                          <Trash2 className="size-4 mr-2" />
                          Delete Project
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the
                            project <span className="font-semibold">&quot;{project.name}&quot;</span> and
                            all associated data including tasks, sprints, comments, and
                            attachments.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                              <>
                                <Loader className="size-4 mr-2 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              "Delete Project"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>


    </div>
  );
};

export const ProjectIdSettingsClient = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <ProjectIdSettingsClientContent />
    </Suspense>
  );
};
