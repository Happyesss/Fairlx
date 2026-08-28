"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { toast } from "sonner";

interface RemoveMemberRequest {
    orgId: string;
    departmentId: string;
    orgMemberId: string;
}

/**
 * Hook to remove a member from a department
 */
export const useRemoveDepartmentMember = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async ({ orgId, departmentId, orgMemberId }: RemoveMemberRequest) => {
            const response = await client.api.departments[":orgId"][":departmentId"]["members"][":orgMemberId"].$delete({
                param: { orgId, departmentId, orgMemberId },
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({})) as { error?: string };
                throw new Error(error.error || response.statusText || "Failed to remove member");
            }

            return await response.json();
        },
        onSuccess: (_, { orgId, departmentId }) => {
            toast.success("Member removed from department");
            queryClient.invalidateQueries({ queryKey: ["department-members", orgId, departmentId] });
            queryClient.invalidateQueries({ queryKey: ["departments", orgId] });
            // Also invalidate user access since it may have changed
            queryClient.invalidateQueries({ queryKey: ["user-access"] });
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });

    return mutation;
};
