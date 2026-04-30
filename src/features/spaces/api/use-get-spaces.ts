import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/rpc";
import { QUERY_CONFIG } from "@/lib/query-config";
import { useTourActive, DUMMY_SPACES } from "@/lib/tour-dummy-data";

interface UseGetSpacesProps {
  workspaceId?: string;
}

export const useGetSpaces = ({ workspaceId }: UseGetSpacesProps) => {
  const isTourActive = useTourActive();

  const query = useQuery({
    queryKey: ["spaces", workspaceId, isTourActive],
    enabled: !!workspaceId,
    staleTime: QUERY_CONFIG.STATIC.staleTime,
    gcTime: QUERY_CONFIG.STATIC.gcTime,
    queryFn: async () => {
      if (!workspaceId) return null;

      const response = await client.api.spaces.$get({
        query: { workspaceId },
      });

      if (!response.ok) {
        // If server fails but tour is active, at least show dummy data
        if (isTourActive) return DUMMY_SPACES;
        throw new Error("Failed to fetch spaces.");
      }

      const { data } = await response.json();

      if (isTourActive) {
        console.log("[Tour] Merging dummy spaces");
        return {
          ...data,
          documents: [...data.documents, ...DUMMY_SPACES.documents],
          total: data.total + DUMMY_SPACES.total,
        };
      }

      return data;
    },
  });

  return query;
};
