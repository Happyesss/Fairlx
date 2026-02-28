import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { ID } from "node-appwrite";

import { sessionMiddleware } from "@/lib/session-middleware";
import { ATTACHMENTS_BUCKET_ID, DATABASE_ID, ATTACHMENTS_ID } from "@/config";
import { getMember } from "@/features/members/utils";
// Storage metering for billing - every file operation must be metered
import { logStorageUsage } from "@/lib/usage-metering";

import {
  deleteAttachmentSchema,
  getAttachmentsSchema,
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES,
} from "../schemas";

import {
  getAttachments,
  createAttachment,
  deleteAttachment,
} from "../server/route";

const app = new Hono()
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", getAttachmentsSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { taskId, workspaceId } = c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const attachments = await getAttachments(taskId, workspaceId);

      // Add URLs to attachments - use proxy URL for authentication support
      const attachmentsWithUrls = attachments.map((attachment) => ({
        ...attachment,
        url: `/api/attachments/${attachment.$id}/preview?workspaceId=${workspaceId}`,
      }));

      return c.json({ data: attachmentsWithUrls });
    }
  )
  .post(
    "/upload",
    sessionMiddleware,
    async (c) => {
      try {
        const user = c.get("user");
        const databases = c.get("databases");
        const storage = c.get("storage");

        const body = await c.req.parseBody();

        const file = body.file as File;
        const taskId = body.taskId as string;
        const workspaceId = body.workspaceId as string;

        if (!file || !taskId || !workspaceId) {
          return c.json({ error: "Missing required fields" }, 400);
        }

        const member = await getMember({
          databases,
          workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          return c.json({ error: "File size exceeds 20MB limit" }, 400);
        }

        // Validate file type
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
          return c.json({ error: "File type not allowed" }, 400);
        }

        // Upload file to storage
        const fileId = ID.unique();
        const uploadedFile = await storage.createFile(
          ATTACHMENTS_BUCKET_ID,
          fileId,
          file
        );

        // Create attachment record
        const attachment = await createAttachment({
          name: file.name,
          size: file.size,
          mimeType: file.type,
          fileId: uploadedFile.$id,
          taskId,
          workspaceId,
          uploadedBy: user.$id,
        });

        // Add URL to response - Use proxy URL for authentication support
        const url = `/api/attachments/${attachment.$id}/preview?workspaceId=${workspaceId}`;

        // Log storage usage for billing - every byte is billable
        logStorageUsage({
          databases,
          workspaceId,
          units: file.size, // Size in bytes
          operation: 'upload',
          metadata: {
            fileName: file.name,
            fileType: file.type,
            attachmentId: attachment.$id,
          },
        });

        return c.json({
          data: {
            ...attachment,
            url,
          },
        });
      } catch {
        return c.json({ error: "Failed to upload file" }, 500);
      }
    }
  )
  .delete(
    "/:attachmentId",
    sessionMiddleware,
    zValidator("query", deleteAttachmentSchema.pick({ workspaceId: true })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { attachmentId } = c.req.param();
      const { workspaceId } = c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      try {
        // Get attachment first to log size for billing
        const attachment = await databases.getDocument(
          DATABASE_ID,
          ATTACHMENTS_ID,
          attachmentId
        );

        const userName = user.name || user.email || "Someone";
        await deleteAttachment(attachmentId, workspaceId, user.$id, userName);

        // Log storage deletion for billing (negative delta)
        logStorageUsage({
          databases,
          workspaceId,
          units: -(attachment.size as number || 0), // Negative = storage released
          operation: 'delete',
          metadata: {
            fileName: attachment.name,
            attachmentId,
          },
        });

        return c.json({ data: { success: true } });
      } catch {
        return c.json({ error: "Failed to delete attachment" }, 500);
      }
    }
  )
  .get(
    "/:attachmentId/download",
    sessionMiddleware,
    zValidator("query", deleteAttachmentSchema.pick({ workspaceId: true })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const storage = c.get("storage");
      const { attachmentId } = c.req.param();
      const { workspaceId } = c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      try {
        // Get attachment by ID
        const attachment = await databases.getDocument(
          DATABASE_ID,
          ATTACHMENTS_ID,
          attachmentId
        );

        if (!attachment || attachment.workspaceId !== workspaceId) {
          return c.json({ error: "Attachment not found" }, 404);
        }

        // Get file from storage using getFileView (same content, proven reliable)
        // We add our own Content-Disposition header to force download
        const file = await storage.getFileView(ATTACHMENTS_BUCKET_ID, attachment.fileId);

        // Log download for traffic billing (fire-and-forget, don't await)
        logStorageUsage({
          databases,
          workspaceId,
          units: attachment.size as number || 0,
          operation: 'download',
          metadata: {
            fileName: attachment.name,
            attachmentId,
          },
        }).catch(() => { /* ignore metering errors */ });

        // Return the file directly with proper headers
        // Use RFC 5987 encoding for unicode filenames
        const safeFilename = attachment.name.replace(/[^\x20-\x7E]/g, '_');
        const encodedFilename = encodeURIComponent(attachment.name);
        return new Response(file, {
          headers: {
            'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`,
            'Content-Type': attachment.mimeType || 'application/octet-stream',
          },
        });
      } catch {
        return c.json({ error: "Failed to download file" }, 500);
      }
    }
  )
  .get(
    "/:attachmentId/preview",
    sessionMiddleware,
    zValidator("query", deleteAttachmentSchema.pick({ workspaceId: true })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const storage = c.get("storage");
      const { attachmentId } = c.req.param();
      const { workspaceId } = c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      try {
        // Get attachment by ID
        const attachment = await databases.getDocument(
          DATABASE_ID,
          ATTACHMENTS_ID,
          attachmentId
        );

        if (!attachment || attachment.workspaceId !== workspaceId) {
          return c.json({ error: "Attachment not found" }, 404);
        }

        // Get file from storage and return it directly for preview
        const file = await storage.getFileView(ATTACHMENTS_BUCKET_ID, attachment.fileId);

        // Return the file directly with proper headers for preview
        return new Response(file, {
          headers: {
            'Content-Type': attachment.mimeType || 'application/octet-stream',
          },
        });
      } catch {
        return c.json({ error: "Failed to preview file" }, 500);
      }
    }
  );

export default app;