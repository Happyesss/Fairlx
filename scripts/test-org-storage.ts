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

async function run() {
    const organizationId = "69d2d018001d4f886254";
    
    const events = await databases.listDocuments(
        DATABASE_ID,
        USAGE_EVENTS_ID,
        [Query.equal("billingEntityId", organizationId), Query.equal("resourceType", "storage"), Query.limit(100)]
    );
    
    console.log("Total storage events for Org:", events.total);
    for (const d of events.documents) {
        console.log(`- WS: ${d.workspaceId}, Units: ${d.units} on ${d.timestamp}`);
    }
}
run();
