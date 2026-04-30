import { Client, Databases, Query } from "node-appwrite";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT!;
const API_KEY = process.env.NEXT_APPWRITE_KEY || process.env.APPWRITE_API_KEY!;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const ORGANIZATIONS_ID = process.env.NEXT_PUBLIC_APPWRITE_ORGANIZATIONS_ID!;
const WALLETS_ID = process.env.NEXT_PUBLIC_APPWRITE_WALLETS_ID!;
const WALLET_TRANSACTIONS_ID = process.env.NEXT_PUBLIC_APPWRITE_WALLET_TRANSACTIONS_ID!;

async function check() {
    const client = new Client()
        .setEndpoint(ENDPOINT)
        .setProject(PROJECT_ID)
        .setKey(API_KEY);

    const databases = new Databases(client);

    console.log("🔍 Checking wallet for poisonword.com...");

    const orgs = await databases.listDocuments(
        DATABASE_ID,
        ORGANIZATIONS_ID,
        [Query.equal("name", "poisonword.com")]
    );

    if (orgs.total === 0) {
        console.log("❌ Organization not found.");
        return;
    }

    const orgId = orgs.documents[0].$id;
    console.log(`Found Org ID: ${orgId}`);

    const wallets = await databases.listDocuments(
        DATABASE_ID,
        WALLETS_ID,
        [Query.equal("organizationId", orgId)]
    );

    if (wallets.total === 0) {
        console.log("❌ Wallet not found.");
        return;
    }

    const wallet = wallets.documents[0];
    console.log(`Found Wallet ID: ${wallet.$id}`);
    console.log(`Current Balance: ${wallet.balance}`);

    const transactions = await databases.listDocuments(
        DATABASE_ID,
        WALLET_TRANSACTIONS_ID,
        [Query.equal("walletId", wallet.$id), Query.orderDesc("$createdAt"), Query.limit(100)]
    );

    console.log("\n📜 Transactions:");
    transactions.documents.forEach(t => {
        console.log(`- [${t.$createdAt}] ${t.type} | Amount: ${t.amount} | Description: ${t.description}`);
    });
}

check();
