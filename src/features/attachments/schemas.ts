import { z } from "zod";

export const createAttachmentSchema = z.object({
  name: z.string().trim().min(1, "File name is required"),
  size: z.number().min(0, "File size must be positive"),
  mimeType: z.string().min(1, "MIME type is required"),
  taskId: z.string().trim().min(1, "Task ID is required"),
  workspaceId: z.string().trim().min(1, "Workspace ID is required"),
});

export const deleteAttachmentSchema = z.object({
  attachmentId: z.string().trim().min(1, "Attachment ID is required"),
  workspaceId: z.string().trim().min(1, "Workspace ID is required"),
});

export const getAttachmentsSchema = z.object({
  taskId: z.string().trim().min(1, "Task ID is required"),
  workspaceId: z.string().trim().min(1, "Workspace ID is required"),
});

export const uploadAttachmentSchema = z.object({
  file: z.any().refine((val) => val instanceof File, "File is required"),
  taskId: z.string().trim().min(1, "Task ID is required"),
  workspaceId: z.string().trim().min(1, "Workspace ID is required"),
});

// File size limit: 20MB
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

// Allowed file types
export const ALLOWED_FILE_TYPES = [
  // Images
  "image/jpeg",
  "image/jpg", 
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Text files
  "text/plain",
  "text/csv",
  "text/html",
  "text/css",
  "text/javascript",
  "application/json",
  "application/xml",
  // Archives
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
  // Other
  "application/octet-stream",
];

export const PREVIEWABLE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png", 
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/html",
  "application/json",
];