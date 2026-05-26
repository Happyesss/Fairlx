"use client";

import { ArrowLeft, Trash2, Save, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";

import { useGetProgram } from "@/features/programs/api/use-get-program";
import { useUpdateProgram } from "@/features/programs/api/use-update-program";
import { useDeleteProgram } from "@/features/programs/api/use-delete-program";
import { useProgramId } from "@/features/programs/hooks/use-program-id";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { ProgramStatus, ProgramPriority } from "@/features/programs/types";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(128, "Name must be less than 128 characters"),
  description: z.string().optional(),
  status: z.nativeEnum(ProgramStatus),
  priority: z.nativeEnum(ProgramPriority).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export const ProgramSettingsClient = () => {
  const programId = useProgramId();
  const workspaceId = useWorkspaceId();
  const router = useRouter();
  
  const { data: program, isLoading: isLoadingProgram } = useGetProgram({ programId });
  const { isAdmin, isLoading: isLoadingMember } = useCurrentMember({ workspaceId });
  const { mutate: updateProgram, isPending: isUpdating } = useUpdateProgram();
  const { mutate: deleteProgram, isPending: isDeleting } = useDeleteProgram();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: program?.name || "",
      description: program?.description || "",
      status: (program?.status as ProgramStatus) || ProgramStatus.PLANNING,
      priority: (program?.priority as ProgramPriority) || undefined,
      startDate: program?.startDate ? new Date(program.startDate).toISOString().split('T')[0] : "",
      endDate: program?.endDate ? new Date(program.endDate).toISOString().split('T')[0] : "",
      budget: program?.budget || 0,
    },
  });

  // Update form when program data loads
  if (program && !form.formState.isDirty) {
    form.reset({
      name: program.name,
      description: program.description || "",
      status: program.status as ProgramStatus,
      priority: (program.priority as ProgramPriority) || undefined,
      startDate: program.startDate ? new Date(program.startDate).toISOString().split('T')[0] : "",
      endDate: program.endDate ? new Date(program.endDate).toISOString().split('T')[0] : "",
      budget: program.budget || 0,
    });
  }

  if (isLoadingProgram || isLoadingMember) {
    return <PageLoader />;
  }

  if (!program) {
    return <PageError message="Program not found." />;
  }

  if (!isAdmin) {
    return <PageError message="You don't have permission to access program settings." />;
  }

  const onSubmit = (values: FormValues) => {
    updateProgram({
      param: { programId },
      json: {
        name: values.name,
        description: values.description || null,
        status: values.status,
        priority: values.priority,
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
        budget: values.budget || null,
      },
    });
  };

  const handleDelete = () => {
    deleteProgram(
      { param: { programId } },
      {
        onSuccess: () => {
          router.push(`/workspaces/${workspaceId}/programs`);
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-y-6 max-w-4xl">
      {/* Back navigation */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/workspaces/${workspaceId}/programs/${programId}`}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Program
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Program Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your program configuration and settings
        </p>
      </div>

      {/* Settings Form */}
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>
            Update the basic information for this program
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
                    <FormLabel>Program Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter program name" {...field} />
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter program description" 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Provide a brief overview of the program&apos;s purpose and goals
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(ProgramStatus).map((status) => (
                            <SelectItem key={status} value={status}>
                              {status.replace(/_/g, " ")}
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
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(ProgramPriority).map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              {priority}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
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
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Enter budget amount" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Optional: Set a budget for this program
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Button type="submit" disabled={isUpdating}>
                  <Save className="size-4 mr-2" />
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="size-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that will permanently affect your program
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">Delete this program</h4>
              <p className="text-sm text-muted-foreground">
                Once deleted, this program and all its data will be permanently removed.
                This action cannot be undone.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                  <Trash2 className="size-4 mr-2" />
                  Delete Program
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the program
                    &quot;{program.name}&quot; and remove all associated data including
                    milestones and member assignments.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? "Deleting..." : "Delete Program"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
