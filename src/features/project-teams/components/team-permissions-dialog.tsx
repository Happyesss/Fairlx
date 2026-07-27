"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Shield } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ProjectPermissionKey } from "@/lib/permissions/types";

import { useGetProjectTeamPermissions } from "../api/use-get-project-team-permissions";
import { useUpdateProjectTeamPermissions } from "../api/use-update-project-team-permissions";

const PERMISSION_GROUPS = [
    {
        title: "Project",
        permissions: [
            { key: ProjectPermissionKey.VIEW_PROJECT, label: "View Project" },
            { key: ProjectPermissionKey.EDIT_SETTINGS, label: "Edit Settings" },
            { key: ProjectPermissionKey.DELETE_PROJECT, label: "Delete Project" },
        ],
    },
    {
        title: "Work Items",
        permissions: [
            { key: ProjectPermissionKey.VIEW_TASKS, label: "View Work Items" },
            { key: ProjectPermissionKey.CREATE_TASKS, label: "Create Work Items" },
            { key: ProjectPermissionKey.EDIT_TASKS, label: "Edit Work Items" },
            { key: ProjectPermissionKey.DELETE_TASKS, label: "Delete Work Items" },
        ],
    },
    {
        title: "Sprints",
        permissions: [
            { key: ProjectPermissionKey.VIEW_SPRINTS, label: "View Sprints" },
            { key: ProjectPermissionKey.CREATE_SPRINTS, label: "Create Sprints" },
            { key: ProjectPermissionKey.EDIT_SPRINTS, label: "Edit Sprints" },
            { key: ProjectPermissionKey.DELETE_SPRINTS, label: "Delete Sprints" },
            { key: ProjectPermissionKey.START_SPRINT, label: "Start Sprint" },
            { key: ProjectPermissionKey.COMPLETE_SPRINT, label: "Complete Sprint" },
        ],
    },
    {
        title: "Members & Teams",
        permissions: [
            { key: ProjectPermissionKey.VIEW_MEMBERS, label: "View Members" },
            { key: ProjectPermissionKey.MANAGE_MEMBERS, label: "Manage Members" },
            { key: ProjectPermissionKey.MANAGE_TEAMS, label: "Manage Teams" },
            { key: ProjectPermissionKey.MANAGE_PERMISSIONS, label: "Manage Permissions" },
        ],
    },
    {
        title: "Documents",
        permissions: [
            { key: ProjectPermissionKey.VIEW_DOCS, label: "View Documents" },
            { key: ProjectPermissionKey.CREATE_DOCS, label: "Create Documents" },
            { key: ProjectPermissionKey.EDIT_DOCS, label: "Edit Documents" },
            { key: ProjectPermissionKey.DELETE_DOCS, label: "Delete Documents" },
        ],
    },
];

interface TeamPermissionsDialogProps {
    teamId: string;
    teamName: string;
    teamColor?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function TeamPermissionsDialog({
    teamId,
    teamName,
    teamColor,
    open,
    onOpenChange,
}: TeamPermissionsDialogProps) {
    const [permissions, setPermissions] = useState<string[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [initialPermissions, setInitialPermissions] = useState<string[]>([]);

    const { data: teamPermissions, isLoading } = useGetProjectTeamPermissions({ teamId });
    const { mutate: updatePermissions, isPending: isSaving } = useUpdateProjectTeamPermissions({ teamId });

    // Sync permissions when data loads
    useEffect(() => {
        if (teamPermissions && Array.isArray(teamPermissions)) {
            const permKeys = teamPermissions.map((p: { permissionKey?: string }) => p.permissionKey || p).filter(Boolean) as string[];
            setPermissions(permKeys);
            setInitialPermissions(permKeys);
            setHasChanges(false);
        }
    }, [teamPermissions]);

    const togglePermission = useCallback((key: string) => {
        setPermissions((prev) => {
            const newPerms = prev.includes(key)
                ? prev.filter((p) => p !== key)
                : [...prev, key];
            setHasChanges(JSON.stringify(newPerms.sort()) !== JSON.stringify(initialPermissions.sort()));
            return newPerms;
        });
    }, [initialPermissions]);

    const toggleGroup = useCallback((groupPermissions: { key: string }[]) => {
        const groupKeys = groupPermissions.map((p) => p.key);
        const allChecked = groupKeys.every((k) => permissions.includes(k));
        setPermissions((prev) => {
            let newPerms: string[];
            if (allChecked) {
                newPerms = prev.filter((p) => !groupKeys.includes(p));
            } else {
                newPerms = [...new Set([...prev, ...groupKeys])];
            }
            setHasChanges(JSON.stringify(newPerms.sort()) !== JSON.stringify(initialPermissions.sort()));
            return newPerms;
        });
    }, [permissions, initialPermissions]);

    const handleSave = () => {
        updatePermissions(
            { permissions },
            {
                onSuccess: () => {
                    setInitialPermissions(permissions);
                    setHasChanges(false);
                    onOpenChange(false);
                },
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] overflow-y-scroll max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div
                            className="w-8 h-8 rounded-md flex items-center justify-center"
                            style={{ backgroundColor: teamColor || "#4F46E5" }}
                        >
                            <Shield className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <DialogTitle>Manage Permissions</DialogTitle>
                            <DialogDescription>
                                Configure permissions for &quot;{teamName}&quot;
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <ScrollArea className="flex-1 overflow-y-scroll max-h-[55vh] pr-4">
                        <div className="space-y-5 ">
                            {PERMISSION_GROUPS.map((group) => {
                                const groupKeys = group.permissions.map((p) => p.key);
                                const allChecked = groupKeys.every((k) => permissions.includes(k));
                                const someChecked = groupKeys.some((k) => permissions.includes(k)) && !allChecked;

                                return (
                                    <div key={group.title}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Checkbox
                                                checked={allChecked ? true : someChecked ? "indeterminate" : false}
                                                onCheckedChange={() => toggleGroup(group.permissions)}
                                            />
                                            <Label className="text-sm font-semibold cursor-pointer" onClick={() => toggleGroup(group.permissions)}>
                                                {group.title}
                                            </Label>
                                        </div>
                                        <div className="ml-6 space-y-1.5">
                                            {group.permissions.map((perm) => (
                                                <div key={perm.key} className="flex items-center gap-2">
                                                    <Checkbox
                                                        id={perm.key}
                                                        checked={permissions.includes(perm.key)}
                                                        onCheckedChange={() => togglePermission(perm.key)}
                                                    />
                                                    <Label
                                                        htmlFor={perm.key}
                                                        className="text-sm text-muted-foreground cursor-pointer"
                                                    >
                                                        {perm.label}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                        <Separator className="mt-3" />
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Permissions
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
