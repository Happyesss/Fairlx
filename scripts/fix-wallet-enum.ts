import { Client, Databases } from "node-appwrite";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT!;
const API_KEY = process.env.NEXT_APPWRITE_KEY || process.env.APPWRITE_API_KEY!;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_WALLET_TRANSACTIONS_ID || "wallet_transactions";

async function fix() {
    const client = new Client()
        .setEndpoint(ENDPOINT)
        .setProject(PROJECT_ID)
        .setKey(API_KEY);

    const databases = new Databases(client);

    console.log("🛠  Fixing Wallet Transactions enum...");

    try {
        console.log("🗑  Deleting 'type' attribute...");
        await databases.deleteAttribute(DATABASE_ID, COLLECTION_ID, "type");
        
        console.log("⏳ Waiting for deletion to propagate...");
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log("✨ Recreating 'type' attribute with TRIAL_CREDIT...");
        await databases.createEnumAttribute(
            DATABASE_ID,
            COLLECTION_ID,
            "type",
            ['TOPUP', 'USAGE', 'REFUND', 'ADJUSTMENT', 'HOLD', 'RELEASE', 'REWARD_CREDIT', 'TRIAL_CREDIT'],
            true
        );

        console.log("✅ Enum fixed successfully!");
    } catch (error) {
        console.error("❌ Error fixing enum:", error);
    }
}

fix();
