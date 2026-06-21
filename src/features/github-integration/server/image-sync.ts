import { ID, Storage } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { IMAGES_BUCKET_ID } from "@/config";

/**
 * Downloads a private asset from GitHub using the provided access token,
 * handles redirection correctly without credentials leaks (crucial for Amazon S3),
 * uploads the asset to Appwrite Storage, and returns the public view URL.
 */
async function fetchAndUploadPrivateGitHubAsset(
  url: string,
  accessToken: string | undefined,
  storage: Storage
): Promise<string | null> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    let response = await fetch(url, {
      headers,
      redirect: "manual",
    });

    // Handle redirection (e.g. to S3) manually without carrying over the auth header
    if (response.status >= 300 && response.status < 400) {
      const redirectUrl = response.headers.get("Location");
      if (redirectUrl) {
        console.log(`[GitHub Image Sync] Redirecting to: ${redirectUrl}`);
        response = await fetch(redirectUrl, {
          redirect: "follow",
        });
      }
    }

    if (!response.ok) {
      console.error(`[GitHub Image Sync] Failed to fetch private asset from URL: ${url}. Status: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine extension
    let extension = "png";
    if (contentType.includes("jpeg")) extension = "jpg";
    else if (contentType.includes("gif")) extension = "gif";
    else if (contentType.includes("webp")) extension = "webp";
    else if (contentType.includes("svg")) extension = "svg";

    const fileId = ID.unique();
    const fileName = `github-asset-${fileId}.${extension}`;

    console.log(`[GitHub Image Sync] Uploading image to Appwrite. Bucket ID: ${IMAGES_BUCKET_ID}, File ID: ${fileId}`);
    
    // Upload to Appwrite
    const inputFile = InputFile.fromBuffer(buffer, fileName);
    await storage.createFile(IMAGES_BUCKET_ID, fileId, inputFile);

    // Build the public view URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const publicUrl = `${appUrl}/api/storage/images/${fileId}`;
    
    console.log(`[GitHub Image Sync] Uploaded successfully: ${publicUrl}`);
    return publicUrl;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[GitHub Image Sync] Error downloading/uploading asset ${url}:`, errorMessage);
    return null;
  }
}

/**
 * Parses markdown description/body, extracts private/restricted GitHub images,
 * downloads and uploads them to Appwrite, and returns the modified markdown.
 */
export async function replaceGitHubImagesInMarkdown(
  body: string | null | undefined,
  accessToken: string | undefined,
  storage: Storage
): Promise<string> {
  if (!body) return body || "";

  // Matches markdown image URLs pointing to GitHub or private user images
  const GITHUB_IMAGE_URL_REGEX = /(https?:\/\/github\.com\/[^\s\)\"\'>]+?(?:\/(?:assets|user-attachments\/assets)\/[a-zA-Z0-9\-]+|\.(?:png|jpg|jpeg|gif|webp)(?:\?[^\s\)\"\'>]*)?)|https?:\/\/private-user-images\.githubusercontent\.com\/[^\s\)\"\'>]+)/gi;

  const matches = body.match(GITHUB_IMAGE_URL_REGEX);
  if (!matches || matches.length === 0) {
    return body;
  }

  // Deduplicate matches to prevent fetching the same image multiple times
  const uniqueUrls = [...new Set(matches)];
  let updatedBody = body;

  for (const url of uniqueUrls) {
    const publicUrl = await fetchAndUploadPrivateGitHubAsset(url, accessToken, storage);
    if (publicUrl) {
      updatedBody = updatedBody.replaceAll(url, publicUrl);
    }
  }

  return updatedBody;
}
