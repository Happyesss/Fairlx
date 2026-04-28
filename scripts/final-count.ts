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
    const res = await databases.listDocuments(dbId, evtId, [
        Query.equal("resourceType", "compute"),
        Query.limit(1)
    ]);
    console.log(`Total compute events (Appwrite count): ${res.total}`);
}

run().catch(console.error);
