import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api["project-teams"][":teamId"]["members"]["$post"], 201>;

interface UseAddProjectTeamMemberProps {
    projectId: string;
}

export const useAddProjectTeamMember = ({ projectId }: UseAddProjectTeamMemberProps) => {
    const queryClient = useQueryClient();

    return useMutation<ResponseType, Error, { teamId: string; projectId: string; userId: string; teamRole?: string }>({
        mutationFn: async ({ teamId, projectId: _projectId, userId, teamRole }) => {
            const response = await client.api["project-teams"][":teamId"]["members"].$post({
                param: { teamId },
                json: { projectId: _projectId, teamId, userId, teamRole },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error((error as { error: string }).error || "Failed to add member");
            }

            return await response.json();
        },
        onSuccess: (_, variables) => {
            toast.success("Member added to team");
            queryClient.invalidateQueries({ queryKey: ["project-teams", projectId] });
            queryClient.invalidateQueries({ queryKey: ["project-team-members", variables.teamId] });
            // Role + team add-on merge must refresh for the affected user
            queryClient.invalidateQueries({ queryKey: ["project-permissions"] });
        },
        onError: (error) => {
            toast.error(error.message || "Failed to add member");
        },
    });
};
