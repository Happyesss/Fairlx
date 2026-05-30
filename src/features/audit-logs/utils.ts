import { Query } from "node-appwrite";
import { createAdminClient } from "@/lib/appwrite";
import {
  DATABASE_ID,
  TASKS_ID,
  PROJECTS_ID,
  WORKSPACES_ID,
  MEMBERS_ID,
  SPRINTS_ID,
  WORK_ITEMS_ID,
  TIME_LOGS_ID,
  ATTACHMENTS_ID,
  CUSTOM_COLUMNS_ID,
  PERSONAL_BACKLOG_ID,
  NOTIFICATIONS_ID,
} from "@/config";
import { ActivityType, ActivityLog } from "./types";

/**
 * Aggregates activity logs from all existing collections
 * Leverages Appwrite's $createdAt and $updatedAt fields
 * OPTIMIZED: Single batch request with parallel fetching
 * Supports cursor-based pagination for infinite loading
 */
export async function getActivityLogs({
  workspaceId,
  projectId,
  userId,
  type,
  action,
  startDate,
  endDate,
  limit = 50,
  cursor,
}: {
  workspaceId: string;
  projectId?: string;
  userId?: string;
  type?: ActivityType;
  action?: "created" | "updated" | "deleted";
  startDate?: string;
  endDate?: string;
  limit?: number;
  cursor?: string; // Format: "timestamp:documentId" for cursor-based pagination
}): Promise<{ activities: ActivityLog[]; nextCursor?: string; hasMore: boolean }> {
  const { databases } = await createAdminClient();

  // Build base queries
  const baseQueries = [Query.equal("workspaceId", workspaceId)];

  if (projectId) {
    baseQueries.push(Query.equal("projectId", projectId));
  }

  if (userId) {
    baseQueries.push(Query.equal("userId", userId));
  }

  if (startDate) {
    baseQueries.push(Query.greaterThanEqual("$createdAt", startDate));
  }
  if (endDate) {
    baseQueries.push(Query.lessThanEqual("$createdAt", endDate));
  }

  try {
    // Determine which collections to fetch
    const collectionsToFetch = type
      ? [{ type, collectionId: getCollectionId(type) }]
      : [
        { type: ActivityType.TASK, collectionId: TASKS_ID },
        { type: ActivityType.PROJECT, collectionId: PROJECTS_ID },
        { type: ActivityType.TIME_LOG, collectionId: TIME_LOGS_ID },
        { type: ActivityType.SPRINT, collectionId: SPRINTS_ID },
        { type: ActivityType.WORK_ITEM, collectionId: WORK_ITEMS_ID },
      ];

    // **PARALLEL FETCH**: All collections fetched at once in a single batch
    const results = await Promise.allSettled(
      collectionsToFetch.map(({ type: activityType, collectionId }) =>
        databases
          .listDocuments(DATABASE_ID, collectionId, [
            ...baseQueries,
            Query.orderDesc("$createdAt"),
            Query.limit(Math.min(limit, 20)),
          ])
          .then((docs) => ({ activityType, docs }))
      )
    );

    // Transform all results into activity logs
    const allActivities: ActivityLog[] = [];

    // Collect all unique user IDs to fetch in batch
    const userIds = new Set<string>();
    const tempActivities: Array<{
      doc: Record<string, unknown>;
      activityType: ActivityType;
      activityAction: string;
    }> = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { activityType, docs } = result.value;

        for (const doc of docs.documents) {
          const isCreated = !doc.$updatedAt || doc.$createdAt === doc.$updatedAt;
          const activityAction = isCreated ? "created" : "updated";

          // Filter by action if specified
          if (action && action !== activityAction) continue;

          // Collect user ID for batch fetch based on collection type
          const userId = getUserIdFromDocument(doc, activityType);
          if (userId) {
            userIds.add(userId);
          }

          tempActivities.push({ doc, activityType, activityAction });
        }
      }
    }

    // **BATCH FETCH WORKSPACE MEMBERS**: Get all members for this workspace
    // This will help us resolve users even when documents don't have direct user fields
    const membersResult = await databases.listDocuments(DATABASE_ID, MEMBERS_ID, [
      Query.equal("workspaceId", workspaceId),
      Query.limit(100),
    ]);

    // Collect user IDs from members
    for (const member of membersResult.documents) {
      if (member.userId) {
        userIds.add(member.userId);
      }
    }

    // **BATCH FETCH USERS**: Get all users at once
    const { users } = await createAdminClient();
    const userMap = new Map<string, { name: string; email: string; imageUrl?: string }>();

    const userFetchResults = await Promise.allSettled(
      Array.from(userIds).map(async (userId) => {
        try {
          const user = await users.get(userId);
          return { userId, user };
        } catch {
          return { userId, user: null };
        }
      })
    );

    // Build user map
    for (const result of userFetchResults) {
      if (result.status === "fulfilled" && result.value.user) {
        const { userId, user } = result.value;
        userMap.set(userId, {
          name: user.name || user.email || "Unknown User",
          email: user.email || "",
          imageUrl: user.prefs?.profileImageUrl as string | undefined,
        });
      }
    }

    // Now create activity logs with resolved user info
    for (const { doc, activityType, activityAction } of tempActivities) {
      const userId = getUserIdFromDocument(doc, activityType, activityAction);

      // No fallback to workspace members — that would attribute actions to the wrong person.
      // If we can't determine the user, show "Unknown User".

      const userInfo = userId ? userMap.get(userId) : null;

      const description = doc.description as string | undefined;

      allActivities.push({
        id: doc.$id as string,
        type: activityType,
        action: activityAction as "created" | "updated" | "deleted",
        timestamp: doc.$createdAt as string,
        userId: userId,
        userName: userInfo?.name || "Unknown User",
        userEmail: userInfo?.email || "",
        userImageUrl: userInfo?.imageUrl,
        workspaceId: doc.workspaceId as string | undefined,
        projectId: doc.projectId as string | undefined,
        entityId: doc.$id as string,
        entityName: (doc.name as string) || (doc.title as string) || description?.substring(0, 50),
        metadata: {
          status: doc.status as string | undefined,
          priority: doc.priority as string | undefined,
          assigneeId: doc.assigneeId as string | undefined,
        },
      });
    }

    // Sort all activities by timestamp descending
    const sortedActivities = allActivities.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply cursor-based pagination
    let startIndex = 0;
    if (cursor) {
      // Cursor format: "timestamp:documentId"
      const [cursorTimestamp, cursorId] = cursor.split(":");
      startIndex = sortedActivities.findIndex(
        (activity) => activity.timestamp === cursorTimestamp && activity.id === cursorId
      );
      if (startIndex !== -1) {
        startIndex += 1; // Start from the next item after cursor
      } else {
        startIndex = 0; // Invalid cursor, start from beginning
      }
    }

    // Get page of results
    const paginatedActivities = sortedActivities.slice(startIndex, startIndex + limit);

    // Determine if there are more results
    const hasMore = startIndex + limit < sortedActivities.length;

    // Generate next cursor from last item
    let nextCursor: string | undefined;
    if (hasMore && paginatedActivities.length > 0) {
      const lastActivity = paginatedActivities[paginatedActivities.length - 1];
      nextCursor = `${lastActivity.timestamp}:${lastActivity.id}`;
    }

    return {
      activities: paginatedActivities,
      nextCursor,
      hasMore,
    };
  } catch {
    return {
      activities: [],
      hasMore: false,
    };
  }
}

