import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api["project-teams"]["$post"], 201>;
type RequestType = InferRequestType<typeof client.api["project-teams"]["$post"]>["json"];

export const useCreateProjectTeam = () => {
    const queryClient = useQueryClient();

    return useMutation<ResponseType, Error, RequestType>({
        mutationFn: async (json) => {
            const response = await client.api["project-teams"].$post({ json });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: "Failed to create team" }));
                throw new Error((error as { error: string }).error || "Failed to create team");
            }

            return await response.json();
        },
        onSuccess: (_, variables) => {
            toast.success("Team created successfully");
            queryClient.invalidateQueries({ queryKey: ["project-teams", variables.projectId] });
        },
        onError: (error) => {
            toast.error(error.message || "Failed to create team");
        },
    });
};
