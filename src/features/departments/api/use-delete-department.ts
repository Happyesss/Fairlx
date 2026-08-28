import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferResponseType } from "hono";
import { client } from "@/lib/rpc";
import { toast } from "sonner";

type ResponseType = InferResponseType<typeof client.api.departments[":orgId"][":departmentId"]["$delete"], 200>;

interface UseDeleteDepartmentProps {
    orgId: string;
}

export const useDeleteDepartment = ({ orgId }: UseDeleteDepartmentProps) => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, { departmentId: string }>({
        mutationFn: async ({ departmentId }) => {
            const response = await client.api.departments[":orgId"][":departmentId"].$delete({
                param: { orgId, departmentId },
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({})) as { error?: string };
                throw new Error(error.error || response.statusText || "Failed to delete department");
            }

            return await response.json();
        },
        onSuccess: () => {
            toast.success("Department deleted");
            queryClient.invalidateQueries({ queryKey: ["departments", orgId] });
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });

    return mutation;
};
