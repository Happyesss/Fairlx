import { useQuery } from "@tanstack/react-query";
import { useTourActive, DUMMY_SPRINTS } from "@/lib/tour-dummy-data";

import { client } from "@/lib/rpc";

interface UseGetMySpaceSprintsProps {
    enabled?: boolean;
}

export const useGetMySpaceSprints = ({
    enabled = true,
}: UseGetMySpaceSprintsProps = {}) => {
    const isTourActive = useTourActive();

    const query = useQuery({
        queryKey: ["my-space-sprints", isTourActive],
        enabled,
        queryFn: async () => {
            // DUMMY DATA FOR TOUR
            if (isTourActive) {
                console.log("[Tour] Returning dummy my-space sprints");
                return DUMMY_SPRINTS;
            }

            const response = await client.api["my-space"]["sprints"].$get();

            if (!response.ok) {
                if (isTourActive) return DUMMY_SPRINTS;
                throw new Error("Failed to fetch my space sprints.");
            }

            const { data } = await response.json();

            return data;
        },
    });

    return query;
};
