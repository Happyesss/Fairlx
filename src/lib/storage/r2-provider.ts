/**
 * Cloudflare R2 Storage Provider
 * 
 * Uses the S3-compatible API to interact with Cloudflare R2.
 * All "bucket IDs" from Appwrite are mapped to key prefixes within a single R2 bucket.
 * 
 * Key format: {prefix}/{fileId}
 * Example: attachments/abc123 or images/def456
 */
import "server-only";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

import type { StorageProvider, StorageFile } from "./types";

// Mapping from Appwrite bucket IDs to R2 key prefixes
const BUCKET_PREFIX_MAP: Record<string, string> = {
  // These will be resolved at runtime from env vars
  // Default sensible prefixes
  "attachments_bucket": "attachments",
  "project-docs": "project-docs",
  // For images bucket, we'll use the env var value as key too
};

/**
 * Resolves an Appwrite bucket ID to an R2 key prefix.
 * Uses the bucket ID itself as the prefix if no mapping exists.
 */
function resolvePrefix(bucketId: string): string {
  return BUCKET_PREFIX_MAP[bucketId] || bucketId;
}

/**
 * Builds the full R2 object key from bucket + file ID.
 */
function buildKey(bucketId: string, fileId: string): string {
  const prefix = resolvePrefix(bucketId);
  return `${prefix}/${fileId}`;
}

let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (_s3Client) return _s3Client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY."
    );
  }

  _s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return _s3Client;
}

function getBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error("R2_BUCKET_NAME is not configured.");
  }
  return bucket;
}

export class R2StorageProvider implements StorageProvider {
  readonly provider = "r2" as const;

  async uploadFile(
    bucketId: string,
    fileId: string,
    file: File | Buffer,
    metadata?: { fileName?: string; mimeType?: string }
  ): Promise<StorageFile> {
    const client = getS3Client();
    const bucket = getBucketName();
    const key = buildKey(bucketId, fileId);

    let body: Buffer;
    let mimeType: string;
    let fileName: string;
    let size: number;

    if (file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      body = Buffer.from(arrayBuffer);
      mimeType = file.type || "application/octet-stream";
      fileName = file.name;
      size = file.size;
    } else {
      body = file;
      mimeType = metadata?.mimeType || "application/octet-stream";
      fileName = metadata?.fileName || fileId;
      size = file.length;
    }

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
        Metadata: {
          "original-name": encodeURIComponent(fileName),
          "mime-type": mimeType,
        },
      })
    );

    // BILLING FIX: Emit a STORAGE usage event for R2 uploads.
    // Without this, workspaces using R2 show 0 storage in the usage dashboard
    // because only Appwrite-native storage emits these events automatically.
    // Fire-and-forget — never block the upload response.
    if (metadata && (metadata as Record<string, unknown>).workspaceId) {
      const workspaceId = (metadata as Record<string, unknown>).workspaceId as string;
      setImmediate(async () => {
        try {
          const { createAdminClient } = await import("@/lib/appwrite");
          const { databases } = await createAdminClient();
          const { logStorageUsage } = await import("@/lib/usage-metering");
          await logStorageUsage({
            databases,
            workspaceId,
            units: size,
            operation: "upload",
            fileId,
            metadata: { fileName, fileType: mimeType, bucketId },
          });
        } catch {
          // Never let billing errors affect storage operations
        }
      });
    }

    return {
      id: fileId,
      name: fileName,
      sizeBytes: size,
      mimeType,
    };
  }

  async getFileView(bucketId: string, fileId: string): Promise<Buffer> {
    const client = getS3Client();
    const bucket = getBucketName();
    const key = buildKey(bucketId, fileId);

    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    if (!response.Body) {
      throw new Error(`File not found: ${key}`);
    }

    // Convert readable stream to buffer
    const chunks: Uint8Array[] = [];
    const stream = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async getFilePreview(
    bucketId: string,
    fileId: string,
    _width?: number,
    _height?: number,
    _gravity?: string,
    _quality?: number,
  ): Promise<ArrayBuffer> {
    // R2 does not support server-side image transformations.
    // Return the raw file and let the client handle resize.
    // For production, you could integrate Cloudflare Images or Workers for transforms.
    const buffer = await this.getFileView(bucketId, fileId);
    return new Uint8Array(buffer).buffer as ArrayBuffer;
  }

  async deleteFile(bucketId: string, fileId: string, context?: { workspaceId?: string; sizeBytes?: number }): Promise<void> {
    const client = getS3Client();
    const bucket = getBucketName();
    const key = buildKey(bucketId, fileId);

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    // BILLING FIX: Emit a negative STORAGE usage event for R2 deletes.
    // Negative units = storage released, which correctly reduces the running total.
    if (context?.workspaceId) {
      setImmediate(async () => {
        try {
          const { createAdminClient } = await import("@/lib/appwrite");
          const { databases } = await createAdminClient();
          const { logStorageUsage } = await import("@/lib/usage-metering");
          await logStorageUsage({
            databases,
            workspaceId: context.workspaceId!,
            units: -(context.sizeBytes || 0), // Negative = storage freed
            operation: "delete",
            fileId,
            metadata: { bucketId },
          });
        } catch {
          // Never let billing errors affect storage operations
        }
      });
    }
  }

  async listFiles(
    bucketId: string,
    _queries?: string[]
  ): Promise<{ total: number; files: { sizeBytes: number }[] }> {
    const client = getS3Client();
    const bucket = getBucketName();
    const prefix = resolvePrefix(bucketId) + "/";

    const files: { sizeBytes: number }[] = [];
    let continuationToken: string | undefined;

    // Paginate through all objects with this prefix
    do {
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        })
      );

      if (response.Contents) {
        for (const obj of response.Contents) {
          files.push({ sizeBytes: obj.Size || 0 });
        }
      }

      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return { total: files.length, files };
  }

  getPublicUrl(bucketId: string, fileId: string): string | null {
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!publicUrl) return null;

    const key = buildKey(bucketId, fileId);
    return `${publicUrl}/${key}`;
  }
}
