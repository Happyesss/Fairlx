"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  ArrowLeft,
  Settings,
  Users,
  Shield,
  Trash2,
  ImageIcon,
  Info,
  X,
  Loader,
  Calendar,
  FolderKanban,
  BarChart3,
  Clock,
  CheckCircle2,
  AlertCircle,
  ListTodo,
} from "lucide-react";

import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useGetProject } from "@/features/projects/api/use-get-project";
import { useUpdateProject } from "@/features/projects/api/use-update-project";
import { useDeleteProject } from "@/features/projects/api/use-delete-project";
import { useGetProjectAnalytics } from "@/features/projects/api/use-get-project-analytics";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { useGetTeams } from "@/features/teams/api/use-get-teams";
import { useAssignProjectToTeam } from "@/features/projects/api/use-assign-project-to-team";
import { useUnassignProjectFromTeam } from "@/features/projects/api/use-unassign-project-from-team";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { updateProjectSchema } from "@/features/projects/schemas";

export const ProjectIdSettingsClient = () => {
  const router = useRouter();
  const projectId = useProjectId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("general");

  // Data fetching
  const { data: project, isLoading: isLoadingProject } = useGetProject({ projectId });
  const { data: analytics, isLoading: isLoadingAnalytics } = useGetProjectAnalytics({ projectId });
  const { data: teamsData, isLoading: isLoadingTeams } = useGetTeams({
    workspaceId: project?.workspaceId || "",
  });
  const { data: membersData } = useGetMembers({
    workspaceId: project?.workspaceId || "",
  });
  const { isLoading: isMemberLoading, isAdmin } = useCurrentMember({
    workspaceId: project?.workspaceId || "",
  });

  // Mutations
  const { mutate: updateProject, isPending: isUpdating } = useUpdateProject();
  const { mutate: deleteProject, isPending: isDeleting } = useDeleteProject();
  const { mutate: assignTeam, isPending: isAssigning } = useAssignProjectToTeam();
  const { mutate: unassignTeam, isPending: isUnassigning } = useUnassignProjectFromTeam();

  // Form setup
  const form = useForm<z.infer<typeof updateProjectSchema>>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: {
      name: project?.name || "",
      description: project?.description || "",
      deadline: project?.deadline || "",
      image: project?.imageUrl || "",
    },
  });

  // Update form when project data loads
  if (project && form.getValues("name") !== project.name) {
    form.reset({
      name: project.name,
      description: project.description || "",
      deadline: project.deadline || "",
      image: project.imageUrl || "",
    });
  }

  const isLoading = isLoadingProject || isMemberLoading;
  const teams = teamsData?.documents || [];
  const members = membersData?.documents || [];
  const assignedTeamIds = project?.assignedTeamIds || [];
  const availableTeams = teams.filter((team) => !assignedTeamIds.includes(team.$id));

  if (isLoading) {
    return <PageLoader />;
  }

  if (!project) {
    return <PageError message="Project not found." />;
  }

  // Handlers
  const onSubmit = (values: z.infer<typeof updateProjectSchema>) => {
    const finalValues = {
      ...values,
      image: values.image instanceof File ? values.image : "",
      deadline: values.deadline || undefined,
    };
    updateProject({ form: finalValues, param: { projectId: project.$id } });
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

  const handleAssignTeam = () => {
    if (!selectedTeamId) return;
    assignTeam(
      { param: { projectId: project.$id, teamId: selectedTeamId } },
      { onSuccess: () => setSelectedTeamId("") }
    );
  };

  const handleUnassignTeam = (teamId: string) => {
    unassignTeam({ param: { projectId: project.$id, teamId } });
  };

  const getTeamName = (teamId: string) => {
    return teams.find((team) => team.$id === teamId)?.name || "Unknown Team";
  };

  const getTeamMembers = (teamId: string) => {
    const team = teams.find((t) => t.$id === teamId);
    return team?.memberCount || 0;
  };

  // Get members working on this project (from assigned teams)
  const getProjectMembers = () => {
    // Return all workspace members for now
    // TODO: When team member IDs are available in Team type, filter by team membership
    return members;
  };

  const projectMembers = getProjectMembers();

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/workspaces/${project.workspaceId}/projects/${project.$id}`)}
              className="gap-2"
            >
              <ArrowLeft className="size-4" />
              Back to Project
            </Button>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <Avatar className="size-16 border-2 border-neutral-200">
              {project.imageUrl ? (
                <AvatarImage src={project.imageUrl} alt={project.name} />
              ) : (
                <AvatarFallback className="text-2xl font-semibold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                  {project.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">{project.name}</h1>
              <p className="text-sm text-neutral-500">
                Created {format(new Date(project.$createdAt), "MMM d, yyyy")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border shadow-sm">
            <TabsTrigger value="general" className="gap-2">
              <Settings className="size-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <Users className="size-4" />
              Team Access
            </TabsTrigger>
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="size-4" />
              Overview
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="danger" className="gap-2 text-red-600 data-[state=active]:text-red-600">
                <Shield className="size-4" />
                Danger Zone
              </TabsTrigger>
            )}
          </TabsList>

          {/* General Settings Tab */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderKanban className="size-5" />
                  Project Details
                </CardTitle>
                <CardDescription>
                  Update your project information and branding
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter project name"
                              {...field}
                              className="max-w-md"
                            />
                          </FormControl>
                          <FormDescription>
                            This is the display name for your project
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
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter project description"
                              className="max-w-md resize-none"
                              rows={4}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            A brief description of your project (optional)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="deadline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Deadline</FormLabel>
                          <div className="pt-1">
                            <DatePicker
                              value={field.value ? new Date(field.value) : undefined}
                              onChange={(date) => {
                                field.onChange(date ? date.toISOString() : "");
                              }}
                              className="max-w-md h-10"
                              size="default"
                              placeholder="Select deadline"
                            />
                          </div>
                          <FormDescription>
                            Set a deadline for this project (optional)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="image"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Icon</FormLabel>
                          <div className="flex items-center gap-6">
                            {field.value ? (
                              <div className="size-24 relative rounded-lg overflow-hidden border-2 border-neutral-200">
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
                              <div className="size-24 rounded-lg border-2 border-dashed border-neutral-300 flex items-center justify-center bg-neutral-50">
                                <ImageIcon className="size-8 text-neutral-400" />
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
                                onClick={() => inputRef.current?.click()}
                                disabled={isUpdating}
                              >
                                {field.value ? "Change Icon" : "Upload Icon"}
                              </Button>
                              {field.value && (
                                <Button
                                  variant="ghost"
                                  type="button"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
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

                    <Separator />

                    <div className="flex justify-end">
                      <Button type="submit" disabled={isUpdating}>
                        {isUpdating ? (
                          <>
                            <Loader className="size-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Access Tab */}
          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5" />
                  Team Access Control
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-6">
                          <Info className="size-4 text-neutral-400" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-sm">
                          Assign teams to control project access. If no teams are assigned,
                          all workspace members can access the project.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
                <CardDescription>
                  Manage which teams have access to this project
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Assigned Teams */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Assigned Teams</h4>
                  {assignedTeamIds.length === 0 ? (
                    <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertCircle className="size-5 text-amber-600" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">No teams assigned</p>
                        <p className="text-xs text-amber-600">
                          All workspace members can access this project
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {assignedTeamIds.map((teamId) => (
                        <div
                          key={teamId}
                          className="flex items-center justify-between p-4 bg-white border rounded-lg hover:border-neutral-300 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                              {getTeamName(teamId).charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium">{getTeamName(teamId)}</p>
                              <p className="text-xs text-neutral-500">
                                {getTeamMembers(teamId)} members
                              </p>
                            </div>
                          </div>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-neutral-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleUnassignTeam(teamId)}
                              disabled={isAssigning || isUnassigning}
                            >
                              <X className="size-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Team */}
                {isAdmin && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Add Team</h4>
                      {isLoadingTeams ? (
                        <div className="flex items-center gap-2 text-neutral-500">
                          <Loader className="size-4 animate-spin" />
                          Loading teams...
                        </div>
                      ) : availableTeams.length === 0 ? (
                        <p className="text-sm text-neutral-500 italic">
                          {teams.length === 0
                            ? "No teams exist yet. Create a team first."
                            : "All teams are already assigned."}
                        </p>
                      ) : (
                        <div className="flex items-center gap-3 max-w-md">
                          <Select
                            value={selectedTeamId}
                            onValueChange={setSelectedTeamId}
                            disabled={isAssigning || isUnassigning}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a team" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableTeams.map((team) => (
                                <SelectItem key={team.$id} value={team.$id}>
                                  {team.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={handleAssignTeam}
                            disabled={!selectedTeamId || isAssigning || isUnassigning}
                          >
                            {isAssigning ? (
                              <Loader className="size-4 animate-spin" />
                            ) : (
                              "Add"
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Project Members */}
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-3">
                    Project Members ({projectMembers.length})
                  </h4>
                  <p className="text-xs text-neutral-500 mb-4">
                    {assignedTeamIds.length === 0
                      ? "All workspace members have access"
                      : "Members from assigned teams"}
                  </p>
                  {projectMembers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {projectMembers.slice(0, 20).map((member) => (
                        <TooltipProvider key={member.$id} delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Avatar className="size-10 border-2 border-white shadow-sm cursor-default">
                                <AvatarFallback className="bg-gradient-to-br from-green-500 to-teal-600 text-white text-sm">
                                  {member.name?.charAt(0)?.toUpperCase() || "U"}
                                </AvatarFallback>
                              </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{member.name || member.email}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                      {projectMembers.length > 20 && (
                        <div className="size-10 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-medium text-neutral-600">
                          +{projectMembers.length - 20}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500 italic">No members found</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-lg bg-blue-100 flex items-center justify-center">
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
                    <div className="size-12 rounded-lg bg-green-100 flex items-center justify-center">
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
                    <div className="size-12 rounded-lg bg-red-100 flex items-center justify-center">
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
              <CardHeader>
                <CardTitle>Project Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg">
                    <Calendar className="size-5 text-neutral-500" />
                    <div>
                      <p className="text-sm text-neutral-500">Created</p>
                      <p className="font-medium">
                        {format(new Date(project.$createdAt), "MMMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg">
                    <Clock className="size-5 text-neutral-500" />
                    <div>
                      <p className="text-sm text-neutral-500">Last Updated</p>
                      <p className="font-medium">
                        {format(new Date(project.$updatedAt), "MMMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg">
                    <Users className="size-5 text-neutral-500" />
                    <div>
                      <p className="text-sm text-neutral-500">Teams Assigned</p>
                      <p className="font-medium">
                        {assignedTeamIds.length === 0
                          ? "All workspace members"
                          : `${assignedTeamIds.length} team${assignedTeamIds.length > 1 ? "s" : ""}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg">
                    <Users className="size-5 text-neutral-500" />
                    <div>
                      <p className="text-sm text-neutral-500">Members with Access</p>
                      <p className="font-medium">{projectMembers.length} members</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Danger Zone Tab */}
          {isAdmin && (
            <TabsContent value="danger" className="space-y-6">
              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <Shield className="size-5" />
                    Danger Zone
                  </CardTitle>
                  <CardDescription>
                    Irreversible and destructive actions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div>
                      <p className="font-medium text-red-900">Delete this project</p>
                      <p className="text-sm text-red-700">
                        Once deleted, the project and all its data cannot be recovered.
                        This includes all tasks, sprints, comments, and attachments.
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isDeleting}>
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
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};
