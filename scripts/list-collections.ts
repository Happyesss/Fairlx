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
    let queries = [];
    const collections = await databases.listCollections(dbId);
    console.log(`Total collections: ${collections.total}`);
    for (const col of collections.collections) {
        console.log(`Collection: ${col.name} (ID: ${col.$id})`);
    }
}

run().catch(console.error);