/**
 * Extracts user ID from document based on collection type
 */
function getUserIdFromDocument(
  doc: Record<string, unknown>,
  activityType: ActivityType,
  _action?: string
): string | undefined {
  // Check lastModifiedBy first — it's set on both task creates AND updates
  if (doc.lastModifiedBy) {
    return doc.lastModifiedBy as string;
  }

  switch (activityType) {
    case ActivityType.TASK:
      // lastModifiedBy already handled above for both creates and updates.
      // Return undefined — we don't want to fall back to the assignee as the "author".
      return undefined;

    case ActivityType.TIME_LOG:
      // Time logs have userId field
      return doc.userId as string;

    case ActivityType.ATTACHMENT:
      // Attachments have uploadedBy field
      return doc.uploadedBy as string;

    case ActivityType.WORKSPACE:
      // Workspaces have userId field (creator)
      return doc.userId as string;

    case ActivityType.WORK_ITEM:
      // Work items have assigneeIds array
      {
        const assigneeIds = doc.assigneeIds as string[] | undefined;
        return assigneeIds?.[0];
      }

    case ActivityType.MEMBER:
      // Members collection has userId field
      return doc.userId as string;

    case ActivityType.BACKLOG_ITEM:
      // Personal backlog has userId field
      return doc.userId as string;

    case ActivityType.PROJECT:
    case ActivityType.SPRINT:
      // Both have a createdBy field stored at creation time
      return (doc.createdBy as string | undefined);

    case ActivityType.CUSTOM_COLUMN:
    case ActivityType.NOTIFICATION:
      return undefined;

    default:
      return undefined;
  }
}

