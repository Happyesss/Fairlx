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
    const evtId = process.env.NEXT_PUBLIC_APPWRITE_USAGE_EVENTS_ID || "usage_events";

    console.log("Fetching current aggregations...");
    const aggs = await databases.listDocuments(dbId, aggId, [Query.limit(100)]);
    
    for (const agg of aggs.documents) {
        console.log(`Recalculating aggregation for workspace ${agg.workspaceId}, period ${agg.period}`);
        
        // Find all non-AI compute events for this period
        const startOfMonth = `${agg.period}-01T00:00:00.000Z`;
        const nextMonth = new Date(agg.period + "-01");
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const endOfMonth = nextMonth.toISOString();

        const events = await databases.listDocuments(dbId, evtId, [
            Query.equal("workspaceId", agg.workspaceId),
            Query.equal("resourceType", "compute"),
            Query.notEqual("source", "ai"),
            Query.greaterThanEqual("timestamp", startOfMonth),
            Query.lessThan("timestamp", endOfMonth),
            Query.limit(5000)
        ]);

        let computeTotalUnits = 0;
        for (const evt of events.documents) {
            computeTotalUnits += evt.weightedUnits || evt.units || 0;
        }

        console.log(`  -> Old compute: ${agg.computeTotalUnits}, New compute: ${computeTotalUnits}`);
        
        if (agg.computeTotalUnits !== computeTotalUnits) {
            await databases.updateDocument(dbId, aggId, agg.$id, {
                computeTotalUnits
            });
            console.log("  -> Updated.");
        } else {
            console.log("  -> No change needed.");
        }
    }
    console.log("Done.");
}

run().catch(console.error);
