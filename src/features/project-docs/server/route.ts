import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { ID, Query } from "node-appwrite";

import { sessionMiddleware } from "@/lib/session-middleware";
import { DATABASE_ID, PROJECT_DOCS_ID, PROJECT_DOCS_BUCKET_ID, PROJECTS_ID, MEMBERS_ID } from "@/config";
import { getMember } from "@/features/members/utils";

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
        const documentsWithUrls = await Promise.all(
          documents.documents.map(async (doc) => {
            try {
              const url = storage.getFileView(PROJECT_DOCS_BUCKET_ID, doc.fileId).toString();
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
        console.error("Error fetching documents:", error);
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

        // Upload file to storage
        const fileId = ID.unique();
        await storage.createFile(PROJECT_DOCS_BUCKET_ID, fileId, file);

        // Create document record
        const document = await databases.createDocument<ProjectDocument>(
          DATABASE_ID,
          PROJECT_DOCS_ID,
          ID.unique(),
          {
            name,
            description: description || "",
            fileName: file.name,
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

        // Get URL for the uploaded file
        const url = storage.getFileView(PROJECT_DOCS_BUCKET_ID, fileId).toString();

        return c.json({
          data: {
            ...document,
            url,
          },
        });
      } catch (error) {
        console.error("Upload error:", error);
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

        // Update document (Appwrite handles $updatedAt automatically)
        const updatedDocument = await databases.updateDocument<ProjectDocument>(
          DATABASE_ID,
          PROJECT_DOCS_ID,
          documentId,
          updates
        );

        return c.json({ data: updatedDocument });
      } catch (error) {
        console.error("Update error:", error);
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
        try {
          await storage.deleteFile(PROJECT_DOCS_BUCKET_ID, document.fileId);
        } catch {
          console.warn("Could not delete old file:", document.fileId);
        }

        // Upload new file
        const fileId = ID.unique();
        await storage.createFile(PROJECT_DOCS_BUCKET_ID, fileId, file);

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

        const url = storage.getFileView(PROJECT_DOCS_BUCKET_ID, fileId).toString();

        return c.json({
          data: {
            ...updatedDocument,
            url,
          },
        });
      } catch (error) {
        console.error("Replace error:", error);
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

        // Delete file from storage
        try {
          await storage.deleteFile(PROJECT_DOCS_BUCKET_ID, document.fileId);
        } catch {
          console.warn("Could not delete file:", document.fileId);
        }

        // Delete document record
        await databases.deleteDocument(DATABASE_ID, PROJECT_DOCS_ID, documentId);

        return c.json({ data: { success: true } });
      } catch (error) {
        console.error("Delete error:", error);
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

        // Get file from storage
        const file = await storage.getFileDownload(PROJECT_DOCS_BUCKET_ID, document.fileId);

        return new Response(file, {
          headers: {
            "Content-Disposition": `attachment; filename="${document.name}"`,
            "Content-Type": document.mimeType || "application/octet-stream",
          },
        });
      } catch (error) {
        console.error("Download error:", error);
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

        // Get URL
        const url = storage.getFileView(PROJECT_DOCS_BUCKET_ID, document.fileId).toString();

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
          console.warn("Could not fetch uploader info");
        }

        return c.json({
          data: {
            ...document,
            url,
            uploader,
          },
        });
      } catch (error) {
        console.error("Get document error:", error);
        return c.json({ error: "Failed to get document" }, 500);
      }
    }
  );

export default app;
