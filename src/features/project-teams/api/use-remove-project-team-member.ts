import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

interface UseRemoveProjectTeamMemberProps {
    projectId: string;
}

export const useRemoveProjectTeamMember = ({ projectId }: UseRemoveProjectTeamMemberProps) => {
    const queryClient = useQueryClient();

    return useMutation<{ success: boolean }, Error, { teamId: string; userId: string }>({
        mutationFn: async ({ teamId, userId }) => {
            const response = await client.api["project-teams"][":teamId"]["members"][":userId"].$delete({
                param: { teamId, userId },
            });

            if (!response.ok) {
                throw new Error("Failed to remove member");
            }

            return await response.json();
        },
        onSuccess: (_, variables) => {
            toast.success("Member removed from team");
            queryClient.invalidateQueries({ queryKey: ["project-teams", projectId] });
            queryClient.invalidateQueries({ queryKey: ["project-team-members", variables.teamId] });
            // Drop team add-on permissions from the UI immediately
            queryClient.invalidateQueries({ queryKey: ["project-permissions"] });
        },
        onError: () => {
            toast.error("Failed to remove member");
        },
    });
};
