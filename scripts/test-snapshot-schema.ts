import { Client, Databases, Query } from "node-appwrite";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!)
    .setKey(process.env.NEXT_APPWRITE_KEY!);

const databases = new Databases(client);

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const STORAGE_SNAPSHOTS_ID = process.env.NEXT_PUBLIC_APPWRITE_STORAGE_SNAPSHOTS_ID!;

async function run() {
    const snapshots = await databases.listDocuments(
        DATABASE_ID,
        STORAGE_SNAPSHOTS_ID,
        [Query.limit(1)]
    );
    console.log("Snapshot Sample:", JSON.stringify(snapshots.documents[0], null, 2));
}
run();
