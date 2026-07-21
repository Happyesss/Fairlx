"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { toast } from "sonner";

interface AddMemberRequest {
    orgId: string;
    departmentId: string;
    orgMemberId: string;
}

/**
 * Hook to add a member to a department
 */
export const useAddDepartmentMember = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async ({ orgId, departmentId, orgMemberId }: AddMemberRequest) => {
            const response = await client.api.departments[":orgId"][":departmentId"]["members"].$post({
                param: { orgId, departmentId },
                json: { orgMemberId },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error((error as { error?: string }).error || "Failed to add member");
            }

            return await response.json();
        },
        onSuccess: (_, { orgId, departmentId }) => {
            toast.success("Member added to department");
            queryClient.invalidateQueries({ queryKey: ["department-members", orgId, departmentId] });
            queryClient.invalidateQueries({ queryKey: ["departments", orgId] });
            queryClient.invalidateQueries({ queryKey: ["user-access"] });
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });

    return mutation;
};
