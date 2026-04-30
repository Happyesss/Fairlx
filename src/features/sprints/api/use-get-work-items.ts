import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useTourActive, DUMMY_WORK_ITEMS } from "@/lib/tour-dummy-data";

import { client } from "@/lib/rpc";
import { QUERY_CONFIG } from "@/lib/query-config";

import { WorkItemType, WorkItemPriority } from "../types";

interface UseGetWorkItemsProps {
  workspaceId: string;
  projectId?: string;
  sprintId?: string | null;
  type?: WorkItemType;
  status?: string; // Changed to string to support custom column IDs
  priority?: WorkItemPriority;
  assigneeId?: string;
  epicId?: string | null;
  parentId?: string | null;
  flagged?: boolean;
  search?: string;
  labels?: string[] | null;
  includeChildren?: boolean;
  limit?: number;
  enabled?: boolean;
}

export const useGetWorkItems = ({
  workspaceId,
  projectId,
  sprintId,
  type,
  status,
  priority,
  assigneeId,
  epicId,
  parentId,
  flagged,
  search,
  labels,
  includeChildren,
  limit,
  enabled = true,
}: UseGetWorkItemsProps) => {
  const isTourActive = useTourActive();

  const query = useQuery({
    queryKey: [
      "work-items",
      workspaceId,
      projectId,
      sprintId,
      type,
      status,
      priority,
      assigneeId,
      epicId,
      parentId,
      flagged,
      search,
      labels,
      includeChildren,
      limit,
      isTourActive,
    ],
    enabled: Boolean(workspaceId) && enabled,
    staleTime: QUERY_CONFIG.DYNAMIC.staleTime,
    gcTime: QUERY_CONFIG.DYNAMIC.gcTime,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      // DUMMY DATA FOR TOUR
      if (isTourActive) {
        console.log("[Tour] Returning dummy work items");
        return DUMMY_WORK_ITEMS;
      }

      if (!workspaceId) {
        throw new Error("workspaceId is required to fetch work items.");
      }

      const response = await client.api["work-items"].$get({
        query: {
          workspaceId,
          projectId,
          sprintId: sprintId === null ? "null" : sprintId,
          type,
          status,
          priority,
          assigneeId,
          epicId: epicId === null ? "null" : epicId,
          parentId: parentId === null ? "null" : parentId,
          flagged: flagged?.toString(),
          search,
          labels: labels?.length ? labels.join(",") : undefined,
          includeChildren: includeChildren?.toString(),
          limit: limit?.toString(),
        },
      });

      if (!response.ok) {
        if (isTourActive) return DUMMY_WORK_ITEMS;
        throw new Error("Failed to fetch work items.");
      }

      const { data } = await response.json();

      return data;
    },
  });

  return query;
};
