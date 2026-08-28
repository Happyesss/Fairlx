import { Databases, IndexType, Permission, Role } from 'node-appwrite';
import {
    ensureCollection,
    ensureStringAttribute,
    ensureIndex,
    sleep,
} from '../lib/db-helpers';
import { logger } from '../lib/logger';

const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_ORGANIZATION_AUDIT_LOGS_ID || 'organization_audit_logs';
const COLLECTION_NAME = 'Organization Audit Logs';

export async function setupOrganizationAuditLogs(databases: Databases, databaseId: string): Promise<void> {
    logger.collection(COLLECTION_NAME);

    await ensureCollection(databases, databaseId, COLLECTION_ID, COLLECTION_NAME, [
        Permission.read(Role.any()),
    ]);

    // Live collection is workspace-style (userId/action/resourceType + required workspaceId).
    // App reads/writes via adapters in src/features/organizations/lib/audit-log-schema.ts.
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'organizationId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'workspaceId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'projectId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'userId', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'userName', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'action', 256, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'resourceType', 128, true);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'resourceId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'resourceName', 512, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'metadata', 65535, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'ipAddress', 64, false);

    // Optional app-schema fields. Additive only — do not require them, live already has required workspace fields.
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'actorUserId', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'actionType', 256, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'timestamp', 32, false);
    await ensureStringAttribute(databases, databaseId, COLLECTION_ID, 'userAgent', 512, false);

    await sleep(2000);

    // Indexes
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'organizationId_idx', IndexType.Key, ['organizationId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'userId_idx', IndexType.Key, ['userId']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'action_idx', IndexType.Key, ['action']);
    await ensureIndex(databases, databaseId, COLLECTION_ID, 'timestamp_idx', IndexType.Key, ['timestamp']);
}
