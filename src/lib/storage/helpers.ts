/**
 * Storage Helpers
 * 
 * Common patterns for image upload that are shared across
 * workspaces, projects, spaces, auth, and organizations.
 * 
V * When R2_PUBLIC_URL is set (e.g. https://storage.fairlx.com),
 * images are served directly from Cloudflare CDN.
 * Otherwise falls back to the /api/storage/images/[fileId] proxy.
 */
import "server-only";

import { ID } from "node-appwrite";
import type { Storage as AppwriteStorage } from "node-appwrite";
import { getStorageProvider, isR2Enabled } from "@/lib/storage";
import { IMAGES_BUCKET_ID } from "@/config";

/**
 * Build the URL for serving an image.
 * 
 * Priority:
 * 1. R2 public URL (https://storage.fairlx.com/{prefix}/{fileId}) — direct CDN
 * 2. Proxy URL (/api/storage/images/{fileId}) — fallback
 */
export function getImageUrl(fileId: string, bucketId: string = IMAGES_BUCKET_ID): string {
  if (isR2Enabled()) {
    const provider = getStorageProvider();
    const publicUrl = provider.getPublicUrl(bucketId, fileId);
    if (publicUrl) return publicUrl;
  }
  return `/api/storage/images/${fileId}`;
}

/**
 * Upload an image and return a URL.
 * 
 * With R2_PUBLIC_URL: returns https://storage.fairlx.com/{prefix}/{fileId}
 * Without: returns /api/storage/images/{fileId} (proxy)
 */
export async function uploadImageAndGetUrl(
  appwriteStorage: AppwriteStorage,
  image: File,
  bucketId: string = IMAGES_BUCKET_ID,
): Promise<{ url: string; fileId: string }> {
  const provider = getStorageProvider(appwriteStorage);
  const fileId = ID.unique();

  const uploadedFile = await provider.uploadFile(bucketId, fileId, image);

  return {
    url: getImageUrl(uploadedFile.id, bucketId),
    fileId: uploadedFile.id,
  };
}

/**
 * Upload an image file and return a public URL.
 * Uses R2 CDN URL when available, falls back to proxy.
 */
export async function uploadImageAndGetPublicUrl(
  appwriteStorage: AppwriteStorage,
  image: File,
  bucketId: string = IMAGES_BUCKET_ID,
): Promise<string> {
  const result = await uploadImageAndGetUrl(appwriteStorage, image, bucketId);
  return result.url;
}

/**
 * Delete an image from storage. Silently ignores errors.
 */
export async function deleteImageSilently(
  appwriteStorage: AppwriteStorage,
  fileId: string,
  bucketId: string = IMAGES_BUCKET_ID,
  context?: { workspaceId?: string; sizeBytes?: number }
): Promise<void> {
  try {
    const provider = getStorageProvider(appwriteStorage);
    await provider.deleteFile(bucketId, fileId, context);
  } catch {
    // Ignore deletion errors
  }
}
