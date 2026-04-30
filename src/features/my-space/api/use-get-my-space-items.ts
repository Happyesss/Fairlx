import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useTourActive, DUMMY_WORK_ITEMS } from "@/lib/tour-dummy-data";

import { client } from "@/lib/rpc";
import { QUERY_CONFIG } from "@/lib/query-config";

interface UseGetMySpaceItemsProps {
    enabled?: boolean;
}

/**
 * Fetches ALL work items assigned to the current user across ALL workspaces.
 */
export const useGetMySpaceItems = ({
    enabled = true,
}: UseGetMySpaceItemsProps = {}) => {
    const isTourActive = useTourActive();

    const query = useQuery({
        queryKey: ["my-space-work-items", isTourActive],
        enabled,
        staleTime: QUERY_CONFIG.DYNAMIC.staleTime,
        gcTime: QUERY_CONFIG.DYNAMIC.gcTime,
        placeholderData: keepPreviousData,
        queryFn: async () => {
            // DUMMY DATA FOR TOUR
            if (isTourActive) {
                console.log("[Tour] Returning dummy my-space items");
                return DUMMY_WORK_ITEMS;
            }

            const response = await client.api["my-space"]["work-items"].$get();

            if (!response.ok) {
                if (isTourActive) return DUMMY_WORK_ITEMS;
                throw new Error("Failed to fetch my space work items.");
            }

            const { data } = await response.json();

            return data;
        },
    });

    return query;
};
