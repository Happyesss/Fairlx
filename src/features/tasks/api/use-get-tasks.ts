import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/rpc";
import { useTourActive, DUMMY_TASKS } from "@/lib/tour-dummy-data";

import { TaskStatus, TaskPriority } from "../types";

const sanitizeString = (value?: string | null) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

interface UseGetTasksProps {
  workspaceId: string;
  projectId?: string | null;
  status?: TaskStatus | string | null;
  assigneeId?: string | null;
  dueDate?: string | null;
  search?: string | null;
  priority?: TaskPriority | null;
  labels?: string[] | null;
  parentId?: string | null;
}

export const useGetTasks = ({
  workspaceId,
  projectId,
  status,
  assigneeId,
  dueDate,
  search,
  priority,
  labels,
  parentId,
}: UseGetTasksProps) => {
  const sanitizedWorkspaceId = sanitizeString(workspaceId);
  const sanitizedProjectId = sanitizeString(projectId ?? undefined);
  const sanitizedStatus = sanitizeString(status ?? undefined);
  const sanitizedAssigneeId = sanitizeString(assigneeId ?? undefined);
  const sanitizedDueDate = sanitizeString(dueDate ?? undefined);
  const sanitizedSearch = sanitizeString(search ?? undefined);
  const sanitizedPriority = sanitizeString(priority ?? undefined) as
    | TaskPriority
    | undefined;
  const sanitizedLabels = labels?.map((label) => label.trim()).filter(Boolean);
  const sanitizedParentId = sanitizeString(parentId ?? undefined);

  const isTourActive = useTourActive();

  const query = useQuery({
    queryKey: [
      "tasks",
      sanitizedWorkspaceId,
      projectId,
      search,
      assigneeId,
      dueDate,
      status,
      sanitizedPriority,
      sanitizedLabels,
      sanitizedParentId,
      isTourActive,
    ],
    enabled: Boolean(sanitizedWorkspaceId),
    queryFn: async () => {
      // DUMMY DATA FOR TOUR - RETURN IMMEDIATELY
      if (isTourActive) {
        console.log("[Tour] Returning dummy tasks");
        return DUMMY_TASKS;
      }

      if (!sanitizedWorkspaceId) {
        throw new Error("workspaceId is required to fetch tasks.");
      }

      const response = await client.api.tasks.$get({
        query: {
          workspaceId: sanitizedWorkspaceId,
          projectId: sanitizedProjectId,
          status: sanitizedStatus,
          assigneeId: sanitizedAssigneeId,
          dueDate: sanitizedDueDate,
          search: sanitizedSearch,
          priority: sanitizedPriority,
          labels: sanitizedLabels?.length
            ? sanitizedLabels.join(",")
            : undefined,
          parentId: sanitizedParentId,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch tasks.");
      }

      const { data } = await response.json();

      return data;
    },
  });

  return query;
};
