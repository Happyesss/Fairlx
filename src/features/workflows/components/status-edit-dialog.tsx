"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import {
  Circle,
  CheckCircle,
  Clock,
  Play,
  Pause,
  AlertCircle,
  XCircle,
  Archive,
  Flag,
  Star,
  Zap,
  Target,
  Rocket,
  Bug,
  Lightbulb,
  Bookmark,
  MessageCircle,
  Eye,
  Search,
  Settings,
  Users,
  Shield,
  Lock,
  Unlock,
  Heart,
  ThumbsUp,
  Send,
  FileText,
  Folder,
  Package,
  Code,
  GitBranch,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  WorkflowStatus,
  StatusType,
  STATUS_TYPE_CONFIG,
  STATUS_COLORS,
} from "../types";
import { cn } from "@/lib/utils";

// Available icons for status
const AVAILABLE_ICONS: { name: string; icon: LucideIcon; label: string }[] = [
  { name: "circle", icon: Circle, label: "Circle" },
  { name: "check-circle", icon: CheckCircle, label: "Check" },
  { name: "clock", icon: Clock, label: "Clock" },
  { name: "play", icon: Play, label: "Play" },
  { name: "pause", icon: Pause, label: "Pause" },
  { name: "alert-circle", icon: AlertCircle, label: "Alert" },
  { name: "x-circle", icon: XCircle, label: "Cancel" },
  { name: "archive", icon: Archive, label: "Archive" },
  { name: "flag", icon: Flag, label: "Flag" },
  { name: "star", icon: Star, label: "Star" },
  { name: "zap", icon: Zap, label: "Zap" },
  { name: "target", icon: Target, label: "Target" },
  { name: "rocket", icon: Rocket, label: "Rocket" },
  { name: "bug", icon: Bug, label: "Bug" },
  { name: "lightbulb", icon: Lightbulb, label: "Idea" },
  { name: "bookmark", icon: Bookmark, label: "Bookmark" },
  { name: "message-circle", icon: MessageCircle, label: "Message" },
  { name: "eye", icon: Eye, label: "Review" },
  { name: "search", icon: Search, label: "Search" },
  { name: "settings", icon: Settings, label: "Settings" },
  { name: "users", icon: Users, label: "Users" },
  { name: "shield", icon: Shield, label: "Shield" },
  { name: "lock", icon: Lock, label: "Lock" },
  { name: "unlock", icon: Unlock, label: "Unlock" },
  { name: "heart", icon: Heart, label: "Heart" },
  { name: "thumbs-up", icon: ThumbsUp, label: "Approved" },
  { name: "send", icon: Send, label: "Send" },
  { name: "file-text", icon: FileText, label: "Document" },
  { name: "folder", icon: Folder, label: "Folder" },
  { name: "package", icon: Package, label: "Package" },
  { name: "code", icon: Code, label: "Code" },
  { name: "git-branch", icon: GitBranch, label: "Branch" },
  { name: "refresh-cw", icon: RefreshCw, label: "Refresh" },
];

const statusFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  key: z
    .string()
    .min(1, "Key is required")
    .max(30)
    .regex(
      /^[A-Z][A-Z0-9_]*$/,
      "Key must start with a letter, contain only uppercase letters, numbers, and underscores"
    ),
  statusType: z.nativeEnum(StatusType),
  icon: z.string().min(1, "Icon is required"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
  description: z.string().max(200).optional(),
  isInitial: z.boolean().default(false),
  isFinal: z.boolean().default(false),
});

type StatusFormValues = z.infer<typeof statusFormSchema>;

interface StatusEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status?: WorkflowStatus | null;
  workflowId: string;
  existingKeys: string[];
  onSave: (data: Partial<WorkflowStatus>) => Promise<void>;
}

// Helper to get icon component from name
const getIconFromName = (name: string): LucideIcon => {
  const found = AVAILABLE_ICONS.find((i) => i.name === name);
  return found?.icon || Circle;
};