/**
 * Gets collection ID for activity type
 */
function getCollectionId(type: ActivityType): string {
  const map: Record<ActivityType, string> = {
    [ActivityType.TASK]: TASKS_ID,
    [ActivityType.PROJECT]: PROJECTS_ID,
    [ActivityType.WORKSPACE]: WORKSPACES_ID,
    [ActivityType.MEMBER]: MEMBERS_ID,
    [ActivityType.SPRINT]: SPRINTS_ID,
    [ActivityType.WORK_ITEM]: WORK_ITEMS_ID,
    [ActivityType.TIME_LOG]: TIME_LOGS_ID,
    [ActivityType.ATTACHMENT]: ATTACHMENTS_ID,
    [ActivityType.CUSTOM_COLUMN]: CUSTOM_COLUMNS_ID,
    [ActivityType.BACKLOG_ITEM]: PERSONAL_BACKLOG_ID,
    [ActivityType.NOTIFICATION]: NOTIFICATIONS_ID,
  };
  return map[type];
}

/**
 * Formats activity into human-readable description
 */
export function formatActivityDescription(activity: ActivityLog): string {
  const user = activity.userName || "Someone";
  const entity = activity.entityName || "an item";

  switch (activity.type) {
    case ActivityType.TASK:
      return `${user} ${activity.action} task "${entity}"`;
    case ActivityType.PROJECT:
      return `${user} ${activity.action} project "${entity}"`;
    case ActivityType.WORKSPACE:
      return `${user} ${activity.action} workspace "${entity}"`;
    case ActivityType.SPRINT:
      return `${user} ${activity.action} sprint "${entity}"`;
    case ActivityType.WORK_ITEM:
      return `${user} ${activity.action} work item "${entity}"`;
    case ActivityType.TIME_LOG:
      return `${user} ${activity.action} time log`;
    case ActivityType.ATTACHMENT:
      return `${user} ${activity.action} attachment "${entity}"`;
    case ActivityType.MEMBER:
      return `${user} ${activity.action} member`;
    case ActivityType.CUSTOM_COLUMN:
      return `${user} ${activity.action} custom column "${entity}"`;
    case ActivityType.BACKLOG_ITEM:
      return `${user} ${activity.action} backlog item "${entity}"`;
    default:
      return `${user} ${activity.action} ${entity}`;
  }
}

/**
 * Gets activity statistics
 */
export async function getActivityStats({
  workspaceId,
  startDate,
  endDate,
}: {
  workspaceId: string;
  startDate?: string;
  endDate?: string;
}) {
  // Get activities without pagination for stats (fetch more for accuracy)
  const result = await getActivityLogs({
    workspaceId,
    startDate,
    endDate,
    limit: 500, // Higher limit for stats calculation
  });

  const activities = result.activities;

  const activitiesByType: Record<string, number> = {};
  const activitiesByUser: Record<string, { name: string; count: number }> = {};
  const activitiesByDate: Record<string, number> = {};

  activities.forEach((activity) => {
    // Count by type
    activitiesByType[activity.type] = (activitiesByType[activity.type] || 0) + 1;

    // Count by user
    if (activity.userId) {
      if (!activitiesByUser[activity.userId]) {
        activitiesByUser[activity.userId] = {
          name: activity.userName || "Unknown",
          count: 0,
        };
      }
      activitiesByUser[activity.userId].count++;
    }

    // Count by date
    const date = new Date(activity.timestamp).toISOString().split("T")[0];
    activitiesByDate[date] = (activitiesByDate[date] || 0) + 1;
  });

  // Get most active users
  const mostActiveUsers = Object.entries(activitiesByUser)
    .map(([userId, { name, count }]) => ({
      userId,
      userName: name,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Get activity trend (last 7 days)
  const activityTrend = Object.entries(activitiesByDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 7)
    .reverse();

  return {
    totalActivities: activities.length,
    activitiesByType,
    activitiesByUser: Object.fromEntries(
      Object.entries(activitiesByUser).map(([id, data]) => [id, data.count])
    ),
    mostActiveUsers,
    activityTrend,
    recentActivities: activities.slice(0, 10),
  };
}
