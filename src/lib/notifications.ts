/**
 * Legacy Notification Helpers
 * 
 * These functions provide backward compatibility for existing task notification calls.
 * For new implementations, use the event-driven notification system:
 * 
 * ```typescript
 * import { dispatchWorkitemEvent, createAssignedEvent } from "@/lib/notifications";
 * ```
 * 
 * The new system provides:
 * - Centralized event dispatch
 * - User preference support
 * - Isolated channel handlers (socket, email)
 * - Better error handling and logging
 */

import { ID, Models, Databases, Query } from "node-appwrite";
import { DATABASE_ID, NOTIFICATIONS_ID, MEMBERS_ID, PROJECTS_ID } from "@/config";
import { Task } from "@/features/tasks/types";
import { createAdminClient } from "@/lib/appwrite";
import {
  taskAssignedTemplate,
  taskStatusChangedTemplate,
  taskCompletedTemplate,
  taskUpdatedTemplate,
  taskPriorityChangedTemplate,
  taskDueDateChangedTemplate,
} from "@/lib/email-templates";

// =============================================================================
// RE-EXPORT EVENT-DRIVEN NOTIFICATION SYSTEM
// =============================================================================
// These are re-exported from the notifications/ directory so that imports like
// `import { dispatchWorkitemEvent } from "@/lib/notifications"` work correctly.

export {
  // Types
  WorkitemEventType,
  DEFAULT_NOTIFICATION_PREFERENCES,
  // Event creators
  createWorkitemEvent,
  createAssignedEvent,
  createStatusChangedEvent,
  createCompletedEvent,
  createPriorityChangedEvent,
  createDueDateChangedEvent,
  createCommentAddedEvent,
  createMentionEvent,
  createAttachmentAddedEvent,
  createAttachmentDeletedEvent,
  getNotificationTitle,
  getNotificationSummary,
  getDefaultChannelsForEvent,
  // Dispatcher
  dispatcher,
  dispatchWorkitemEvent,
  // Channel handlers
  SocketChannelHandler,
  socketChannelHandler,
  EmailChannelHandler,
  emailChannelHandler,
} from "./notifications/index";

export type {
  NotificationChannel,
  WorkitemEvent,
  WorkitemEventMetadata,
  NotificationPayload,
  UserNotificationPreferences,
  ChannelHandler,
  RecipientInfo,
} from "./notifications/index";

// CRITICAL: Force execution of initialization code in notifications/index.ts
// This ensures channel handlers are registered with the dispatcher
import "./notifications/index";

export type NotificationType =
  | "task_assigned"
  | "task_updated"
  | "task_completed"
  | "task_status_changed"
  | "task_priority_changed"
  | "task_due_date_changed"
  | "task_attachment_added"
  | "task_attachment_deleted"
  | "task_comment";

interface CreateNotificationParams {
  databases: Databases;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  taskId: string;
  workspaceId: string;
  triggeredBy: string;
  metadata?: Record<string, unknown>;
  task?: Task;
  triggeredByName?: string;
}

/**
 * Send email notification to a user with professional templates
 */
async function sendEmailNotification({
  userId,
  title,
  taskId,
  workspaceId,
  notificationType,
  task,
  triggeredByName,
  metadata = {},
}: {
  userId: string;
  title: string;
  taskId: string;
  workspaceId: string;
  notificationType: NotificationType;
  task: Task;
  triggeredByName: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { messaging, users, databases } = await createAdminClient();

    // Get user details to get their email
    const user = await users.get(userId);

    if (!user.email) {
      return;
    }

    // Get project details if available
    let projectName: string | undefined;
    if (task.projectId) {
      try {
        const project = await databases.getDocument(DATABASE_ID, PROJECTS_ID, task.projectId);
        projectName = project.name;
      } catch {
        // Project not found or error, continue without it
      }
    }

    const taskUrl = `${process.env.NEXT_PUBLIC_APP_URL}/workspaces/${workspaceId}/tasks/${taskId}`;

    // Get task name (use title as primary, fall back to name for compatibility)
    const emailTaskName = task.title || task.name || "Untitled Task";

    // Generate appropriate email template based on notification type
    let emailBody: string;

    switch (notificationType) {
      case "task_assigned":
        emailBody = taskAssignedTemplate({
          assignerName: triggeredByName,
          taskName: emailTaskName,
          taskDescription: task.description || undefined,
          projectName,
          dueDate: task.dueDate,
          priority: task.priority || undefined,
          taskUrl,
        });
        break;

      case "task_status_changed":
        emailBody = taskStatusChangedTemplate({
          updaterName: triggeredByName,
          taskName: emailTaskName,
          oldStatus: (metadata.oldStatus as string) || "UNKNOWN",
          newStatus: task.status,
          projectName,
          taskUrl,
        });
        break;

      case "task_completed":
        emailBody = taskCompletedTemplate({
          completerName: triggeredByName,
          taskName: emailTaskName,
          taskDescription: task.description || undefined,
          projectName,
          completedAt: new Date().toISOString(),
          taskUrl,
        });
        break;

      case "task_priority_changed":
        emailBody = taskPriorityChangedTemplate({
          updaterName: triggeredByName,
          taskName: emailTaskName,
          oldPriority: (metadata.oldPriority as string) || "MEDIUM",
          newPriority: task.priority || "MEDIUM",
          projectName,
          taskUrl,
        });
        break;

      case "task_due_date_changed":
        emailBody = taskDueDateChangedTemplate({
          updaterName: triggeredByName,
          taskName: emailTaskName,
          oldDueDate: metadata.oldDueDate as string,
          newDueDate: task.dueDate || "No date",
          projectName,
          taskUrl,
        });
        break;

      case "task_updated":
      default:
        emailBody = taskUpdatedTemplate({
          updaterName: triggeredByName,
          taskName: emailTaskName,
          projectName,
          changesDescription: metadata.changesDescription as string,
          taskUrl,
        });
        break;
    }

    await messaging.createEmail(
      ID.unique(),
      title,
      emailBody,
      [], // Topics
      [userId], // Users to send to
      [], // Targets
      [], // CC
      [] // BCC
    );
  } catch {
    // Silent failure - email notification is non-critical
  }
}

