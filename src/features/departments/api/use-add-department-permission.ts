"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client } from "@/lib/rpc";

interface AddPermissionRequest {
    orgId: string;
    departmentId: string;
    permissionKey: string;
}

/**
 * Hook to add a permission to a department
 */
export const useAddDepartmentPermission = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<unknown, Error, AddPermissionRequest>({
        mutationFn: async ({ orgId, departmentId, permissionKey }) => {
            const response = await client.api.departments[":orgId"][":departmentId"]["permissions"].$post({
                param: { orgId, departmentId },
                json: { permissionKey },
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({})) as { error?: string };
                throw new Error(error.error || response.statusText || "Failed to add permission");
            }

            return await response.json();
        },
        onSuccess: (_, variables) => {
            toast.success("Permission added to department");
            queryClient.invalidateQueries({
                queryKey: ["department-permissions", variables.orgId, variables.departmentId]
            });
            // Also invalidate user-access since permissions changed
            queryClient.invalidateQueries({ queryKey: ["user-access"] });
        },
        onError: (error) => {
            toast.error(error.message || "Failed to add permission");
        },
    });

    return mutation;
};
