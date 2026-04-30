import { Client, Databases } from "node-appwrite";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT!;
const API_KEY = process.env.NEXT_APPWRITE_KEY || process.env.APPWRITE_API_KEY!;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const ORGANIZATIONS_ID = process.env.NEXT_PUBLIC_APPWRITE_ORGANIZATIONS_ID!;

async function fixLegal(orgId: string) {
    const client = new Client()
        .setEndpoint(ENDPOINT)
        .setProject(PROJECT_ID)
        .setKey(API_KEY);

    const databases = new Databases(client);

    console.log(`🔍 Checking organization ${orgId}...`);

    try {
        const org = await databases.getDocument(DATABASE_ID, ORGANIZATIONS_ID, orgId);
        
        const billingSettings = {
            legal: {
                currentVersion: "v1",
                acceptedAt: new Date().toISOString(),
                acceptedBy: org.ownerId
            }
        };

        await databases.updateDocument(
            DATABASE_ID, 
            ORGANIZATIONS_ID, 
            orgId, 
            {
                billingSettings: JSON.stringify(billingSettings)
            }
        );

        console.log("✅ Organization legal status fixed successfully.");
    } catch (error) {
        console.error("❌ Failed to fix organization:", error);
    }
}

const ORG_ID = "69f2496d000667993a27";
fixLegal(ORG_ID);