/**
 * Create a notification for a user
 */
export async function createNotification({
  databases,
  userId,
  type,
  title,
  message,
  taskId,
  workspaceId,
  triggeredBy,
  metadata = {},
  task,
  triggeredByName,
}: CreateNotificationParams): Promise<Models.Document> {
  // Create in-app notification
  const notification = await databases.createDocument(
    DATABASE_ID,
    NOTIFICATIONS_ID,
    ID.unique(),
    {
      userId,
      type,
      title,
      message,
      taskId,
      workspaceId,
      triggeredBy,
      metadata: JSON.stringify(metadata),
      isRead: false,
    },
    [
      `read("user:${userId}")`,
      `update("user:${userId}")`,
      `delete("user:${userId}")`
    ]
  );

  // SOCKET PUSH: Fire-and-forget WebSocket notification
  // Non-blocking, failures are logged but never thrown
  // Import dynamically to avoid server-side issues
  try {
    const { pushNotificationToSocket } = await import("@/lib/socket");
    pushNotificationToSocket(notification);
  } catch {
    // Silent failure - socket push is non-critical
    console.debug("[createNotification] Socket push unavailable");
  }

  // Send email notification asynchronously (don't await to avoid blocking)
  if (task && triggeredByName) {
    sendEmailNotification({
      userId,
      title,
      taskId,
      workspaceId,
      notificationType: type,
      task,
      triggeredByName,
      metadata,
    }).catch(() => {
      // Silent failure - email notification is non-critical
    });
  }

  return notification;
}

/**
 * Notify assignees about a task change
 */
export async function notifyTaskAssignees({
  task,
  triggeredByUserId,
  triggeredByName,
  notificationType,
  workspaceId,
  metadata: extraMetadata,
}: {
  databases: Databases;
  task: Task;
  triggeredByUserId: string;
  triggeredByName: string;
  notificationType: NotificationType;
  workspaceId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    // Use admin client to ensure we can create notifications for any user
    const { databases: adminDatabases } = await createAdminClient();

    const assigneeIds = task.assigneeIds || [];

    if (assigneeIds.length === 0) {
      return;
    }

    // Get task name (use title as primary, fall back to name for compatibility)
    const taskName = task.title || task.name || "Untitled Task";

    // Create notification title and message based on type
    let title: string;
    let message: string;

    switch (notificationType) {
      case "task_assigned":
        title = "New Task Assigned";
        message = `${triggeredByName} assigned you to "${taskName}"`;
        break;
      case "task_completed":
        title = "Task Completed";
        message = `${triggeredByName} marked "${taskName}" as completed`;
        break;
      case "task_status_changed":
        title = "Task Status Changed";
        message = `${triggeredByName} changed status of "${taskName}"`;
        break;
      case "task_priority_changed":
        title = "Task Priority Changed";
        message = `${triggeredByName} changed priority of "${taskName}"`;
        break;
      case "task_due_date_changed":
        title = "Due Date Changed";
        message = `${triggeredByName} updated the due date for "${taskName}"`;
        break;
      case "task_attachment_added":
        title = "Attachment Added";
        message = `${triggeredByName} added an attachment to "${taskName}"`;
        break;
      case "task_attachment_deleted":
        title = "Attachment Removed";
        message = `${triggeredByName} removed an attachment from "${taskName}"`;
        break;
      case "task_updated":
      default:
        title = "Task Updated";
        message = `${triggeredByName} updated "${taskName}"`;
        break;
    }

    // Map notification types to supported database enum values
    const supportedTypes = ["task_assigned", "task_updated", "task_completed", "task_deleted", "task_comment", "task_mention", "task_reply"];
    const dbNotificationType = supportedTypes.includes(notificationType) ? notificationType : "task_updated";

    // Fetch member documents to get actual user IDs
    // assigneeIds are member document IDs, not user IDs
    const members = await adminDatabases.listDocuments(
      DATABASE_ID,
      MEMBERS_ID,
      [Query.equal("$id", assigneeIds)]
    );

    // Create notifications for each assignee's user ID
    const notificationPromises = members.documents.map(async (member) => {
      const userId = member.userId as string;

      // Don't notify the user who made the change
      if (userId === triggeredByUserId) {
        return;
      }

      try {
        await createNotification({
          databases: adminDatabases,
          userId,
          type: dbNotificationType,
          title,
          message,
          taskId: task.$id,
          workspaceId,
          triggeredBy: triggeredByUserId,
          metadata: {
            taskName,
            taskStatus: task.status,
            projectId: task.projectId,
            ...extraMetadata,
          },
          task,
          triggeredByName,
        });
      } catch {
        // Silently fail - notifications are non-critical
      }
    });

    await Promise.all(notificationPromises);
  } catch {
    // Silently fail - notifications are non-critical
  }
}

