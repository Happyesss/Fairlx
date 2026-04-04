/**
 * Unified Storage Interface
 * 
 * Abstracts away the differences between Appwrite Storage and Cloudflare R2.
 * The active provider is auto-detected from environment variables:
 * 
 * - If R2_ACCESS_KEY_ID is set → uses Cloudflare R2
 * - Otherwise → falls back to Appwrite Storage (contributor-friendly)
 */

export interface StorageFile {
  /** Unique file identifier (Appwrite ID or R2 key) */
  id: string;
  /** Original filename */
  name: string;
  /** Size in bytes */
  sizeBytes: number;
  /** MIME type */
  mimeType: string;
}

export interface StorageProvider {
  /** Which provider is active */
  readonly provider: "r2" | "appwrite";

  /**
   * Upload a file to the given bucket.
   * @returns The file identifier (Appwrite file ID or R2 object key)
   */
  uploadFile(
    bucketId: string,
    fileId: string,
    file: File | Buffer,
    metadata?: { fileName?: string; mimeType?: string }
  ): Promise<StorageFile>;

  /**
   * Download / view file contents as a Buffer.
   */
  getFileView(bucketId: string, fileId: string): Promise<Buffer>;

  /**
   * Get a preview/thumbnail of an image file (returns raw bytes).
   * Falls back to getFileView if provider doesn't support previews.
   */
  getFilePreview(
    bucketId: string,
    fileId: string,
    width?: number,
    height?: number,
    gravity?: string,
    quality?: number,
  ): Promise<ArrayBuffer>;

  /**
   * Delete a file from storage.
   * Pass context.workspaceId + context.sizeBytes to emit a billing event.
   */
  deleteFile(bucketId: string, fileId: string, context?: { workspaceId?: string; sizeBytes?: number }): Promise<void>;

  /**
   * List files in a bucket (for billing snapshots).
   */
  listFiles(
    bucketId: string,
    queries?: string[]
  ): Promise<{ total: number; files: { sizeBytes: number }[] }>;

  /**
   * Get a public URL for a file (for email templates, etc.).
   * Returns null if public URLs are not available.
   */
  getPublicUrl(bucketId: string, fileId: string): string | null;
}

/**
 * Bucket mapping from Appwrite bucket IDs to R2 bucket prefixes.
 * R2 uses a single bucket with path prefixes per logical bucket.
 */
export interface BucketMapping {
  [appwriteBucketId: string]: string; // R2 prefix
}
