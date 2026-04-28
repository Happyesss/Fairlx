import { Client, Databases, Query } from "node-appwrite";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!)
    .setKey(process.env.NEXT_APPWRITE_KEY!);

const databases = new Databases(client);

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const USAGE_EVENTS_ID = process.env.NEXT_PUBLIC_APPWRITE_USAGE_EVENTS_ID!;

async function run() {
    const workspaceId = "69d2d0270019d2bc661d"; // Stemlen
    
    const events = await databases.listDocuments(
        DATABASE_ID,
        USAGE_EVENTS_ID,
        [Query.equal("workspaceId", workspaceId), Query.equal("resourceType", "storage"), Query.limit(100)]
    );
    
    console.log("All storage events for Stemlen:", events.total);
    for (const d of events.documents) {
        console.log(`- ${d.units} units on ${d.timestamp} (ID: ${d.$id}, billingId: ${d.billingEntityId})`);
    }
}
run();
