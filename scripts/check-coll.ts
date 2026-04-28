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
    try {
        const col = await databases.getCollection(dbId, "usage_aggregations");
        console.log(`Collection exists: ${col.name}`);
    } catch (e) {
        console.log("Collection usage_aggregations NOT found.");
    }
}

run().catch(console.error);
