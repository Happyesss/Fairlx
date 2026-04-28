import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Client, Databases, Query } from "node-appwrite";

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!)
    .setKey(process.env.NEXT_APPWRITE_KEY!);

const databases = new Databases(client);

async function run() {
    const dbId = "fairlx";
    const evtId = "usage_events";

    console.log("Fetching first 5 events...");
    const evts = await databases.listDocuments(dbId, evtId, [Query.limit(5)]);
    for (const evt of evts.documents) {
        console.log(JSON.stringify({ id: evt.$id, type: evt.resourceType, source: evt.source, units: evt.units }));
    }
}

run().catch(console.error);
