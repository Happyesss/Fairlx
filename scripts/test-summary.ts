import { Client, Databases, Query } from "node-appwrite";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!)
    .setKey(process.env.NEXT_APPWRITE_KEY!);

const databases = new Databases(client);

async function run() {
    const summaries = await databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        process.env.NEXT_PUBLIC_APPWRITE_USAGE_AGGREGATIONS_ID!,
        [Query.limit(5)]
    );
    console.log("Summaries:", JSON.stringify(summaries.documents.map(d => ({ storage: d.storageAvgGB, traffic: d.trafficTotalGB, date: d.period, ws: d.workspaceId })), null, 2));
}
run();
