import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureFloatAttribute,
    ensureEnumAttribute,
    ensureDatetimeAttribute,
    ensureIndex,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_WALLETS_ID || 'wallets';
const COLLECTION_NAME = 'Wallets';

/**
 * Setup Wallets Collection
 * 
 * Aligned with Wallet type in src/features/wallet/types.ts
 */
export async function setupWallets(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    // Attributes
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'billingAccountId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'userId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'organizationId', 256, false);
    await ensureFloatAttribute(databases, databaseId, COLLECTION_ID, 'balance', false, 0);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'currency', 8, false, 'USD');
    await ensureFloatAttribute(databases, databaseId, COLLECTION_ID, 'lockedBalance', false, 0);
    await ensureEnumAttribute(databases, databaseId, COLLECTION_ID, 'status', ['active', 'frozen', 'closed'], false, 'active');
    await ensureFloatAttribute(databases, databaseId, COLLECTION_ID, 'version', false, 0);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'lastTopUpAt', false);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'lastDeductionAt', false);

    // Legacy/Analytics Attributes
    await ensureFloatAttribute(databases, databaseId, COLLECTION_ID, 'lifetimeTopUp', false, 0);
    await ensureFloatAttribute(databases, databaseId, COLLECTION_ID, 'lifetimeDeducted', false, 0);
    await ensureFloatAttribute(databases, databaseId, COLLECTION_ID, 'dailyTopUpTotal', false, 0);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'dailyTopUpDate', 16, false);

    await sleep(2000);

    // Indexes
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'billingAccountId_idx', IndexType.Unique, ['billingAccountId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'userId_idx', IndexType.Key, ['userId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'organizationId_idx', IndexType.Key, ['organizationId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'status_idx', IndexType.Key, ['status']);
}
