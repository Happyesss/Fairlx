import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/rpc";
import { PopulatedComment } from "../types";

interface UseGetCommentsProps {
  taskId: string;
  workspaceId: string;
}

export const useGetComments = ({ taskId, workspaceId }: UseGetCommentsProps) => {
  const query = useQuery({
    queryKey: ["comments", taskId, workspaceId],
    queryFn: async () => {
      const response = await client.api.comments["$get"]({
        query: { taskId, workspaceId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch comments");
      }

      const { data } = (await response.json()) as { data: PopulatedComment[] };
      return data;
    },
    enabled: !!taskId && !!workspaceId,
    refetchInterval: 30000, // Refetch every 30 seconds for near-real-time updates
  });

  return query;
};
