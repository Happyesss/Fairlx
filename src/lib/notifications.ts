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
      console.log('[sendEmailNotification] User has no email:', userId);
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
    
    // Generate appropriate email template based on notification type
    let emailBody: string;
    
    switch (notificationType) {
      case "task_assigned":
        emailBody = taskAssignedTemplate({
          assignerName: triggeredByName,
          taskName: task.name,
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
          taskName: task.name,
          oldStatus: (metadata.oldStatus as string) || "UNKNOWN",
          newStatus: task.status,
          projectName,
          taskUrl,
        });
        break;
        
      case "task_completed":
        emailBody = taskCompletedTemplate({
          completerName: triggeredByName,
          taskName: task.name,
          taskDescription: task.description || undefined,
          projectName,
          completedAt: new Date().toISOString(),
          taskUrl,
        });
        break;
        
      case "task_priority_changed":
        emailBody = taskPriorityChangedTemplate({
          updaterName: triggeredByName,
          taskName: task.name,
          oldPriority: (metadata.oldPriority as string) || "MEDIUM",
          newPriority: task.priority || "MEDIUM",
          projectName,
          taskUrl,
        });
        break;
        
      case "task_due_date_changed":
        emailBody = taskDueDateChangedTemplate({
          updaterName: triggeredByName,
          taskName: task.name,
          oldDueDate: metadata.oldDueDate as string,
          newDueDate: task.dueDate,
          projectName,
          taskUrl,
        });
        break;
        
      case "task_updated":
      default:
        emailBody = taskUpdatedTemplate({
          updaterName: triggeredByName,
          taskName: task.name,
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
    
    console.log('[sendEmailNotification] Email sent successfully to:', user.email);
  } catch (error) {
    console.error('[sendEmailNotification] Failed to send email:', error);
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
      read: false,
    },
    [
      `read("user:${userId}")`,
      `update("user:${userId}")`,
      `delete("user:${userId}")`
    ]
  );

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
    }).catch((error) => {
      console.error('[createNotification] Email notification failed:', error);
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
    
    const assigneeIds = task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []);

    if (assigneeIds.length === 0) {
      return;
    }

    // Create notification title and message based on type
    let title: string;
    let message: string;

    switch (notificationType) {
      case "task_assigned":
        title = "New Task Assigned";
        message = `${triggeredByName} assigned you to "${task.name}"`;
        break;
      case "task_completed":
        title = "Task Completed";
        message = `${triggeredByName} marked "${task.name}" as completed`;
        break;
      case "task_status_changed":
        title = "Task Status Changed";
        message = `${triggeredByName} changed status of "${task.name}"`;
        break;
      case "task_priority_changed":
        title = "Task Priority Changed";
        message = `${triggeredByName} changed priority of "${task.name}"`;
        break;
      case "task_due_date_changed":
        title = "Due Date Changed";
        message = `${triggeredByName} updated the due date for "${task.name}"`;
        break;
      case "task_attachment_added":
        title = "Attachment Added";
        message = `${triggeredByName} added an attachment to "${task.name}"`;
        break;
      case "task_attachment_deleted":
        title = "Attachment Removed";
        message = `${triggeredByName} removed an attachment from "${task.name}"`;
        break;
      case "task_updated":
      default:
        title = "Task Updated";
        message = `${triggeredByName} updated "${task.name}"`;
        break;
    }

    // Map notification types to supported database enum values
    const supportedTypes = ["task_assigned", "task_updated", "task_completed", "task_deleted", "task_comment"];
    const dbNotificationType = supportedTypes.includes(notificationType) ? notificationType : "task_updated";

    // Create notifications for each assignee
    const notificationPromises = assigneeIds.map(async (assigneeId: string) => {
      // Don't notify the user who made the change
      if (assigneeId === triggeredByUserId) {
        return;
      }
      
      try {
        await createNotification({
          databases: adminDatabases,
          userId: assigneeId,
          type: dbNotificationType,
          title,
          message,
          taskId: task.$id,
          workspaceId,
          triggeredBy: triggeredByUserId,
          metadata: {
            taskName: task.name,
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
    console.log('[notifyWorkspaceAdmins] Starting notification process', {
      taskId: task.$id,
      triggeredByUserId,
      notificationType,
      workspaceId
    });

    // Use admin client to ensure we can create notifications for any user
    const { databases: adminDatabases } = await createAdminClient();

    // Get all workspace members
    const members = await adminDatabases.listDocuments(DATABASE_ID, MEMBERS_ID, [
      Query.equal("workspaceId", workspaceId),
      Query.equal("role", "ADMIN"),
    ]);

    console.log('[notifyWorkspaceAdmins] Found admin members:', members.documents.length);

    if (members.documents.length === 0) {
      console.log('[notifyWorkspaceAdmins] No admin members found');
      return;
    }

    let title: string;
    let message: string;

    switch (notificationType) {
      case "task_assigned":
        title = "New Task Created";
        message = `${triggeredByName} created a new task "${task.name}"`;
        break;
      case "task_completed":
        title = "Task Completed";
        message = `${triggeredByName} completed "${task.name}"`;
        break;
      case "task_status_changed":
        title = "Task Status Changed";
        message = `${triggeredByName} changed status of "${task.name}"`;
        break;
      case "task_priority_changed":
        title = "Task Priority Changed";
        message = `${triggeredByName} changed priority of "${task.name}"`;
        break;
      case "task_due_date_changed":
        title = "Due Date Changed";
        message = `${triggeredByName} updated the due date for "${task.name}"`;
        break;
      case "task_attachment_added":
        title = "Attachment Added";
        message = `${triggeredByName} added an attachment to "${task.name}"`;
        break;
      case "task_attachment_deleted":
        title = "Attachment Removed";
        message = `${triggeredByName} removed an attachment from "${task.name}"`;
        break;
      case "task_updated":
      default:
        title = "Task Updated";
        message = `${triggeredByName} updated "${task.name}"`;
        break;
    }

    // Map notification types to supported database enum values
    const supportedTypes = ["task_assigned", "task_updated", "task_completed", "task_deleted", "task_comment"];
    const dbNotificationType = supportedTypes.includes(notificationType) ? notificationType : "task_updated";

    // Create notifications for admin members
    const notificationPromises = members.documents.map(async (member: Models.Document) => {
      // Don't notify the user who made the change
      if (member.userId === triggeredByUserId) {
        console.log('[notifyWorkspaceAdmins] Skipping notification for triggering user:', member.userId);
        return;
      }

      console.log('[notifyWorkspaceAdmins] Creating notification for admin:', member.userId);

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
            taskName: task.name,
            taskStatus: task.status,
            projectId: task.projectId,
            ...extraMetadata,
          },
          task,
          triggeredByName,
        });
        console.log('[notifyWorkspaceAdmins] Notification created successfully for:', member.userId);
      } catch (error) {
        console.error('[notifyWorkspaceAdmins] Failed to create notification:', error);
      }
    });

    await Promise.all(notificationPromises);
    console.log('[notifyWorkspaceAdmins] All notifications processed');
  } catch (error) {
    console.error('[notifyWorkspaceAdmins] Error in notification process:', error);
  }
}
