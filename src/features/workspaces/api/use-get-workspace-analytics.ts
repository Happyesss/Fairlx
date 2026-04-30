import { useQuery } from "@tanstack/react-query";
import { InferResponseType } from "hono";

import { client } from "@/lib/rpc";
import { useTourActive, DUMMY_ANALYTICS } from "@/lib/tour-dummy-data";

interface UseGetWorkspaceAnalyticsProps {
  workspaceId: string;
}

export type WorkspaceAnalyticsResponseType = InferResponseType<
  (typeof client.api.workspaces)[":workspaceId"]["analytics"]["$get"],
  200
>;

export const useGetWorkspaceAnalytics = ({
  workspaceId,
}: UseGetWorkspaceAnalyticsProps) => {
  const isTourActive = useTourActive();

  const query = useQuery({
    queryKey: ["workspace-analytics", workspaceId, isTourActive],
    queryFn: async () => {
      // DUMMY DATA FOR TOUR - RETURN IMMEDIATELY
      if (isTourActive) {
        console.log("[Tour] Returning dummy analytics");
        return DUMMY_ANALYTICS;
      }

      const response = await client.api.workspaces[":workspaceId"][
        "analytics"
      ].$get({
        param: { workspaceId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch the workspace analytics.");
      }

      const { data } = await response.json();

      return data;
    },
  });

  return query;
};
