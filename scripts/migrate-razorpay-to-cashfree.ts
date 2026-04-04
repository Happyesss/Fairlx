#!/usr/bin/env tsx
/**
 * Razorpay → Cashfree Database Migration Script
 * 
 * Migrates existing Appwrite database collections from Razorpay-specific
 * attribute names to Cashfree equivalents.
 * 
 * WHAT IT DOES:
 * 1. billing_accounts: razorpayCustomerId → cashfreeCustomerId, drops razorpayMandateId
 * 2. wallet_transactions: razorpayPaymentId → cashfreePaymentId
 * 3. invoices: razorpayPaymentId → cashfreePaymentId
 * 
 * STRATEGY: Since Appwrite doesn't support attribute renames:
 * - Create new attribute (cashfree*)
 * - Copy all existing values from old attribute (razorpay*) to new
 * - Log results (old attributes can be manually deleted after verification)
 * 
 * USAGE:
 *   npx tsx scripts/migrate-razorpay-to-cashfree.ts
 * 
 * PREREQUISITES:
 * - .env or .env.local with NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT, NEXT_APPWRITE_KEY
 * - Node.js 18+
 * 
 * SAFETY:
 * - Non-destructive: does NOT delete old attributes
 * - Idempotent: skips if new attribute already exists
 * - Logs all operations
 * 
 * AFTER RUNNING:
 * - Verify data integrity in Appwrite console
 * - Manually delete old attributes when confident
 */

import { Client, Databases, Query, IndexType } from "node-appwrite";
import dotenv from "dotenv";
import path from "path";

// Load env from project root
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// ===============================
// Configuration
// ===============================

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT!;
const API_KEY = process.env.NEXT_APPWRITE_KEY!;
const DATABASE_ID = process.env.NEXT_PUBLIC_DATABASE_ID || "main";

// Collection IDs — match your config.ts
const BILLING_ACCOUNTS_ID = process.env.BILLING_ACCOUNTS_ID || "billing_accounts";
const WALLET_TRANSACTIONS_ID = process.env.WALLET_TRANSACTIONS_ID || "wallet_transactions";
const INVOICES_ID = process.env.INVOICES_ID || "invoices";

// ===============================
// Migration Definitions
// ===============================

interface AttributeMigration {
    collectionId: string;
    collectionName: string;
    oldAttribute: string;
    newAttribute: string;
    size: number;
    required: boolean;
}

interface IndexMigration {
    collectionId: string;
    oldIndex: string;
    newIndex: string;
    newAttributes: string[];
}

const ATTRIBUTE_MIGRATIONS: AttributeMigration[] = [
    {
        collectionId: BILLING_ACCOUNTS_ID,
        collectionName: "billing_accounts",
        oldAttribute: "razorpayCustomerId",
        newAttribute: "cashfreeCustomerId",
        size: 256,
        required: false,
    },
    {
        collectionId: WALLET_TRANSACTIONS_ID,
        collectionName: "wallet_transactions",
        oldAttribute: "razorpayPaymentId",
        newAttribute: "cashfreePaymentId",
        size: 256,
        required: false,
    },
    {
        collectionId: INVOICES_ID,
        collectionName: "invoices",
        oldAttribute: "razorpayPaymentId",
        newAttribute: "cashfreePaymentId",
        size: 256,
        required: false,
    },
];

const INDEX_MIGRATIONS: IndexMigration[] = [
    {
        collectionId: BILLING_ACCOUNTS_ID,
        oldIndex: "razorpayCustomerId_idx",
        newIndex: "cashfreeCustomerId_idx",
        newAttributes: ["cashfreeCustomerId"],
    },
];

// ===============================
// Main Migration
// ===============================

