"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface BulkRemoveMembersData {
    organizationId: string;
    userIds: string[];
}

interface BulkRemoveResult {
    deleted: string[];
    failed: string[];
    skipped: string[];
}

/**
 * Hook for bulk removing multiple members from an organization
 * ADMIN or OWNER can remove members
 */
export const useBulkRemoveMembers = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ organizationId, userIds }: BulkRemoveMembersData) => {
            const response = await fetch(
                `/api/organizations/${organizationId}/members/bulk-delete`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userIds }),
                    credentials: "include",
                }
            );

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || "Failed to remove members");
            }

            const data = await response.json();
            return data.data as BulkRemoveResult;
        },
        onSuccess: (result, variables) => {
            const { deleted, skipped } = result;
            if (deleted.length > 0) {
                toast.success(`Removed ${deleted.length} member${deleted.length > 1 ? "s" : ""} from organization`);
            }
            if (skipped.length > 0) {
                toast.info(`${skipped.length} member${skipped.length > 1 ? "s were" : " was"} protected and not removed`);
            }
            queryClient.invalidateQueries({ queryKey: ["org-members", variables.organizationId] });
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to remove members");
        },
    });
};
