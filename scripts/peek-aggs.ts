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
    const aggId = "usage_aggregations";

    console.log("Fetching aggregations...");
    const aggs = await databases.listDocuments(dbId, aggId, [Query.limit(10)]);
    console.log(`Total aggregations found: ${aggs.total}`);
    for (const agg of aggs.documents) {
        console.log(JSON.stringify({ id: agg.$id, period: agg.period, compute: agg.computeTotalUnits }));
    }
}

run().catch(console.error);
