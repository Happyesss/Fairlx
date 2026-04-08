import { Storage, Client } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT;
const key = process.env.NEXT_APPWRITE_KEY;
const bucketId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_DOCS_BUCKET_ID;

async function testUpload() {
  if (!endpoint || !project || !key || !bucketId) {
    console.error("Missing config:", { endpoint, project, key, bucketId });
    return;
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(project)
    .setKey(key);

  const storage = new Storage(client);

  try {
    console.log("Testing upload to bucket:", bucketId);
    
    // Create a dummy buffer
    const buffer = Buffer.from("test content");
    const fileId = "test_file_" + Date.now();
    
    // Attempt upload with InputFile (correct way in v14)
    console.log("Attempting upload with InputFile...");
    const result = await storage.createFile(
      bucketId,
      fileId,
      InputFile.fromBuffer(buffer, "test.txt")
    );
    
    console.log("Upload success:", result.$id);
    
    // Delete it
    await storage.deleteFile(bucketId, result.$id);
    console.log("Cleanup success.");
  } catch (error: any) {
    console.error("Upload failed:", error.message, error.response);
  }
}

testUpload();
