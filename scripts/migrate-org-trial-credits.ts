import { Client, Databases, Query } from "node-appwrite";
import dotenv from "dotenv";
import path from "path";
import { createRequire } from "module";

// Mock server-only for standalone script execution
const require = createRequire(import.meta.url);
try {
    const Module = require("module");
    const originalRequire = Module.prototype.require;
    Module.prototype.require = function(id: string) {
        if (id === "server-only") return {};
        return originalRequire.apply(this, arguments);
    };
} catch (e) {
    // Fallback if the above hack fails
}


// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT!;
const API_KEY = process.env.APPWRITE_API_KEY!;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const ORGANIZATIONS_ID = process.env.NEXT_PUBLIC_APPWRITE_ORGANIZATIONS_ID!;
const WALLETS_ID = process.env.NEXT_PUBLIC_APPWRITE_WALLETS_ID!;

const TRIAL_CREDIT_DAYS = 60;
const DEFAULT_TRIAL_CREDIT = 30; // Updated to match the new $30 standard

/**
 * Migration Script: Trial Credits
 * 
 * Orgs created < 60 days ago: Receive $60 credit, trial expires 60 days from creation
 * Orgs created >= 60 days ago: Receive $1 credit, trial immediately expired
 */
async function run() {
    console.log("🚀 Starting organization trial credit migration...\n");

    const { createAdminClient } = await import("../src/lib/appwrite");
    const { databases } = await createAdminClient();

    // Dynamic imports for the services we need
    const { getOrCreateWallet, creditTrialToWallet } = await import("../src/features/wallet/services/wallet-service");
    const TRIAL_CREDIT_USD = DEFAULT_TRIAL_CREDIT;

    let cursor: string | undefined;
    let processedCount = 0;
    let skippedCount = 0;
    let oldOrgCount = 0;
    let newOrgCount = 0;

    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - TRIAL_CREDIT_DAYS);

    while (true) {
        const queries = [Query.limit(100), Query.orderAsc("$createdAt")];
        if (cursor) {
            queries.push(Query.cursorAfter(cursor));
        }

        const orgs = await databases.listDocuments(
            DATABASE_ID,
            ORGANIZATIONS_ID,
            queries
        );

        if (orgs.documents.length === 0) {
            break;
        }

        for (const org of orgs.documents) {
            // Check if already processed
            if (org.trialCreditGranted === true) {
                console.log(`[SKIP] Org ${org.$id} already has trialCreditGranted=true`);
                skippedCount++;
                continue;
            }

            try {
                // Ensure wallet exists
                const wallet = await getOrCreateWallet(databases, {
                    organizationId: org.$id,
                });

                const createdAt = new Date(org.$createdAt);
                const isOldOrg = createdAt < cutoffDate;

                const amount = isOldOrg ? 1 : TRIAL_CREDIT_USD; // $1 for old, $30 for new
                const description = isOldOrg 
                    ? `Legacy migration credit — $1.00`
                    : `Welcome trial credit — $${TRIAL_CREDIT_USD} free for ${TRIAL_CREDIT_DAYS} days`;
                
                // Expiry date is 60 days from creation
                const expiresAt = new Date(createdAt);
                expiresAt.setDate(expiresAt.getDate() + TRIAL_CREDIT_DAYS);

                // Apply credit
                const creditResult = await creditTrialToWallet(
                    databases,
                    wallet.$id,
                    amount,
                    {
                        organizationId: org.$id,
                        description,
                        trialExpiresAt: expiresAt,
                    }
                );

                if (creditResult.success) {
                    // Update org document
                    await databases.updateDocument(
                        DATABASE_ID,
                        ORGANIZATIONS_ID,
                        org.$id,
                        {
                            trialCreditGranted: true,
                            trialCreditExpiresAt: expiresAt.toISOString(),
                            isTrialExpired: isOldOrg, // Old orgs are immediately marked expired
                        }
                    );

                    console.log(`[OK] Org ${org.$id} | Amount: $${amount} | isOld: ${isOldOrg}`);
                    if (isOldOrg) oldOrgCount++;
                    else newOrgCount++;
                    processedCount++;
                } else {
                    console.error(`[ERROR] Org ${org.$id} | Failed to credit wallet: ${creditResult.error}`);
                }
            } catch (error) {
                console.error(`[ERROR] Org ${org.$id} | Exception:`, error);
            }
        }

        cursor = orgs.documents[orgs.documents.length - 1].$id;
    }

    console.log("\n✅ Migration complete!");
    console.log(`Total processed: ${processedCount}`);
    console.log(`  - Old orgs ($1): ${oldOrgCount}`);
    console.log(`  - New orgs ($60): ${newOrgCount}`);
    console.log(`Total skipped: ${skippedCount}`);
}

run().catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
});
