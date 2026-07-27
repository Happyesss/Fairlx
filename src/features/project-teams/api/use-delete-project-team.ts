import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api["project-teams"][":teamId"]["$delete"]>;

interface UseDeleteProjectTeamProps {
    projectId: string;
}

export const useDeleteProjectTeam = ({ projectId }: UseDeleteProjectTeamProps) => {
    const queryClient = useQueryClient();

    return useMutation<ResponseType, Error, { teamId: string }>({
        mutationFn: async ({ teamId }) => {
            const response = await client.api["project-teams"][":teamId"].$delete({
                param: { teamId },
            });

            if (!response.ok) {
                throw new Error("Failed to delete team");
            }

            return await response.json();
        },
        onSuccess: () => {
            toast.success("Team deleted successfully");
            queryClient.invalidateQueries({ queryKey: ["project-teams", projectId] });
            queryClient.invalidateQueries({ queryKey: ["project-permissions"] });
        },
        onError: () => {
            toast.error("Failed to delete team");
        },
    });
};
