import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useTourActive, DUMMY_SPRINTS } from "@/lib/tour-dummy-data";

import { client } from "@/lib/rpc";

import { SprintStatus } from "../types";

interface UseGetSprintsProps {
  workspaceId: string;
  projectId?: string;
  status?: SprintStatus;
  enabled?: boolean;
}

export const useGetSprints = ({
  workspaceId,
  projectId,
  status,
  enabled = true,
}: UseGetSprintsProps) => {
  const isTourActive = useTourActive();

  const query = useQuery({
    queryKey: ["sprints", workspaceId, projectId, status, isTourActive],
    enabled: Boolean(workspaceId) && enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      // DUMMY DATA FOR TOUR
      if (isTourActive) {
        console.log("[Tour] Returning dummy sprints");
        return DUMMY_SPRINTS;
      }

      if (!workspaceId) {
        throw new Error("workspaceId is required to fetch sprints.");
      }

      const response = await client.api.sprints.$get({
        query: {
          workspaceId,
          projectId,
          status,
        },
      });

      if (!response.ok) {
        if (isTourActive) return DUMMY_SPRINTS;
        throw new Error("Failed to fetch sprints.");
      }

      const { data } = await response.json();

      return data;
    },
  });

  return query;
};
