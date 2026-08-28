import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { client } from "@/lib/rpc";
import { toast } from "sonner";

type ResponseType = InferResponseType<typeof client.api.departments[":orgId"][":departmentId"]["$patch"], 200>;
type RequestType = InferRequestType<typeof client.api.departments[":orgId"][":departmentId"]["$patch"]>;

interface UseUpdateDepartmentProps {
    orgId: string;
}

export const useUpdateDepartment = ({ orgId }: UseUpdateDepartmentProps) => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, { departmentId: string; json: RequestType["json"] }>({
        mutationFn: async ({ departmentId, json }) => {
            const response = await client.api.departments[":orgId"][":departmentId"].$patch({
                param: { orgId, departmentId },
                json,
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({})) as { error?: string };
                throw new Error(error.error || response.statusText || "Failed to update department");
            }

            return await response.json();
        },
        onSuccess: () => {
            toast.success("Department updated");
            queryClient.invalidateQueries({ queryKey: ["departments", orgId] });
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });

    return mutation;
};
