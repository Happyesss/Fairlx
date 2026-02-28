"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OrganizationRole } from "../types";

interface BulkUpdateMemberRolesData {
    organizationId: string;
    userIds: string[];
    role: OrganizationRole;
}

interface BulkUpdateResult {
    updated: string[];
    failed: string[];
    skipped: string[];
}

/**
 * Hook for bulk updating roles of multiple organization members
 * ADMIN or OWNER can update roles
 */
export const useBulkUpdateMemberRoles = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ organizationId, userIds, role }: BulkUpdateMemberRolesData) => {
            const response = await fetch(
                `/api/organizations/${organizationId}/members/bulk-update-role`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userIds, role }),
                    credentials: "include",
                }
            );

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || "Failed to update member roles");
            }

            const data = await response.json();
            return data.data as BulkUpdateResult;
        },
        onSuccess: (result, variables) => {
            const { updated, skipped } = result;
            if (updated.length > 0) {
                toast.success(`Updated ${updated.length} member${updated.length > 1 ? "s" : ""} to ${variables.role}`);
            }
            if (skipped.length > 0) {
                toast.info(`${skipped.length} member${skipped.length > 1 ? "s" : ""} already had this role`);
            }
            queryClient.invalidateQueries({ queryKey: ["org-members", variables.organizationId] });
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to update member roles");
        },
    });
};
