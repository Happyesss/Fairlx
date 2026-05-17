"use client";

import { z } from "zod";
import Image from "next/image";
import { ImageIcon, Settings, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { updateWorkspaceSchema } from "../schemas";
import { Workspace } from "../types";
import { useUpdateWorkspace } from "../api/use-update-workspace";
import { useConfirm } from "@/hooks/use-confirm";
import { useDeleteWorkspace } from "../api/use-delete-workspace";


interface EditWorkspaceFormProps {
  onCancel?: () => void;
  initialValues: Workspace;
}

export const EditWorkspaceForm = ({
  onCancel,
  initialValues,
}: EditWorkspaceFormProps) => {
  const { mutate, isPending } = useUpdateWorkspace();
  const { mutate: deleteWorkspace, isPending: isDeletingWorkspace } =
    useDeleteWorkspace();

  const [DeleteDialog, confirmDelete] = useConfirm(
    "Delete Workspace",
    "This action cannot be undone.",
    "destructive"
  );



  const inputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof updateWorkspaceSchema>>({
    resolver: zodResolver(updateWorkspaceSchema),
    defaultValues: {
      ...initialValues,
      image: initialValues.imageUrl ?? "",
    },
  });

  const handleDelete = async () => {
    const ok = await confirmDelete();

    if (!ok) return;

    deleteWorkspace(
      { param: { workspaceId: initialValues.$id } },
      {
        onSuccess: () => {
          window.location.href = "/";
        },
      }
    );
  };



  const onSubmit = (values: z.infer<typeof updateWorkspaceSchema>) => {
    const finalValues = {
      ...values,
      image: values.image instanceof File ? values.image : "",
    };

    mutate({ form: finalValues, param: { workspaceId: initialValues.$id } });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("image", file);
    }
  };



  return (
    <div className="w-full max-w-3xl space-y-8">
      <DeleteDialog />

      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
          <Settings className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspace Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your workspace identity and configuration
          </p>
        </div>
      </div>

      <Separator />

      {/* General Settings Card */}
      <Card className="border border-border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
          <CardDescription>
            Update your workspace name and icon
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* Workspace Icon Row */}
              <FormField
                control={form.control}
                name="image"
                render={({ field }) => (
                  <div className="flex items-center gap-5">
                    {/* Avatar */}
                    <div className="shrink-0">
                      {field.value ? (
                        <div className="size-16 relative rounded-lg overflow-hidden ring-2 ring-border">
                          <Image
                            src={
                              field.value instanceof File
                                ? URL.createObjectURL(field.value)
                                : field.value
                            }
                            alt="Workspace icon"
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <Avatar className="size-16 rounded-lg">
                          <AvatarFallback className="rounded-lg bg-muted">
                            <ImageIcon className="size-6 text-muted-foreground" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>

                    {/* Label + Actions */}
                    <div className="flex flex-col gap-1.5">
                      <p className="text-sm font-medium leading-none">Workspace Icon</p>
                      <p className="text-xs text-muted-foreground">
                        JPG, PNG, SVG or JPEG — max 1MB
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          className="hidden"
                          accept=".jpg,.png,.jpeg,.svg"
                          type="file"
                          ref={inputRef}
                          onChange={handleImageChange}
                          disabled={isPending}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          disabled={isPending}
                          onClick={() => inputRef.current?.click()}
                          className="h-8 text-xs gap-1.5"
                        >
                          <Upload className="size-3" />
                          {field.value ? "Change" : "Upload"}
                        </Button>
                        {field.value && (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              field.onChange(null);
                              if (inputRef.current) inputRef.current.value = "";
                            }}
                            className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              />

              <Separator />

              {/* Workspace Name Row */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="sm:w-48 shrink-0">
                        <FormLabel className="text-sm font-medium">Workspace Name</FormLabel>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Visible to all members
                        </p>
                      </div>
                      <div className="flex-1">
                        <FormControl>
                          <Input
                            placeholder="Enter workspace name"
                            className="h-9"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="mt-1.5" />
                      </div>
                    </div>
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-2">
                <div className="flex items-center gap-3">
                  {onCancel && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onCancel}
                      disabled={isPending}
                      size="sm"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={isPending}
                    size="sm"
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Danger Zone Card */}
      <Card className="border border-destructive/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="size-4 text-destructive" />
            <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
          </div>
          <CardDescription>
            Irreversible actions that permanently affect your workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <div>
              <p className="text-sm font-medium">Delete this workspace</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Once deleted, all data including projects, tasks, and members will be permanently removed.
              </p>
            </div>
            <Button
              size="sm"
              variant="destructive"
              type="button"
              disabled={isPending || isDeletingWorkspace}
              onClick={handleDelete}
              className="shrink-0"
            >
              Delete Workspace
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
