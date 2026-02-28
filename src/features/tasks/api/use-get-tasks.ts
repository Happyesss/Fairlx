import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

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
  parentTaskId?: string | null;
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
  parentTaskId,
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
  const sanitizedParentTaskId = sanitizeString(parentTaskId ?? undefined);

  const query = useQuery({
    queryKey: [
      "tasks",
      sanitizedWorkspaceId,
      sanitizedProjectId,
      sanitizedStatus,
      sanitizedAssigneeId,
      sanitizedDueDate,
      sanitizedSearch,
      sanitizedPriority,
      sanitizedLabels,
      sanitizedParentTaskId,
    ],
    enabled: Boolean(sanitizedWorkspaceId),
    queryFn: async () => {
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
          parentTaskId: sanitizedParentTaskId,
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
