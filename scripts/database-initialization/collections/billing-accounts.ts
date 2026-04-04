import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureEnumAttribute,
    ensureBooleanAttribute,
    ensureDatetimeAttribute,
    ensureIndex,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_BILLING_ACCOUNTS_ID || 'billing_accounts';
const COLLECTION_NAME = 'Billing Accounts';

/**
 * Setup Billing Accounts Collection
 * 
 * Aligned with BillingAccount type in src/features/billing/types.ts
 */
export async function setupBillingAccounts(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    // Attributes
    await ensureEnumAttribute(databases, databaseId, COLLECTION_ID, 'type', ['PERSONAL', 'ORG'], true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'userId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'organizationId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'cashfreeCustomerId', 256, false);
    await ensureEnumAttribute(databases, databaseId, COLLECTION_ID, 'billingStatus', ['ACTIVE', 'DUE', 'SUSPENDED'], false, 'ACTIVE');
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'billingCycleStart', false);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'billingCycleEnd', false);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'gracePeriodEnd', false);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'lastPaymentAt', false);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'lastPaymentFailedAt', false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'billingEmail', 256, false);
    await ensureBooleanAttribute(databases, databaseId, COLLECTION_ID, 'isBillingCycleLocked', false, false);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'billingCycleLockedAt', false);
    await ensureEnumAttribute(databases, databaseId, COLLECTION_ID, 'deploymentTier', ['FAIRLX_CLOUD', 'BYOB', 'SELF_HOSTED'], false, 'FAIRLX_CLOUD');

    // Legacy/Polymorphic support (optional but kept for internal logic consistency)
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'ownerId', 256, false);
    await ensureEnumAttribute(databases, databaseId, COLLECTION_ID, 'ownerType', ['personal', 'organization'], false);

    await sleep(2000);

    // Indexes
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'type_idx', IndexType.Key, ['type']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'userId_idx', IndexType.Key, ['userId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'organizationId_idx', IndexType.Key, ['organizationId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'cashfreeCustomerId_idx', IndexType.Key, ['cashfreeCustomerId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'billingStatus_idx', IndexType.Key, ['billingStatus']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'ownerId_idx', IndexType.Key, ['ownerId']);
}
