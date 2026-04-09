/**
 * Appwrite Storage Provider (Adapter)
 *
 * Wraps the existing Appwrite Storage SDK to conform to the StorageProvider interface.
 * This is the default / contributor-friendly provider that requires no extra setup.
 */
import "server-only";

import type { Storage as AppwriteStorage } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import type { StorageProvider, StorageFile } from "./types";

export class AppwriteStorageProvider implements StorageProvider {
  readonly provider = "appwrite" as const;

  constructor(private storage: AppwriteStorage) {}

  async uploadFile(
    bucketId: string,
    fileId: string,
    file: File | Buffer,
    _metadata?: { fileName?: string; mimeType?: string }
  ): Promise<StorageFile> {
    // Appwrite SDK v14 requires InputFile for all uploads
    let inputFile: ReturnType<typeof InputFile.fromBuffer>;

    if (file instanceof File) {
      // Convert web-standard File to Buffer for InputFile
      const arrayBuffer = await file.arrayBuffer();
      inputFile = InputFile.fromBuffer(Buffer.from(arrayBuffer), file.name);
    } else {
      inputFile = InputFile.fromBuffer(file, _metadata?.fileName || fileId);
    }

    const result = await this.storage.createFile(bucketId, fileId, inputFile);

    return {
      id: result.$id,
      name: (file instanceof File) ? file.name : (_metadata?.fileName || fileId),
      sizeBytes: (file instanceof File) ? file.size : (file as Buffer).length,
      mimeType: (file instanceof File) ? file.type : (_metadata?.mimeType || "application/octet-stream"),
    };
  }

  async getFileView(bucketId: string, fileId: string): Promise<Buffer> {
    const result = await this.storage.getFileView(bucketId, fileId);
    // Appwrite returns ArrayBuffer
    return Buffer.from(result);
  }

  async getFilePreview(
    bucketId: string,
    fileId: string,
    width?: number,
    height?: number,
    gravity?: string,
    quality?: number,
  ): Promise<ArrayBuffer> {
    // Use Appwrite's native getFilePreview which supports image transformations
    return await this.storage.getFilePreview(
      bucketId,
      fileId,
      width,
      height,
      gravity as Parameters<AppwriteStorage['getFilePreview']>[4],
      quality,
    );
  }

  async deleteFile(bucketId: string, fileId: string, _context?: { workspaceId?: string; sizeBytes?: number }): Promise<void> {
    await this.storage.deleteFile(bucketId, fileId);
  }

  async listFiles(
    bucketId: string,
    queries?: string[]
  ): Promise<{ total: number; files: { sizeBytes: number }[] }> {
    const result = await this.storage.listFiles(bucketId, queries);
    return {
      total: result.total,
      files: result.files.map((f) => ({ sizeBytes: f.sizeOriginal })),
    };
  }

  getPublicUrl(bucketId: string, fileId: string): string | null {
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT;
    if (!endpoint || !projectId) return null;

    return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${projectId}`;
  }
}
