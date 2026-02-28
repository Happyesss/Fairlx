import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";
import { PopulatedNotification } from "../types";

type ResponseType = InferResponseType<
  (typeof client.api.notifications)[":notificationId"]["read"]["$patch"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.notifications)[":notificationId"]["read"]["$patch"]
> & {
  workspaceId: string;
};

type NotificationsData = {
  documents: PopulatedNotification[];
  total: number;
};

type ContextType = {
  previousNotifications: Map<string, NotificationsData | undefined>;
  previousUnreadCount: { count: number } | undefined;
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType, ContextType>({
    mutationFn: async ({ param }) => {
      const response = await client.api.notifications[":notificationId"][
        "read"
      ].$patch({
        param,
      });

      if (!response.ok) {
        throw new Error("Failed to mark notification as read");
      }

      return await response.json();
    },
    onMutate: async ({ param, workspaceId }) => {
      // Cancel outgoing fetches
      await queryClient.cancelQueries({ queryKey: ["notifications"] });

      // Snapshot all notification queries for rollback
      const previousNotifications = new Map<string, NotificationsData | undefined>();
      const queries = queryClient.getQueriesData<NotificationsData>({
        queryKey: ["notifications", workspaceId],
      });
      queries.forEach(([key, data]) => {
        previousNotifications.set(JSON.stringify(key), data);
      });

      // Snapshot unread count
      const previousUnreadCount = queryClient.getQueryData<{ count: number }>([
        "notifications",
        "unread-count",
        workspaceId,
      ]);

      // Optimistically remove the notification (server deletes on mark-read)
      queryClient.setQueriesData<NotificationsData>(
        { queryKey: ["notifications", workspaceId] },
        (old) => {
          if (!old) return old;
          const filtered = old.documents.filter((n) => n.$id !== param.notificationId);
          return { documents: filtered, total: filtered.length };
        }
      );

      // Optimistically decrement unread count
      if (previousUnreadCount && previousUnreadCount.count > 0) {
        queryClient.setQueryData(
          ["notifications", "unread-count", workspaceId],
          { count: previousUnreadCount.count - 1 }
        );
      }

      return { previousNotifications, previousUnreadCount };
    },
    onError: (_err, { workspaceId }, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        context.previousNotifications.forEach((data, keyStr) => {
          const key = JSON.parse(keyStr);
          queryClient.setQueryData(key, data);
        });
      }
      if (context?.previousUnreadCount) {
        queryClient.setQueryData(
          ["notifications", "unread-count", workspaceId],
          context.previousUnreadCount
        );
      }
      toast.error("Failed to mark notification as read");
    },
    onSettled: (_data, _err, { workspaceId }) => {
      // Sync with server in background
      queryClient.invalidateQueries({ queryKey: ["notifications", workspaceId] });
    },
  });

  return mutation;
};
