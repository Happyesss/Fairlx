import { useQuery } from "@tanstack/react-query";
import { useTourActive, DUMMY_ACTIVITY_LOGS } from "@/lib/tour-dummy-data";
import { client } from "@/lib/rpc";

interface UseGetMySpaceActivityLogsProps {
    limit?: number;
    enabled?: boolean;
}

export const useGetMySpaceActivityLogs = ({
    limit = 10,
    enabled = true,
}: UseGetMySpaceActivityLogsProps = {}) => {
    const isTourActive = useTourActive();

    const query = useQuery({
        queryKey: ["my-space-activity-logs", limit, isTourActive],
        enabled,
        queryFn: async () => {
            // DUMMY DATA FOR TOUR
            if (isTourActive) {
                console.log("[Tour] Returning dummy my-space activity logs");
                return DUMMY_ACTIVITY_LOGS;
            }

            const response = await client.api["my-space"]["activity-logs"].$get({
                query: {
                    limit: limit.toString(),
                },
            });

            if (!response.ok) {
                if (isTourActive) return DUMMY_ACTIVITY_LOGS;
                throw new Error("Failed to fetch my space activity logs.");
            }

            const { data } = await response.json();

            return data;
        },
    });

    return query;
};
