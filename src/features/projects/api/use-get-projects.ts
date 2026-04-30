import { useQuery, keepPreviousData } from "@tanstack/react-query";

import { client } from "@/lib/rpc";
import { QUERY_CONFIG } from "@/lib/query-config";
import { useTourActive, DUMMY_PROJECTS } from "@/lib/tour-dummy-data";

interface UseGetProjectsProps {
  // Optional so we can safely use the hook in layouts / sidebars that may
  // render outside of a specific workspace context.
  workspaceId?: string;
}

export const useGetProjects = ({ workspaceId }: UseGetProjectsProps) => {
  const isTourActive = useTourActive();

  const query = useQuery({
    queryKey: ["projects", workspaceId, isTourActive],
    enabled: !!workspaceId, // prevent 400 (Bad Request) when workspaceId is missing
    staleTime: QUERY_CONFIG.STATIC.staleTime,
    gcTime: QUERY_CONFIG.STATIC.gcTime,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!workspaceId) return null; // Should never run when disabled, but defensive

      const response = await client.api.projects.$get({
        query: { workspaceId },
      });

      if (!response.ok) {
        // If server fails but tour is active, at least show dummy data
        if (isTourActive) return DUMMY_PROJECTS;
        throw new Error("Failed to fetch projects.");
      }

      const { data } = await response.json();

      if (isTourActive) {
        console.log("[Tour] Merging dummy projects");
        return {
          ...data,
          documents: [...data.documents, ...DUMMY_PROJECTS.documents],
          total: data.total + DUMMY_PROJECTS.total,
        };
      }

      return data;
    },
  });

  return query;
};
