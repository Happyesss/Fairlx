import { Client, Databases, Query } from "node-appwrite";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT!;
const API_KEY = process.env.NEXT_APPWRITE_KEY || process.env.APPWRITE_API_KEY!;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const WALLETS_ID = process.env.NEXT_PUBLIC_APPWRITE_WALLETS_ID!;

async function reset() {
    const client = new Client()
        .setEndpoint(ENDPOINT)
        .setProject(PROJECT_ID)
        .setKey(API_KEY);

    const databases = new Databases(client);

    console.log("🧹 Resetting wallet balances to $60 for affected orgs...");

    // Find wallets with balance > 100 (assuming they were double credited)
    // In our case, we know there are 5.
    const wallets = await databases.listDocuments(
        DATABASE_ID,
        WALLETS_ID,
        [Query.greaterThan("balance", 100)]
    );

    for (const wallet of wallets.documents) {
        console.log(`Resetting wallet ${wallet.$id} balance from ${wallet.balance} to 60.00...`);
        await databases.updateDocument(
            DATABASE_ID,
            WALLETS_ID,
            wallet.$id,
            { balance: 60.00 }
        );
    }

    console.log("✅ Reset complete!");
}

reset();
