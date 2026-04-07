
import { Client, Storage } from "node-appwrite";
import { AppwriteStorageProvider } from "../src/lib/storage/appwrite-provider";
import fs from "fs";

async function test() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!)
    .setKey(process.env.APPWRITE_API_KEY!);

  const storage = new Storage(client);
  const provider = new AppwriteStorageProvider(storage);

  const bucketId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_DOCS_BUCKET_ID || "project-docs";
  const fileId = "test-file-" + Date.now();
  
  // Mock file data
  const content = Buffer.from("test content");
  
  console.log("Attempting upload to bucket:", bucketId);
  try {
    const result = await provider.uploadFile(bucketId, fileId, content);
    console.log("Upload success:", result);
  } catch (error) {
    console.error("Upload failed in provider:", error);
  }
}

test();
