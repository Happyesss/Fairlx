import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { ID, Query } from "node-appwrite";

import { sessionMiddleware } from "@/lib/session-middleware";
import { DATABASE_ID, PROJECT_DOCS_ID, PROJECT_DOCS_BUCKET_ID, PROJECTS_ID, MEMBERS_ID } from "@/config";
import { getMember } from "@/features/members/utils";
import { getStorageProvider } from "@/lib/storage";

import {
  getProjectDocumentsSchema,
  deleteProjectDocumentSchema,
  updateProjectDocumentSchema,
  MAX_FILE_SIZE,
  MAX_TOTAL_PROJECT_SIZE,
  ALLOWED_DOCUMENT_TYPES,
  formatFileSize,
} from "../schemas";
import { ProjectDocument, DocumentCategory } from "../types";
import aiRoute from "./ai-route";

const app = new Hono()
  // Mount AI routes
  .route("/ai", aiRoute)
  // Get all documents for a project
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", getProjectDocumentsSchema),
    async (c) => {
      try {
        const user = c.get("user");
        const databases = c.get("databases");
        const storage = c.get("storage");
        const { projectId, workspaceId, category, includeArchived } = c.req.valid("query");

        // Verify workspace membership
        const member = await getMember({
          databases,
          workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // Project permission check: verify user can view documents in this project
        const { resolveUserProjectAccess, hasProjectPermission, ProjectPermissionKey } = await import("@/lib/permissions/resolveUserProjectAccess");
        const access = await resolveUserProjectAccess(databases, user.$id, projectId);
        if (!access.hasAccess || !hasProjectPermission(access, ProjectPermissionKey.VIEW_DOCS)) {
          return c.json({ error: "Forbidden: No permission to view documents in this project" }, 403);
        }

        // Build queries
        const queries = [
          Query.equal("projectId", projectId),
          Query.equal("workspaceId", workspaceId),
          Query.orderDesc("$createdAt"),
        ];

        if (category) {
          queries.push(Query.equal("category", category));
        }

        if (!includeArchived) {
          queries.push(Query.equal("isArchived", false));
        }

        const documents = await databases.listDocuments<ProjectDocument>(
          DATABASE_ID,
          PROJECT_DOCS_ID,
          queries
        );

        // Add URLs to documents
        const storageProvider = getStorageProvider(storage);
        const documentsWithUrls = await Promise.all(
          documents.documents.map(async (doc) => {
            try {
              const url = storageProvider.getPublicUrl(PROJECT_DOCS_BUCKET_ID, doc.fileId);
              return { ...doc, url };
            } catch {
              return { ...doc, url: null };
            }
          })
        );

        // Calculate stats
        const totalSize = documents.documents.reduce((sum, doc) => sum + doc.size, 0);
        const byCategory = documents.documents.reduce((acc, doc) => {
          acc[doc.category] = (acc[doc.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return c.json({
          data: documentsWithUrls,
          stats: {
            totalDocuments: documents.total,
            totalSize,
            remainingSize: MAX_TOTAL_PROJECT_SIZE - totalSize,
            byCategory,
          },
        });
      } catch (error) {
        console.error("[ProjectDocs] Fetch failed:", error);
        return c.json({ error: "Failed to fetch documents" }, 500);
      }
    }
  )
  // Upload a new document
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
        const name = body.name as string;
        const description = body.description as string | undefined;
        const projectId = body.projectId as string;
        const workspaceId = body.workspaceId as string;
        const category = body.category as DocumentCategory;
        const version = (body.version as string) || "1.0";
        const tags = body.tags ? JSON.parse(body.tags as string) : [];

        if (!file || !name || !projectId || !workspaceId || !category) {
          return c.json({ error: "Missing required fields" }, 400);
        }

        // Verify workspace membership
        const member = await getMember({
          databases,
          workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // Verify project exists
        const project = await databases.getDocument(DATABASE_ID, PROJECTS_ID, projectId);
        if (!project || project.workspaceId !== workspaceId) {
          return c.json({ error: "Project not found" }, 404);
        }

        // Project permission check: verify user can create documents in this project
        const { resolveUserProjectAccess, hasProjectPermission, ProjectPermissionKey } = await import("@/lib/permissions/resolveUserProjectAccess");
        const accessForUpload = await resolveUserProjectAccess(databases, user.$id, projectId);
        if (!accessForUpload.hasAccess || !hasProjectPermission(accessForUpload, ProjectPermissionKey.CREATE_DOCS)) {
          return c.json({ error: "Forbidden: No permission to upload documents in this project" }, 403);
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          return c.json({
            error: `File size exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`,
          }, 400);
        }

        // Validate file type
        if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
          return c.json({
            error: "File type not allowed. Please upload documents, PDFs, or images.",
          }, 400);
        }

        // Check total project size
        const existingDocs = await databases.listDocuments<ProjectDocument>(
          DATABASE_ID,
          PROJECT_DOCS_ID,
          [
            Query.equal("projectId", projectId),
            Query.equal("isArchived", false),
          ]
        );

        const currentTotalSize = existingDocs.documents.reduce((sum, doc) => sum + doc.size, 0);
        if (currentTotalSize + file.size > MAX_TOTAL_PROJECT_SIZE) {
          return c.json({
            error: `Upload would exceed ${formatFileSize(MAX_TOTAL_PROJECT_SIZE)} project limit. Current usage: ${formatFileSize(currentTotalSize)}`,
          }, 400);
        }

        // Upload file to storage (R2 or Appwrite)
        const fileId = ID.unique();
        const storageProvider = getStorageProvider(storage);
        await storageProvider.uploadFile(PROJECT_DOCS_BUCKET_ID, fileId, file);

        const url = storageProvider.getPublicUrl(PROJECT_DOCS_BUCKET_ID, fileId);

        // Create document record
        const document = await databases.createDocument<ProjectDocument>(
          DATABASE_ID,
          PROJECT_DOCS_ID,
          ID.unique(),
          {
            title: name,
            name: name, // Add name back if required by schema
            description: description || "",
            size: file.size,
            mimeType: file.type,
            fileId,
            projectId,
            workspaceId,
            category,
            version,
            uploadedBy: user.$id,
            tags: tags || [],
            isArchived: false,
          }
        );

        return c.json({
          data: {
            ...document,
            url,
          },
        });
      } catch (error) {
        console.error("[ProjectDocs] Upload failed:", error);
        return c.json({ error: "Failed to upload document" }, 500);
      }
    }
  )
  // Update document metadata
  .patch(
    "/:documentId",
    sessionMiddleware,
    zValidator("json", updateProjectDocumentSchema.omit({ documentId: true })),
    async (c) => {
      try {
        const user = c.get("user");
        const databases = c.get("databases");
        const { documentId } = c.req.param();
        const updates = c.req.valid("json");

        // Get the document
        const document = await databases.getDocument<ProjectDocument>(
          DATABASE_ID,
          PROJECT_DOCS_ID,
          documentId
        );

        if (!document) {
          return c.json({ error: "Document not found" }, 404);
        }

        // Verify workspace membership
        const member = await getMember({
          databases,
          workspaceId: document.workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // Project permission check: verify user can edit documents in this project
        const { resolveUserProjectAccess, hasProjectPermission, ProjectPermissionKey } = await import("@/lib/permissions/resolveUserProjectAccess");
        const accessForEdit = await resolveUserProjectAccess(databases, user.$id, document.projectId);
        if (!accessForEdit.hasAccess || !hasProjectPermission(accessForEdit, ProjectPermissionKey.EDIT_DOCS)) {
          return c.json({ error: "Forbidden: No permission to edit documents in this project" }, 403);
        }

        // Update document (Appwrite handles $updatedAt automatically)
        const updatedDocument = await databases.updateDocument<ProjectDocument>(
          DATABASE_ID,
          PROJECT_DOCS_ID,
          documentId,
          {
            ...updates,
            name: updates.title, // Keep name in sync with title
          }
        );

        return c.json({ data: updatedDocument });
      } catch (error) {
        console.error("[ProjectDocs] Update failed:", error);
        return c.json({ error: "Failed to update document" }, 500);
      }
    }
  )
  // Replace document file (new version)
  .post(
    "/:documentId/replace",
    sessionMiddleware,
    async (c) => {
      try {
        const user = c.get("user");
        const databases = c.get("databases");
        const storage = c.get("storage");
        const { documentId } = c.req.param();

        const body = await c.req.parseBody();
        const file = body.file as File;
        const version = body.version as string | undefined;

        if (!file) {
          return c.json({ error: "File is required" }, 400);
        }

        // Get the document
        const document = await databases.getDocument<ProjectDocument>(
          DATABASE_ID,
          PROJECT_DOCS_ID,
          documentId
        );

        if (!document) {
          return c.json({ error: "Document not found" }, 404);
        }

        // Verify workspace membership
        const member = await getMember({
          databases,
          workspaceId: document.workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // Project permission check: verify user can edit documents in this project
        const { resolveUserProjectAccess, hasProjectPermission, ProjectPermissionKey } = await import("@/lib/permissions/resolveUserProjectAccess");
        const accessForReplace = await resolveUserProjectAccess(databases, user.$id, document.projectId);
        if (!accessForReplace.hasAccess || !hasProjectPermission(accessForReplace, ProjectPermissionKey.EDIT_DOCS)) {
          return c.json({ error: "Forbidden: No permission to replace documents in this project" }, 403);
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          return c.json({
            error: `File size exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`,
          }, 400);
        }

        // Validate file type
        if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
          return c.json({
            error: "File type not allowed",
          }, 400);
        }

        // Check total project size (accounting for the old file being replaced)
        const existingDocs = await databases.listDocuments<ProjectDocument>(
          DATABASE_ID,
          PROJECT_DOCS_ID,
          [
            Query.equal("projectId", document.projectId),
            Query.equal("isArchived", false),
            Query.notEqual("$id", documentId),
          ]
        );

        const currentTotalSize = existingDocs.documents.reduce((sum, doc) => sum + doc.size, 0);
        if (currentTotalSize + file.size > MAX_TOTAL_PROJECT_SIZE) {
          return c.json({
            error: `Upload would exceed ${formatFileSize(MAX_TOTAL_PROJECT_SIZE)} project limit`,
          }, 400);
        }

        // Delete old file
        const storageProvider = getStorageProvider(storage);
        try {
          await storageProvider.deleteFile(PROJECT_DOCS_BUCKET_ID, document.fileId, {
            workspaceId: document.workspaceId,
            sizeBytes: document.size,
          });
        } catch {
          // Ignore deletion errors
        }

        // Upload new file
        const fileId = ID.unique();
        await storageProvider.uploadFile(PROJECT_DOCS_BUCKET_ID, fileId, file);

        // Update document record
        const updatedDocument = await databases.updateDocument<ProjectDocument>(
          DATABASE_ID,
          PROJECT_DOCS_ID,
          documentId,
          {
            size: file.size,
            mimeType: file.type,
            fileId,
            version: version || document.version,
            updatedAt: new Date().toISOString(),
          }
        );

        const url = storageProvider.getPublicUrl(PROJECT_DOCS_BUCKET_ID, fileId);

        return c.json({
          data: {
            ...updatedDocument,
            url,
          },
        });
      } catch (error) {
        console.error("[ProjectDocs] Replace failed:", error);
        return c.json({ error: "Failed to replace document" }, 500);
      }
    }
  )
  // Delete document
  .delete(
    "/:documentId",
    sessionMiddleware,
    zValidator("query", deleteProjectDocumentSchema.pick({ workspaceId: true })),
    async (c) => {
      try {
        const user = c.get("user");
        const databases = c.get("databases");
        const storage = c.get("storage");
        const { documentId } = c.req.param();
        const { workspaceId } = c.req.valid("query");

        // Verify workspace membership
        const member = await getMember({
          databases,
          workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // Get the document
        const document = await databases.getDocument<ProjectDocument>(
          DATABASE_ID,
          PROJECT_DOCS_ID,
          documentId
        );

        if (!document || document.workspaceId !== workspaceId) {
          return c.json({ error: "Document not found" }, 404);
        }

        // Project permission check: verify user can delete documents in this project
        const { resolveUserProjectAccess, hasProjectPermission, ProjectPermissionKey } = await import("@/lib/permissions/resolveUserProjectAccess");
        const accessForDelete = await resolveUserProjectAccess(databases, user.$id, document.projectId);
        if (!accessForDelete.hasAccess || !hasProjectPermission(accessForDelete, ProjectPermissionKey.DELETE_DOCS)) {
          return c.json({ error: "Forbidden: No permission to delete documents in this project" }, 403);
        }

        // Delete file from storage (R2 or Appwrite)
        try {
          const storageProvider = getStorageProvider(storage);
          await storageProvider.deleteFile(PROJECT_DOCS_BUCKET_ID, document.fileId, {
            workspaceId: document.workspaceId,
            sizeBytes: document.size,
          });
        } catch {
          // Ignore deletion errors
        }

        // Delete document record
        await databases.deleteDocument(DATABASE_ID, PROJECT_DOCS_ID, documentId);

        return c.json({ data: { success: true } });
      } catch (error) {
        console.error("[ProjectDocs] Delete failed:", error);
        return c.json({ error: "Failed to delete document" }, 500);
      }
    }
  )
  // Get document download URL
  .get(
    "/:documentId/download",
    sessionMiddleware,
    zValidator("query", deleteProjectDocumentSchema.pick({ workspaceId: true })),
    async (c) => {
      try {
        const user = c.get("user");
        const databases = c.get("databases");
        const storage = c.get("storage");
        const { documentId } = c.req.param();
        const { workspaceId } = c.req.valid("query");

        // Verify workspace membership
        const member = await getMember({
          databases,
          workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // Get the document
        const document = await databases.getDocument<ProjectDocument>(
          DATABASE_ID,
          PROJECT_DOCS_ID,
          documentId
        );

        if (!document || document.workspaceId !== workspaceId) {
          return c.json({ error: "Document not found" }, 404);
        }

        // Project permission check: verify user can view/download documents in this project
        const { resolveUserProjectAccess, hasProjectPermission, ProjectPermissionKey } = await import("@/lib/permissions/resolveUserProjectAccess");
        const accessForDownload = await resolveUserProjectAccess(databases, user.$id, document.projectId);
        if (!accessForDownload.hasAccess || !hasProjectPermission(accessForDownload, ProjectPermissionKey.VIEW_DOCS)) {
          return c.json({ error: "Forbidden: No permission to download documents in this project" }, 403);
        }

        // Get file from storage (R2 or Appwrite)
        const storageProvider = getStorageProvider(storage);
        const file = await storageProvider.getFileView(PROJECT_DOCS_BUCKET_ID, document.fileId);

        return new Response(new Uint8Array(file), {
          headers: {
            "Content-Disposition": `attachment; filename="${document.name}"`,
            "Content-Type": document.mimeType || "application/octet-stream",
          },
        });
      } catch (error) {
        console.error("[ProjectDocs] Download failed:", error);
        return c.json({ error: "Failed to download document" }, 500);
      }
    }
  )
  // Get single document
  .get(
    "/:documentId",
    sessionMiddleware,
    zValidator("query", deleteProjectDocumentSchema.pick({ workspaceId: true })),
    async (c) => {
      try {
        const user = c.get("user");
        const databases = c.get("databases");
        const storage = c.get("storage");
        const { documentId } = c.req.param();
        const { workspaceId } = c.req.valid("query");

        // Verify workspace membership
        const member = await getMember({
          databases,
          workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // Get the document
        const document = await databases.getDocument<ProjectDocument>(
          DATABASE_ID,
          PROJECT_DOCS_ID,
          documentId
        );

        if (!document || document.workspaceId !== workspaceId) {
          return c.json({ error: "Document not found" }, 404);
        }

        // Project permission check: verify user can view documents in this project
        const { resolveUserProjectAccess, hasProjectPermission, ProjectPermissionKey } = await import("@/lib/permissions/resolveUserProjectAccess");
        const accessForGet = await resolveUserProjectAccess(databases, user.$id, document.projectId);
        if (!accessForGet.hasAccess || !hasProjectPermission(accessForGet, ProjectPermissionKey.VIEW_DOCS)) {
          return c.json({ error: "Forbidden: No permission to view documents in this project" }, 403);
        }

        // Get URL
        const storageProvider = getStorageProvider(storage);
        const url = storageProvider.getPublicUrl(PROJECT_DOCS_BUCKET_ID, document.fileId);

        // Get uploader info
        let uploader = null;
        try {
          const members = await databases.listDocuments(DATABASE_ID, MEMBERS_ID, [
            Query.equal("userId", document.uploadedBy),
            Query.equal("workspaceId", workspaceId),
          ]);
          if (members.total > 0) {
            uploader = { $id: members.documents[0].userId, name: members.documents[0].name || "Unknown" };
          }
        } catch {
          // Ignore uploader fetch errors
        }

        return c.json({
          data: {
            ...document,
            url,
            uploader,
          },
        });
      } catch (error) {
        console.error("[ProjectDocs] Get failed:", error);
        return c.json({ error: "Failed to get document" }, 500);
      }
    }
  );

export default app;
