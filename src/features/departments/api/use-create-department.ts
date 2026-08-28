import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { client } from "@/lib/rpc";
import { toast } from "sonner";

type ResponseType = InferResponseType<typeof client.api.departments[":orgId"]["$post"], 201>;
type RequestType = InferRequestType<typeof client.api.departments[":orgId"]["$post"]>;

interface UseCreateDepartmentProps {
    orgId: string;
}

export const useCreateDepartment = ({ orgId }: UseCreateDepartmentProps) => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, RequestType["json"]>({
        mutationFn: async (json) => {
            const response = await client.api.departments[":orgId"].$post({
                param: { orgId },
                json,
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({})) as { error?: string };
                throw new Error(error.error || response.statusText || "Failed to create department");
            }

            return await response.json();
        },
        onSuccess: () => {
            toast.success("Department created");
            queryClient.invalidateQueries({ queryKey: ["departments", orgId] });
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });

    return mutation;
};
