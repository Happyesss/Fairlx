import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTourActive, DUMMY_ACTIVITY_LOGS } from "@/lib/tour-dummy-data";
import { client } from "@/lib/rpc";

interface useGetProjectActivityLogsProps {
  workspaceId: string;
  projectId: string;
  limit?: number;
  enabled?: boolean;
}

export const useGetProjectActivityLogs = ({
  workspaceId,
  projectId,
  limit = 10,
}: useGetProjectActivityLogsProps) => {
  const isTourActive = useTourActive();

  const query = useInfiniteQuery({
    queryKey: ["activity-logs", workspaceId, projectId, isTourActive],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      // DUMMY DATA FOR TOUR
      if (isTourActive) {
        return DUMMY_ACTIVITY_LOGS;
      }

      const response = await client.api["audit-logs"]["$get"]({
        query: {
          workspaceId,
          projectId,
          limit: limit.toString(),
          cursor: pageParam,
        },
      });

      if (!response.ok) {
        if (isTourActive) return DUMMY_ACTIVITY_LOGS;
        throw new Error("Failed to fetch activity logs");
      }

      const data = await response.json();
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.nextCursor : undefined;
    },
    staleTime: 1000 * 60, // 1 minute
  });

  return query;
};

// Hook for getting recent activity logs (for widget)
export const useGetRecentProjectActivityLogs = ({
  workspaceId,
  projectId,
  limit = 5,
  enabled,
}: useGetProjectActivityLogsProps) => {
  const isTourActive = useTourActive();

  const query = useQuery({
    queryKey: ["activity-logs", "recent", workspaceId, projectId, limit, isTourActive],
    queryFn: async () => {
      // DUMMY DATA FOR TOUR
      if (isTourActive) {
        console.log("[Tour] Returning dummy project activity logs");
        return DUMMY_ACTIVITY_LOGS;
      }

      const response = await client.api["audit-logs"]["$get"]({
        query: {
          workspaceId,
          projectId,
          limit: limit.toString(),
        },
      });

      if (!response.ok) {
        if (isTourActive) return DUMMY_ACTIVITY_LOGS;
        throw new Error("Failed to fetch activity logs");
      }

      const data = await response.json();
      return data;
    },
    enabled,
    staleTime: 1000 * 30, // 30 seconds for widget
  });

  return query;
};
