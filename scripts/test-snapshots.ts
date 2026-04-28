import { Client, Databases, Query } from "node-appwrite";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!)
    .setKey(process.env.NEXT_APPWRITE_KEY!);

const databases = new Databases(client);

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const STORAGE_SNAPSHOTS_ID = process.env.NEXT_PUBLIC_APPWRITE_STORAGE_SNAPSHOTS_ID!;

async function run() {
    const workspaceId = "69d2d0270019d2bc661d"; // Stemlen
    
    const snapshots = await databases.listDocuments(
        DATABASE_ID,
        STORAGE_SNAPSHOTS_ID,
        [Query.equal("workspaceId", workspaceId), Query.orderDesc("timestamp"), Query.limit(5)]
    );
    
    console.log("Snapshots found for Stemlen:", snapshots.total);
    for (const d of snapshots.documents) {
        console.log(`- ${d.totalBytes} bytes on ${d.timestamp}`);
    }
}
run();
