import { Client, Databases, Query } from "node-appwrite";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!)
    .setKey(process.env.NEXT_APPWRITE_KEY!);

const databases = new Databases(client);

async function run() {
    const events = await databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        process.env.NEXT_PUBLIC_APPWRITE_USAGE_EVENTS_ID!,
        [Query.equal("resourceType", "storage"), Query.limit(5)]
    );
    console.log("Storage Events:", JSON.stringify(events.documents.map(d => ({ units: d.units, date: d.timestamp, ws: d.workspaceId })), null, 2));
}
run();
