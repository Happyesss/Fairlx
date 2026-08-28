"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client } from "@/lib/rpc";

interface RemovePermissionRequest {
    orgId: string;
    departmentId: string;
    permissionKey: string;
}

/**
 * Hook to remove a permission from a department
 */
export const useRemoveDepartmentPermission = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<unknown, Error, RemovePermissionRequest>({
        mutationFn: async ({ orgId, departmentId, permissionKey }) => {
            const response = await client.api.departments[":orgId"][":departmentId"]["permissions"][":permKey"].$delete({
                param: { orgId, departmentId, permKey: permissionKey },
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({})) as { error?: string };
                throw new Error(error.error || response.statusText || "Failed to remove permission");
            }

            return await response.json();
        },
        onSuccess: (_, variables) => {
            toast.success("Permission removed from department");
            queryClient.invalidateQueries({
                queryKey: ["department-permissions", variables.orgId, variables.departmentId]
            });
            // Also invalidate user-access since permissions changed
            queryClient.invalidateQueries({ queryKey: ["user-access"] });
        },
        onError: (error) => {
            toast.error(error.message || "Failed to remove permission");
        },
    });

    return mutation;
};
