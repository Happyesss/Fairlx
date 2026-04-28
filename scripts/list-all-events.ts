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

    console.log("Listing all events...");
    const events = await databases.listDocuments(dbId, evtId, [
        Query.limit(100),
        Query.orderDesc("timestamp")
    ]);

    for (const evt of events.documents) {
        console.log(`Event ${evt.$id}: type=${evt.resourceType}, source=${evt.source}, units=${evt.units}, timestamp=${evt.timestamp}`);
    }
}

run().catch(console.error);
