import { useQuery } from "@tanstack/react-query";
import { useTourActive, DUMMY_PROJECT_DETAIL } from "@/lib/tour-dummy-data";

import { client } from "@/lib/rpc";

interface UseGetProjectProps {
  projectId?: string | null;
  enabled?: boolean;
}

export const useGetProject = ({
  projectId,
  enabled = true,
}: UseGetProjectProps) => {
  const sanitizedProjectId = projectId?.trim() ? projectId.trim() : undefined;

  const isTourActive = useTourActive();

  const query = useQuery({
    queryKey: ["project", sanitizedProjectId, isTourActive],
    enabled: enabled && Boolean(sanitizedProjectId),
    queryFn: async () => {
      // DUMMY DATA FOR TOUR - RETURN IMMEDIATELY FOR p1
      if (isTourActive && sanitizedProjectId === "p1") {
        console.log("[Tour] Returning dummy project p1");
        return DUMMY_PROJECT_DETAIL;
      }

      if (!sanitizedProjectId) {
        throw new Error("Project ID is required to fetch the project.");
      }

      const response = await client.api.projects[":projectId"].$get({
        param: { projectId: sanitizedProjectId },
      });

      if (!response.ok) {
        if (isTourActive && sanitizedProjectId === "p1") return DUMMY_PROJECT_DETAIL;
        throw new Error("Failed to fetch the project.");
      }

      const { data } = await response.json();

      return data;
    },
  });

  return query;
};
