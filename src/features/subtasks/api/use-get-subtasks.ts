import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

interface UseGetSubtasksProps {
  workspaceId: string;
  parentTaskId: string;
}

export const useGetSubtasks = ({ workspaceId, parentTaskId }: UseGetSubtasksProps) => {
  const query = useQuery({
    queryKey: ["subtasks", workspaceId, parentTaskId],
    queryFn: async () => {
      const response = await client.api.subtasks.$get({
        query: { workspaceId, workItemId: parentTaskId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch subtasks");
      }

      const { data } = await response.json();
      return data;
    },
  });

  return query;
};