/**
 * Notify workspace admins about a task change
 */
export async function notifyWorkspaceAdmins({
  task,
  triggeredByUserId,
  triggeredByName,
  notificationType,
  workspaceId,
  metadata: extraMetadata,
}: {
  databases: Databases;
  task: Task;
  triggeredByUserId: string;
  triggeredByName: string;
  notificationType: NotificationType;
  workspaceId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    // Use admin client to ensure we can create notifications for any user
    const { databases: adminDatabases } = await createAdminClient();

    // Get all workspace members
    const members = await adminDatabases.listDocuments(DATABASE_ID, MEMBERS_ID, [
      Query.equal("workspaceId", workspaceId),
      Query.equal("role", "ADMIN"),
    ]);

    if (members.documents.length === 0) {
      return;
    }

    // Get task name (use title as primary, fall back to name for compatibility)
    const adminTaskName = task.title || task.name || "Untitled Task";

    let title: string;
    let message: string;

    switch (notificationType) {
      case "task_assigned":
        title = "New Task Created";
        message = `${triggeredByName} created a new task "${adminTaskName}"`;
        break;
      case "task_completed":
        title = "Task Completed";
        message = `${triggeredByName} completed "${adminTaskName}"`;
        break;
      case "task_status_changed":
        title = "Task Status Changed";
        message = `${triggeredByName} changed status of "${adminTaskName}"`;
        break;
      case "task_priority_changed":
        title = "Task Priority Changed";
        message = `${triggeredByName} changed priority of "${adminTaskName}"`;
        break;
      case "task_due_date_changed":
        title = "Due Date Changed";
        message = `${triggeredByName} updated the due date for "${adminTaskName}"`;
        break;
      case "task_attachment_added":
        title = "Attachment Added";
        message = `${triggeredByName} added an attachment to "${adminTaskName}"`;
        break;
      case "task_attachment_deleted":
        title = "Attachment Removed";
        message = `${triggeredByName} removed an attachment from "${adminTaskName}"`;
        break;
      case "task_updated":
      default:
        title = "Task Updated";
        message = `${triggeredByName} updated "${adminTaskName}"`;
        break;
    }

    // Map notification types to supported database enum values
    const supportedTypes = ["task_assigned", "task_updated", "task_completed", "task_deleted", "task_comment", "task_mention", "task_reply"];
    const dbNotificationType = supportedTypes.includes(notificationType) ? notificationType : "task_updated";

    // Create notifications for admin members
    const notificationPromises = members.documents.map(async (member: Models.Document) => {
      // Don't notify the user who made the change
      if (member.userId === triggeredByUserId) {
        return;
      }

      try {
        await createNotification({
          databases: adminDatabases,
          userId: member.userId,
          type: dbNotificationType,
          title,
          message,
          taskId: task.$id,
          workspaceId,
          triggeredBy: triggeredByUserId,
          metadata: {
            taskName: adminTaskName,
            taskStatus: task.status,
            projectId: task.projectId,
            ...extraMetadata,
          },
          task,
          triggeredByName,
        });
      } catch {
        // Silent failure - notifications are non-critical
      }
    });

    await Promise.all(notificationPromises);
  } catch {
    // Silent failure - notifications are non-critical
  }
}
