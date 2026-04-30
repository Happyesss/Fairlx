import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Client, Databases } from "node-appwrite";

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!)
    .setKey(process.env.NEXT_APPWRITE_KEY!);

const databases = new Databases(client);

async function run() {
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "fairlx";
    const evtId = "usage_events";
    const aggId = "usage_aggregations";

    const evts = await databases.listDocuments(dbId, evtId, []);
    const aggs = await databases.listDocuments(dbId, aggId, []);

    console.log(`Total Usage Events: ${evts.total}`);
    console.log(`Total Usage Aggregations: ${aggs.total}`);
}

run().catch(console.error);
