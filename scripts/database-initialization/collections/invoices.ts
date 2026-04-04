import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureEnumAttribute,
    ensureFloatAttribute,
    ensureDatetimeAttribute,
    ensureIndex,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_INVOICES_ID || 'invoices';
const COLLECTION_NAME = 'Billing Invoices';

/**
 * Setup Invoices Collection
 * 
 * Aligned with BillingInvoice type in src/features/billing/types.ts
 */
export async function setupInvoices(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    // Attributes
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'invoiceId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'billingAccountId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'billingEntityId', 256, false);
    await ensureEnumAttribute(databases, databaseId, COLLECTION_ID, 'billingEntityType', ['user', 'organization'], false);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'cycleStart', false);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'cycleEnd', false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'usageBreakdown', 65535, false);
    await ensureFloatAttribute(databases, databaseId, COLLECTION_ID, 'amount', true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'currency', 8, false, 'INR');
    await ensureEnumAttribute(databases, databaseId, COLLECTION_ID, 'status', ['DRAFT', 'DUE', 'PAID', 'FAILED'], false, 'DRAFT');
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'dueDate', false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'cashfreePaymentId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'walletTransactionId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'failureReason', 1024, false);
    await ensureFloatAttribute(databases, databaseId, COLLECTION_ID, 'retryCount', false, 0);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'paidAt', false);

    // Context attributes from routes
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'workspaceId', 256, false);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'createdAt', false);

    // Legacy/Migration attributes
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'issuedAt', false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'lineItems', 65535, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'pdfUrl', 1024, false);

    await sleep(2000);

    // Indexes
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'invoiceId_idx', IndexType.Unique, ['invoiceId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'billingAccountId_idx', IndexType.Key, ['billingAccountId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'billingEntityId_idx', IndexType.Key, ['billingEntityId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'workspaceId_idx', IndexType.Key, ['workspaceId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'status_idx', IndexType.Key, ['status']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'createdAt_idx', IndexType.Key, ['createdAt']);
}