export const StatusEditDialog = ({
  open,
  onOpenChange,
  status,
  workflowId,
  existingKeys,
  onSave,
}: StatusEditDialogProps) => {
  const isEditing = !!status;

  const form = useForm<StatusFormValues>({
    resolver: zodResolver(statusFormSchema),
    defaultValues: {
      name: status?.name || "",
      key: status?.key || "",
      statusType: status?.statusType || StatusType.OPEN,
      icon: status?.icon || "circle",
      color: status?.color || "#6B7280",
      description: status?.description || "",
      isInitial: status?.isInitial || false,
      isFinal: status?.isFinal || false,
    },
  });

  // Reset form when status changes
  const resetForm = () => {
    form.reset({
      name: status?.name || "",
      key: status?.key || "",
      statusType: status?.statusType || StatusType.OPEN,
      icon: status?.icon || "circle",
      color: status?.color || "#6B7280",
      description: status?.description || "",
      isInitial: status?.isInitial || false,
      isFinal: status?.isFinal || false,
    });
  };

  // Sync form with status prop
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [status, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-generate key from name
  const handleNameChange = (value: string) => {
    form.setValue("name", value);
    if (!isEditing) {
      const key = value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "_")
        .replace(/^[^A-Z]/, "S")
        .substring(0, 30);
      form.setValue("key", key);
    }
  };

  const onSubmit = async (values: StatusFormValues) => {
    // Validate key uniqueness
    if (!isEditing && existingKeys.includes(values.key)) {
      form.setError("key", { message: "This key already exists" });
      return;
    }

    await onSave({
      ...values,
      workflowId,
    });
    onOpenChange(false);
    resetForm();
  };

  const selectedIcon = form.watch("icon");
  const selectedColor = form.watch("color");
  const SelectedIconComponent = getIconFromName(selectedIcon);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Status" : "Create New Status"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modify the status properties"
              : "Add a new status to your workflow"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 overflow-y-auto flex-1 pr-2">
            {/* Name & Key */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="In Progress"
                        {...field}
                        onChange={(e) => handleNameChange(e.target.value)}
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
                    <FormLabel>Key</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="IN_PROGRESS"
                        {...field}
                        readOnly={isEditing}
                        className={cn("font-mono uppercase", isEditing && "bg-muted cursor-not-allowed")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Status Type */}
            <FormField
              control={form.control}
              name="statusType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(STATUS_TYPE_CONFIG).map(
                        ([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <div
                                className="size-3 rounded-full"
                                style={{ backgroundColor: config.defaultColor }}
                              />
                              <span>{config.label}</span>
                              <span className="text-muted-foreground text-xs">
                                - {config.description}
                              </span>
                            </div>
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Used for analytics and reporting. Choose based on how work is progressing.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Icon Picker */}
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="p-2 rounded-lg border"
                      style={{ backgroundColor: `${selectedColor}20` }}
                    >
                      <SelectedIconComponent
                        className="size-6"
                        style={{ color: selectedColor }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Selected: {AVAILABLE_ICONS.find((i) => i.name === field.value)?.label || "Circle"}
                    </span>
                  </div>
                  <ScrollArea className="h-32 rounded-lg border p-2">
                    <div className="grid grid-cols-8 gap-1">
                      {AVAILABLE_ICONS.map((iconItem) => {
                        const Icon = iconItem.icon;
                        return (
                          <button
                            key={iconItem.name}
                            type="button"
                            onClick={() => form.setValue("icon", iconItem.name)}
                            className={cn(
                              "p-2 rounded-md transition-all hover:bg-muted",
                              field.value === iconItem.name &&
                                "ring-2 ring-primary bg-primary/10"
                            )}
                            title={iconItem.label}
                          >
                            <Icon className="size-4" />
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Color */}
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => form.setValue("color", color.value)}
                        className={cn(
                          "w-8 h-8 rounded-lg border-2 transition-all",
                          field.value === color.value
                            ? "border-foreground scale-110"
                            : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div
                      className="w-8 h-8 rounded-lg border"
                      style={{ backgroundColor: field.value }}
                    />
                    <Input
                      value={field.value}
                      onChange={(e) => form.setValue("color", e.target.value)}
                      className="w-28 font-mono text-sm"
                      placeholder="#000000"
                    />
                  </div>
                  <FormMessage />
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
                    <Textarea
                      placeholder="Brief description of this status..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status Flags */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="isInitial"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Initial Status</FormLabel>
                      <FormDescription>
                        New work items will start in this status
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isFinal"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Final Status</FormLabel>
                      <FormDescription>
                        Mark this as a completion status
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "Saving..."
                  : isEditing
                  ? "Save Changes"
                  : "Create Status"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};