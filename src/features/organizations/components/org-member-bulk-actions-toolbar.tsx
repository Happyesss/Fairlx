"use client";

import { useState } from "react";
import { X, Trash2, UserCog, Eye, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { OrganizationRole } from "../types";
import { OrgMember } from "../api/use-get-org-members";

interface OrgMemberBulkActionsToolbarProps {
    selectedMembers: OrgMember[];
    onClearSelection: () => void;
    onBulkRoleChange: (role: OrganizationRole) => void;
    onBulkDelete: () => void;
    onViewProfiles: () => void;
    isUpdating?: boolean;
    isDeleting?: boolean;
}

export const OrgMemberBulkActionsToolbar = ({
    selectedMembers,
    onClearSelection,
    onBulkRoleChange,
    onBulkDelete,
    onViewProfiles,
    isUpdating,
    isDeleting,
}: OrgMemberBulkActionsToolbarProps) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const selectedCount = selectedMembers.length;

    if (selectedCount === 0) return null;

    // Check if any selected members are owners
    const hasOwners = selectedMembers.some((m) => m.role === "OWNER");

    return (
        <>
            <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
                <div className="bg-card border border-border rounded-lg shadow-lg p-3 flex items-center gap-3 min-w-[480px]">
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                            {selectedCount} selected
                        </Badge>
                    </div>

                    <div className="flex items-center gap-2 border-l pl-3">
                        {/* View Profiles */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onViewProfiles}
                            className="gap-1.5 h-8"
                        >
                            <Eye className="size-3.5" />
                            View
                        </Button>

                        {/* Bulk Role Change */}
                        <Select
                            onValueChange={(value) => onBulkRoleChange(value as OrganizationRole)}
                            disabled={isUpdating}
                        >
                            <SelectTrigger className="w-[130px] h-8 text-xs">
                                {isUpdating ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                    <UserCog className="size-3.5 mr-1.5" />
                                )}
                                <SelectValue placeholder="Change Role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="OWNER">Owner</SelectItem>
                                <SelectItem value="ADMIN">Admin</SelectItem>
                                <SelectItem value="MODERATOR">Moderator</SelectItem>
                                <SelectItem value="MEMBER">Member</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Bulk Delete */}
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={isDeleting || hasOwners}
                            className="gap-1.5 h-8"
                            title={hasOwners ? "Cannot delete owners. Change their role first." : undefined}
                        >
                            {isDeleting ? (
                                <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                                <Trash2 className="size-3.5" />
                            )}
                            Delete
                        </Button>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClearSelection}
                        className="ml-auto size-8"
                    >
                        <X className="size-4" />
                    </Button>
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove selected members?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove {selectedCount} member{selectedCount > 1 ? "s" : ""} from the organization.
                            They will lose access to all organization resources.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                onBulkDelete();
                                setShowDeleteConfirm(false);
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Remove {selectedCount} Member{selectedCount > 1 ? "s" : ""}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
