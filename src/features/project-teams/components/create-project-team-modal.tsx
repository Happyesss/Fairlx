"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Users } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { useCreateProjectTeam } from "../api/use-create-project-team";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

const formSchema = z.object({
    name: z.string().min(1, "Team name is required").max(100, "Team name too long"),
    description: z.string().max(500).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color").optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateProjectTeamModalProps {
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const PRESET_COLORS = [
    "#4F46E5", // Indigo
    "#059669", // Emerald
    "#DC2626", // Red
    "#D97706", // Amber
    "#7C3AED", // Violet
    "#0891B2", // Cyan
    "#DB2777", // Pink
    "#65A30D", // Lime
];

export function CreateProjectTeamModal({
    projectId,
    open,
    onOpenChange,
}: CreateProjectTeamModalProps) {
    const workspaceId = useWorkspaceId();
    const { mutate: createTeam, isPending } = useCreateProjectTeam();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            description: "",
            color: PRESET_COLORS[0],
        },
    });

    const onSubmit = (values: FormValues) => {
        createTeam(
            {
                workspaceId,
                projectId,
                name: values.name,
                description: values.description,
                color: values.color,
            },
            {
                onSuccess: () => {
                    form.reset();
                    onOpenChange(false);
                },
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Create Project Team
                    </DialogTitle>
                    <DialogDescription>
                        Create a new team for this project. Teams can have any name you choose.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Team Name</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="e.g., Design Squad, DevOps, Sprint Alpha"
                                            {...field}
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
                                    <FormLabel>Description (optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="What does this team do?"
                                            className="resize-none"
                                            rows={3}
                                            {...field}
                                            disabled={isPending}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="color"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Team Color</FormLabel>
                                    <FormControl>
                                        <div className="flex gap-2 flex-wrap">
                                            {PRESET_COLORS.map((color) => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    onClick={() => field.onChange(color)}
                                                    className={`w-8 h-8 rounded-full border-2 transition-all ${field.value === color
                                                            ? "border-primary scale-110"
                                                            : "border-transparent"
                                                        }`}
                                                    style={{ backgroundColor: color }}
                                                    disabled={isPending}
                                                />
                                            ))}
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isPending}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Team
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
