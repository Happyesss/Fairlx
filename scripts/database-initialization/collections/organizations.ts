import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureEnumAttribute,
    ensureIntegerAttribute,
    ensureDatetimeAttribute,
    ensureBooleanAttribute,
    ensureIndex,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_ORGANIZATIONS_ID || 'organizations';
const COLLECTION_NAME = 'Organizations';

export async function setupOrganizations(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    // Attributes
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'name', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'ownerId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'createdBy', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'imageUrl', 1024, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'domain', 256, false);
    await ensureEnumAttribute(databases, databaseId, COLLECTION_ID, 'plan', ['free', 'starter', 'pro', 'enterprise'], false, 'free');
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'billingAccountId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'settings', 4096, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'billingSettings', 4096, false);
    await ensureIntegerAttribute(databases, databaseId, COLLECTION_ID, 'memberCount', false, 1);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'billingStartAt', false);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'deletedAt', false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'deletedBy', 256, false);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'billingFrozenAt', false);

    // Trial credit tracking
    await ensureBooleanAttribute(databases, databaseId, COLLECTION_ID, 'trialCreditGranted', false, false);
    await ensureDatetimeAttribute(databases, databaseId, COLLECTION_ID, 'trialCreditExpiresAt', false);
    await ensureBooleanAttribute(databases, databaseId, COLLECTION_ID, 'isTrialExpired', false, false);

    await sleep(2000);

    // Indexes
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'ownerId_idx', IndexType.Key, ['ownerId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'domain_idx', IndexType.Key, ['domain']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'createdBy_idx', IndexType.Key, ['createdBy']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'trialCreditGranted_idx', IndexType.Key, ['trialCreditGranted']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'trialCreditExpiresAt_idx', IndexType.Key, ['trialCreditExpiresAt']);
}
