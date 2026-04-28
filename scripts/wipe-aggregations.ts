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
    const aggId = process.env.NEXT_PUBLIC_APPWRITE_USAGE_AGGREGATIONS_ID || "usage_aggregations";

    console.log("Wiping ALL usage aggregations...");
    let hasMore = true;
    let deleted = 0;
    while(hasMore) {
        const aggs = await databases.listDocuments(dbId, aggId, [Query.limit(100)]);

        if (aggs.documents.length === 0) {
            hasMore = false;
            break;
        }

        for (const agg of aggs.documents) {
            await databases.deleteDocument(dbId, aggId, agg.$id);
            deleted++;
        }
    }
    
    console.log(`Wiped ${deleted} aggregations.`);
}

run().catch(console.error);
