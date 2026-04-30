import { Client, Databases, Query } from "node-appwrite";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!)
    .setKey(process.env.NEXT_APPWRITE_KEY!);

const databases = new Databases(client);

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const USAGE_EVENTS_ID = process.env.NEXT_PUBLIC_APPWRITE_USAGE_EVENTS_ID!;
const USAGE_AGGREGATIONS_ID = process.env.NEXT_PUBLIC_APPWRITE_USAGE_AGGREGATIONS_ID!;

async function run() {
    const organizationId = "69d2d018001d4f886254";
    const monthStart = "2026-04-01T00:00:00.000Z";
    
    console.log("Fetching events for org:", organizationId);
    
    const events = await databases.listDocuments(
        DATABASE_ID,
        USAGE_EVENTS_ID,
        [Query.equal("billingEntityId", organizationId), Query.greaterThanEqual("timestamp", monthStart), Query.limit(5000)]
    );
    
    console.log("Total events found:", events.total);
    
    let storageAvgGB = 0;
    let storageTotalUnits = 0;
    
    for (const event of events.documents) {
        if (event.resourceType === "storage") {
            const gb = event.units / (1024 * 1024 * 1024);
            storageAvgGB += gb;
            storageTotalUnits += event.units;
            console.log(`Found storage event: ${event.units} units (${gb} GB) on ${event.timestamp}`);
        }
    }
    
    console.log("Calculated Storage Avg GB:", storageAvgGB);
    console.log("Calculated Storage Total Units:", storageTotalUnits);
}
run();
