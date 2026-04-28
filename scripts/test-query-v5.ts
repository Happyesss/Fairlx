import { Client, Databases, Query } from "node-appwrite";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!)
    .setKey(process.env.NEXT_APPWRITE_KEY!);

const databases = new Databases(client);

async function run() {
    try {
        const events = await databases.listDocuments(
            process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
            process.env.NEXT_PUBLIC_APPWRITE_USAGE_EVENTS_ID!,
            [Query.equal("billingEntityId", "69d2d018001d4f886254")]
        );
        console.log("Events found for Org:", events.total);
    } catch (e) {
        console.log("Query Failed:", e.message);
    }
}
run();
