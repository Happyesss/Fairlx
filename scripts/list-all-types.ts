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

    console.log("Listing all resource types...");
    const evts = await databases.listDocuments(dbId, evtId, [Query.limit(1000)]);
    const types = new Set();
    for (const evt of evts.documents) {
        types.add(evt.resourceType);
    }
    console.log("Found types:", Array.from(types));
}

run().catch(console.error);
