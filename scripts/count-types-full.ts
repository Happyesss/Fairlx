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

    console.log("Counting all resource types...");
    let offset = 0;
    const counts: Record<string, number> = {};
    while(true) {
        const res = await databases.listDocuments(dbId, evtId, [Query.limit(1000), Query.offset(offset)]);
        if (res.documents.length === 0) break;
        for (const doc of res.documents) {
            const type = String(doc.resourceType);
            counts[type] = (counts[type] || 0) + 1;
        }
        offset += 1000;
        if (offset >= res.total) break;
    }
    console.log("Final counts:", counts);
}

run().catch(console.error);
