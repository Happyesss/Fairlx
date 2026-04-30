import { useQuery } from "@tanstack/react-query";
import { InferResponseType } from "hono";
import { useTourActive, DUMMY_PROJECT_ANALYTICS } from "@/lib/tour-dummy-data";

import { client } from "@/lib/rpc";

interface UseGetProjectAnalyticsProps {
  projectId: string;
}

export type ProjectAnalyticsResponseType = InferResponseType<
  (typeof client.api.projects)[":projectId"]["analytics"]["$get"],
  200
>;

export const useGetProjectAnalytics = ({
  projectId,
}: UseGetProjectAnalyticsProps) => {
  const isTourActive = useTourActive();

  const query = useQuery({
    queryKey: ["project-analytics", projectId, isTourActive],
    queryFn: async () => {
      // DUMMY DATA FOR TOUR
      if (isTourActive) {
        console.log("[Tour] Returning dummy project analytics");
        return DUMMY_PROJECT_ANALYTICS;
      }

      const response = await client.api.projects[":projectId"][
        "analytics"
      ].$get({
        param: { projectId },
      });

      if (!response.ok) {
        if (isTourActive) return DUMMY_PROJECT_ANALYTICS;
        throw new Error("Failed to fetch the project analytics.");
      }

      const { data } = await response.json();

      return data;
    },
  });

  return query;
};
