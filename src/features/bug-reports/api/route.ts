import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { ID } from "node-appwrite";

import { sessionMiddleware } from "@/lib/session-middleware";
import { DATABASE_ID, BUG_REPORTS_ID, BUG_REPORTS_BUCKET_ID } from "@/config";
import { createAdminClient } from "@/lib/appwrite";
import { AppwriteStorageProvider } from "@/lib/storage/appwrite-provider";
import { MAX_IMAGE_SIZE, ALLOWED_IMAGE_TYPES } from "../schemas";

const app = new Hono()
  .post("/upload-image", sessionMiddleware, async (c) => {
    try {
      const body = await c.req.parseBody();
      const file = body.file as File;

      if (!file) {
        return c.json({ error: "No file provided" }, 400);
      }
      if (file.size > MAX_IMAGE_SIZE) {
        return c.json({ error: "Image size exceeds 10MB limit" }, 400);
      }
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return c.json({ error: `File type not allowed: ${file.type}` }, 400);
      }

      const { storage } = await createAdminClient();
      const provider = new AppwriteStorageProvider(storage);
      const fileId = ID.unique();

      await provider.uploadFile(BUG_REPORTS_BUCKET_ID, fileId, file);

      // Appwrite generates a stable public URL for buckets with Role.any() read permission
      const url = provider.getPublicUrl(BUG_REPORTS_BUCKET_ID, fileId) ??
        `/api/bug-reports/images/${fileId}`;

      return c.json({ data: { fileId, url } });
    } catch (error) {
      console.error("[BugReports] Image upload failed:", error);
      return c.json({ error: "Failed to upload image" }, 500);
    }
  })
  .post(
    "/",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        bugs: z
          .array(
            z.object({
              title: z.string().trim().min(3).max(200),
              description: z.string().trim().min(10).max(5000),
              imageFileIds: z.array(z.string()).optional().default([]),
              imageUrls: z.array(z.string()).optional().default([]),
            })
          )
          .min(1),
      })
    ),
    async (c) => {
      const user = c.get("user");
      const { bugs } = c.req.valid("json");

      const { databases } = await createAdminClient();

      const created = await Promise.all(
        bugs.map((bug) =>
          databases.createDocument(DATABASE_ID, BUG_REPORTS_ID, ID.unique(), {
            userId: user.$id,
            email: user.email,
            username: user.name,
            title: bug.title,
            description: bug.description,
            imageFileIds: bug.imageFileIds ?? [],
            imageUrls: bug.imageUrls ?? [],
          })
        )
      );

      return c.json({ data: created });
    }
  )
  // Proxy endpoint for cases where Appwrite endpoint/project are not public
  .get("/images/:fileId", sessionMiddleware, async (c) => {
    const { fileId } = c.req.param();
    try {
      const { storage } = await createAdminClient();
      const provider = new AppwriteStorageProvider(storage);
      const file = await provider.getFileView(BUG_REPORTS_BUCKET_ID, fileId);

      return new Response(new Uint8Array(file), {
        headers: { "Content-Type": "image/jpeg" },
      });
    } catch {
      return c.json({ error: "Image not found" }, 404);
    }
  });

export default app;
