import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Client, Databases, Query } from "node-appwrite";

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!)
    .setKey(process.env.NEXT_APPWRITE_KEY!);

const databases = new Databases(client);

async function run() {
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "fairlx";
    const evtId = process.env.NEXT_PUBLIC_APPWRITE_USAGE_EVENTS_ID || "usage_events";

    console.log("Fetching old AI compute events...");
    let hasMore = true;
    let deleted = 0;
    while(hasMore) {
        const events = await databases.listDocuments(dbId, evtId, [
            Query.equal("resourceType", "compute"),
            Query.equal("source", "ai"),
            Query.limit(100)
        ]);

        if (events.documents.length === 0) {
            hasMore = false;
            break;
        }

        for (const evt of events.documents) {
            // Delete all old AI usage events
            await databases.deleteDocument(dbId, evtId, evt.$id);
            deleted++;
        }
    }
    
    console.log(`Deleted ${deleted} old AI compute events.`);
}

run().catch(console.error);
