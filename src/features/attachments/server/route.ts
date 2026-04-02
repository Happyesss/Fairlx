import { createAdminClient } from "@/lib/appwrite";
import { DATABASE_ID, ATTACHMENTS_ID, ATTACHMENTS_BUCKET_ID, TASKS_ID } from "@/config";
import { Attachment } from "../types";
import { Query, ID } from "node-appwrite";
import { Task } from "@/features/tasks/types";
import { getAdminStorageProvider } from "@/lib/storage";

export const getAttachments = async (taskId: string, workspaceId: string): Promise<Attachment[]> => {
  const { databases } = await createAdminClient();

  const attachments = await databases.listDocuments(
    DATABASE_ID,
    ATTACHMENTS_ID,
    [
      Query.equal("taskId", taskId),
      Query.equal("workspaceId", workspaceId),
      Query.orderDesc("$createdAt"),
    ]
  );

  return attachments.documents as Attachment[];
};

export const createAttachment = async (data: {
  name: string;
  size: number;
  mimeType: string;
  fileId: string;
  taskId: string;
  projectId: string;
  workspaceId: string;
  uploadedBy: string;
  uploaderName?: string;
}): Promise<Attachment> => {
  const { databases } = await createAdminClient();

  const attachment = await databases.createDocument(
    DATABASE_ID,
    ATTACHMENTS_ID,
    ID.unique(),
    {
      fileName: data.name,
      fileSize: data.size,
      mimeType: data.mimeType,
      fileId: data.fileId,
      taskId: data.taskId,
      projectId: data.projectId,
      workspaceId: data.workspaceId,
      uploadedBy: data.uploadedBy,
    }
  );

  // Send notifications (non-blocking) using the new event-driven system
  // This automatically deduplicates recipients and ignores the triggerer
  try {
    const { dispatchWorkitemEvent, createAttachmentAddedEvent } = await import("@/lib/notifications");
    const task = await databases.getDocument<Task>(DATABASE_ID, TASKS_ID, data.taskId);
    const uploaderName = data.uploaderName || "Someone";

    const event = createAttachmentAddedEvent(
      task,
      data.uploadedBy,
      uploaderName,
      attachment.$id,
      data.name
    );

    dispatchWorkitemEvent(event).catch((err) => {
      console.error("[Attachments] Failed to dispatch attachment event:", err);
    });
  } catch (err) {
    console.error("[Attachments] Error preparing notifications:", err);
    // Silently fail - notifications are non-critical
  }

  return attachment as Attachment;
};

export const deleteAttachment = async (
  attachmentId: string,
  workspaceId: string,
  deletedBy?: string,
  deleterName?: string
): Promise<void> => {
  const { databases } = await createAdminClient();

  // First get the attachment to get the fileId
  const attachment = await databases.getDocument(
    DATABASE_ID,
    ATTACHMENTS_ID,
    attachmentId
  ) as Attachment;

  // Verify workspace access
  if (attachment.workspaceId !== workspaceId) {
    throw new Error("Unauthorized");
  }

  // Store attachment info for notifications
  const taskId = attachment.taskId;

  // Delete the file from storage (R2 or Appwrite)
  try {
    const storageProvider = await getAdminStorageProvider();
    await storageProvider.deleteFile(ATTACHMENTS_BUCKET_ID, attachment.fileId, {
      workspaceId: attachment.workspaceId,
      sizeBytes: attachment.fileSize,
    });
  } catch {
    // Continue with database deletion even if file deletion fails
  }

  // Delete the attachment record
  await databases.deleteDocument(
    DATABASE_ID,
    ATTACHMENTS_ID,
    attachmentId
  );

  // Send notifications (non-blocking) using the new event-driven system
  if (deletedBy && taskId) {
    try {
      const { dispatchWorkitemEvent, createAttachmentDeletedEvent } = await import("@/lib/notifications");
      const task = await databases.getDocument<Task>(DATABASE_ID, TASKS_ID, taskId);
      const userName = deleterName || "Someone";

      const event = createAttachmentDeletedEvent(
        task,
        deletedBy,
        userName,
        attachmentId,
        (attachment as { fileName?: string }).fileName || attachment.name || 'file'
      );

      dispatchWorkitemEvent(event).catch((err) => {
        console.error("[Attachments] Failed to dispatch attachment delete event:", err);
      });
    } catch (err) {
      console.error("[Attachments] Error preparing notifications:", err);
      // Silently fail - notifications are non-critical
    }
  }
};