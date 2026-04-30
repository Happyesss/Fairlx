import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useTourActive, DUMMY_PROJECTS } from "@/lib/tour-dummy-data";

import { client } from "@/lib/rpc";
import { QUERY_CONFIG } from "@/lib/query-config";

interface UseGetMySpaceProjectsProps {
    enabled?: boolean;
}

/**
 * Fetches ALL projects across ALL workspaces the current user belongs to.
 */
export const useGetMySpaceProjects = ({
    enabled = true,
}: UseGetMySpaceProjectsProps = {}) => {
    const isTourActive = useTourActive();

    const query = useQuery({
        queryKey: ["my-space-projects", isTourActive],
        enabled,
        staleTime: QUERY_CONFIG.STATIC.staleTime,
        gcTime: QUERY_CONFIG.STATIC.gcTime,
        placeholderData: keepPreviousData,
        queryFn: async () => {
            // DUMMY DATA FOR TOUR
            if (isTourActive) {
                console.log("[Tour] Returning dummy my-space projects");
                return DUMMY_PROJECTS;
            }

            const response = await client.api["my-space"]["projects"].$get();

            if (!response.ok) {
                if (isTourActive) return DUMMY_PROJECTS;
                throw new Error("Failed to fetch my space projects.");
            }

            const { data } = await response.json();

            return data;
        },
    });

    return query;
};
