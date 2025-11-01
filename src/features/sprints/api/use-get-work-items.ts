import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

import { WorkItemType, WorkItemStatus, WorkItemPriority } from "../types";

interface UseGetWorkItemsProps {
  workspaceId: string;
  projectId?: string;
  sprintId?: string | null;
  type?: WorkItemType;
  status?: WorkItemStatus;
  priority?: WorkItemPriority;
  assigneeId?: string;
  epicId?: string | null;
  parentId?: string | null;
  flagged?: boolean;
  search?: string;
  includeChildren?: boolean;
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
  includeChildren,
}: UseGetWorkItemsProps) => {
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
      includeChildren,
    ],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
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
          includeChildren: includeChildren?.toString(),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch work items.");
      }

      const { data } = await response.json();

      return data;
    },
  });

  return query;
};
