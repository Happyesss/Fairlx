import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/rpc";
import { QUERY_CONFIG } from "@/lib/query-config";
import { useTourActive, DUMMY_WORKSPACES } from "@/lib/tour-dummy-data";

export const useGetWorkspaces = () => {
  const isTourActive = useTourActive();

  const query = useQuery({
    queryKey: ["workspaces", isTourActive],
    staleTime: QUERY_CONFIG.STATIC.staleTime,
    gcTime: QUERY_CONFIG.STATIC.gcTime,
    queryFn: async () => {
      const response = await client.api.workspaces.$get();

      if (!response.ok) {
        // If server fails but tour is active, at least show dummy data
        if (isTourActive) return DUMMY_WORKSPACES;
        throw new Error("Failed to fetch workspaces.");
      }

      const { data } = await response.json();

      if (isTourActive) {
        console.log("[Tour] Merging dummy workspaces");
        return {
          ...data,
          documents: [...data.documents, ...DUMMY_WORKSPACES.documents],
          total: data.total + DUMMY_WORKSPACES.total,
        };
      }

      return data;
    },
  });

  return query;
};