async function main() {
    console.log("╔═══════════════════════════════════════════════╗");
    console.log("║  Razorpay → Cashfree Database Migration      ║");
    console.log("╚═══════════════════════════════════════════════╝");
    console.log();

    // Validate env
    if (!ENDPOINT || !PROJECT || !API_KEY) {
        console.error("❌ Missing required environment variables:");
        console.error("   NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT, NEXT_APPWRITE_KEY");
        process.exit(1);
    }

    console.log(`📡 Endpoint: ${ENDPOINT}`);
    console.log(`📁 Database: ${DATABASE_ID}`);
    console.log();

    // Initialize Appwrite client
    const client = new Client()
        .setEndpoint(ENDPOINT)
        .setProject(PROJECT)
        .setKey(API_KEY);

    const databases = new Databases(client);

    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // ── Step 1: Create new attributes ──
    console.log("━━━ Step 1: Creating new attributes ━━━");
    for (const migration of ATTRIBUTE_MIGRATIONS) {
        try {
            console.log(`  📝 ${migration.collectionName}: ${migration.oldAttribute} → ${migration.newAttribute}`);

            // Check if new attribute already exists
            try {
                await databases.getAttribute(DATABASE_ID, migration.collectionId, migration.newAttribute);
                console.log(`     ⏭️  Already exists, skipping creation`);
            } catch {
                // Attribute doesn't exist — create it
                await databases.createStringAttribute(
                    DATABASE_ID,
                    migration.collectionId,
                    migration.newAttribute,
                    migration.size,
                    migration.required
                );
                console.log(`     ✅ Created`);

                // Wait for attribute to be available (Appwrite processes async)
                console.log(`     ⏳ Waiting for attribute to be available...`);
                await waitForAttribute(databases, migration.collectionId, migration.newAttribute);
            }
        } catch (error) {
            console.error(`     ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
            totalErrors++;
        }
    }
    console.log();

    // ── Step 2: Copy data from old to new attributes ──
    console.log("━━━ Step 2: Copying data ━━━");
    for (const migration of ATTRIBUTE_MIGRATIONS) {
        try {
            console.log(`  📋 ${migration.collectionName}: Copying ${migration.oldAttribute} → ${migration.newAttribute}`);

            let offset = 0;
            const BATCH_SIZE = 100;
            let batchMigrated = 0;
            let batchSkipped = 0;

            while (true) {
                const documents = await databases.listDocuments(
                    DATABASE_ID,
                    migration.collectionId,
                    [Query.limit(BATCH_SIZE), Query.offset(offset)]
                );

                if (documents.documents.length === 0) break;

                for (const doc of documents.documents) {
                    const oldValue = (doc as Record<string, unknown>)[migration.oldAttribute];
                    const newValue = (doc as Record<string, unknown>)[migration.newAttribute];

                    // Only copy if old value exists and new value is empty
                    if (oldValue && !newValue) {
                        await databases.updateDocument(
                            DATABASE_ID,
                            migration.collectionId,
                            doc.$id,
                            { [migration.newAttribute]: oldValue }
                        );
                        batchMigrated++;
                    } else {
                        batchSkipped++;
                    }
                }

                offset += BATCH_SIZE;

                if (documents.documents.length < BATCH_SIZE) break;
            }

            console.log(`     ✅ Migrated: ${batchMigrated}, Skipped: ${batchSkipped}`);
            totalMigrated += batchMigrated;
            totalSkipped += batchSkipped;
        } catch (error) {
            console.error(`     ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
            totalErrors++;
        }
    }
    console.log();

    // ── Step 3: Create new indexes ──
    console.log("━━━ Step 3: Creating new indexes ━━━");
    for (const indexMigration of INDEX_MIGRATIONS) {
        try {
            console.log(`  🔎 ${indexMigration.newIndex}`);

            try {
                await databases.getIndex(DATABASE_ID, indexMigration.collectionId, indexMigration.newIndex);
                console.log(`     ⏭️  Already exists, skipping`);
            } catch {
                await databases.createIndex(
                    DATABASE_ID,
                    indexMigration.collectionId,
                    indexMigration.newIndex,
                    IndexType.Key,
                    indexMigration.newAttributes
                );
                console.log(`     ✅ Created`);
            }
        } catch (error) {
            console.error(`     ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
            totalErrors++;
        }
    }
    console.log();

    // ── Summary ──
    console.log("╔═══════════════════════════════════════════════╗");
    console.log("║  Migration Summary                            ║");
    console.log("╚═══════════════════════════════════════════════╝");
    console.log(`  ✅ Documents migrated: ${totalMigrated}`);
    console.log(`  ⏭️  Documents skipped:  ${totalSkipped}`);
    console.log(`  ❌ Errors:             ${totalErrors}`);
    console.log();
    console.log("⚠️  Old attributes have NOT been deleted.");
    console.log("   After verifying data integrity, manually delete:");
    console.log("   - billing_accounts.razorpayCustomerId");
    console.log("   - billing_accounts.razorpayMandateId");
    console.log("   - wallet_transactions.razorpayPaymentId");
    console.log("   - invoices.razorpayPaymentId");
    console.log("   And old index: razorpayCustomerId_idx");
}

/**
 * Wait for an Appwrite attribute to become available
 * (Appwrite creates attributes asynchronously)
 */
async function waitForAttribute(
    databases: Databases,
    collectionId: string,
    attributeKey: string,
    maxRetries = 15,
    delayMs = 2000
): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const attr = await databases.getAttribute(DATABASE_ID, collectionId, attributeKey);
            if ((attr as Record<string, unknown>).status === "available") {
                return;
            }
        } catch {
            // Attribute not yet created
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error(`Attribute ${attributeKey} did not become available after ${maxRetries * delayMs / 1000}s`);
}

// Run
main().catch((error) => {
    console.error("💥 Migration failed:", error);
    process.exit(1);
});
