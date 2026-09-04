import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { PopulatedProjectMember } from "../types";

interface UseGetProjectMembersProps {
    projectId: string | null | undefined;
    teamId?: string | null;
    workspaceId?: string | null;
}

function asProjectMemberList(data: unknown): { documents: PopulatedProjectMember[]; total: number } {
    if (Array.isArray(data)) {
        return { documents: data as PopulatedProjectMember[], total: data.length };
    }
    if (data && typeof data === "object" && Array.isArray((data as { documents?: unknown }).documents)) {
        const documents = (data as { documents: PopulatedProjectMember[] }).documents;
        const total = Number((data as { total?: number }).total);
        return { documents, total: Number.isFinite(total) ? total : documents.length };
    }
    return { documents: [], total: 0 };
}

/**
 * Hook to fetch all members in a project (optionally filtered by team)
 */
export const useGetProjectMembers = ({
    projectId,
    teamId,
    workspaceId,
}: UseGetProjectMembersProps) => {
    return useQuery({
        queryKey: ["project-members", projectId, teamId, workspaceId],
        queryFn: async () => {
            if (!projectId) return null;

            const response = await client.api["project-members"].$get({
                query: {
                    projectId,
                    ...(teamId && { teamId }),
                    ...(workspaceId && { workspaceId }),
                },
            });

            if (!response.ok) {
                await response.json().catch(() => ({}));
                // If it's a 401/403, throw explicit error for retry logic
                if (response.status === 401 || response.status === 403) {
                    throw new Error(`Auth Error: ${response.status}`);
                }
                throw new Error("Failed to fetch project members");
            }

            const json = await response.json();
            return asProjectMemberList(json.data);
        },
        enabled: !!projectId && (workspaceId !== undefined ? !!workspaceId : true),
        retry: (failureCount, error) => {
            if (error.message.includes("Auth Error")) return false;
            if (error.message.includes("401") || error.message.includes("403")) return false;
            return failureCount < 3;
        },
    });
};
