import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureEnumAttribute,
    ensureFloatAttribute,
    ensureIndex,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_WALLET_TRANSACTIONS_ID || 'wallet_transactions';
const COLLECTION_NAME = 'Wallet Transactions';

/**
 * Setup Wallet Transactions Collection
 * 
 * Immutable ledger of all wallet operations.
 * Aligned with WalletTransaction type in src/features/wallet/types.ts
 * 
 * Fields written by topUpWallet / deductFromWallet / holdFunds / releaseFunds:
 * - walletId, type, amount, direction, balanceBefore, balanceAfter,
 *   currency, referenceId, idempotencyKey, signature, description, metadata
 */
export async function setupWalletTransactions(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    // Core Attributes
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'walletId', 256, true);
    await ensureEnumAttribute(databases, databaseId, COLLECTION_ID, 'type',
        ['TOPUP', 'USAGE', 'REFUND', 'ADJUSTMENT', 'HOLD', 'RELEASE', 'REWARD_CREDIT', 'TRIAL_CREDIT'], true);
    await ensureFloatAttribute(databases, databaseId, COLLECTION_ID, 'amount', true);
    await ensureEnumAttribute(databases, databaseId, COLLECTION_ID, 'direction', ['credit', 'debit'], true);

    // Balance tracking
    await ensureFloatAttribute(databases, databaseId, COLLECTION_ID, 'balanceBefore', false);
    await ensureFloatAttribute(databases, databaseId, COLLECTION_ID, 'balanceAfter', false);

    // Currency
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'currency', 8, false, 'USD');

    // References & Idempotency
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'referenceId', 512, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'idempotencyKey', 256, false);

    // Audit
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'signature', 512, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'description', 1024, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'metadata', 8192, false);

    await sleep(2000);

    // Indexes
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'walletId_idx', IndexType.Key, ['walletId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'type_idx', IndexType.Key, ['type']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'direction_idx', IndexType.Key, ['direction']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'idempotencyKey_idx', IndexType.Unique, ['idempotencyKey']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'referenceId_idx', IndexType.Key, ['referenceId']);
}
