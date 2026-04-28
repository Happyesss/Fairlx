import { Client, Databases, Query } from "node-appwrite";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!)
    .setKey(process.env.NEXT_APPWRITE_KEY!);

const databases = new Databases(client);

async function run() {
    const orgs = await databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        process.env.NEXT_PUBLIC_APPWRITE_ORGANIZATIONS_ID!,
        [Query.limit(5)]
    );
    console.log("Organizations:", JSON.stringify(orgs.documents.map(d => ({ id: d.$id, name: d.name })), null, 2));
}
run();
