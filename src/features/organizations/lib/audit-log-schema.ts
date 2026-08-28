/**
 * Live Appwrite adapters for organization_audit_logs.
 *
 * Production collection is workspace-style:
 *   organizationId, workspaceId, projectId, userId, userName, action,
 *   resourceType, resourceId, resourceName, metadata, ipAddress
 *
 * App code historically used:
 *   actorUserId, actionType, timestamp, userAgent
 *
 * Reads map live docs onto the UI shape. Writes include live required
 * fields and optional app fields, then retry with live-only keys.
 */

export const LIVE_ORG_AUDIT_LOG_ATTRIBUTE_KEYS = [
    "organizationId",
    "workspaceId",
    "projectId",
    "userId",
    "userName",
    "action",
    "resourceType",
    "resourceId",
    "resourceName",
    "metadata",
    "ipAddress",
] as const;

export interface OrgAuditLogWriteInput {
    organizationId: string;
    actorUserId: string;
    actionType: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
}

export interface NormalizedOrgAuditLog {
    $id: string;
    organizationId: string;
    actorUserId: string;
    actionType: string;
    metadata: Record<string, unknown>;
    timestamp: string;
    ipAddress?: string;
    userAgent?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function asString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

export function parseOrgAuditMetadata(raw: unknown): Record<string, unknown> {
    if (!raw) {
        return {};
    }

    if (typeof raw === "object" && !Array.isArray(raw)) {
        return raw as Record<string, unknown>;
    }

    if (typeof raw !== "string") {
        return {};
    }

    const trimmed = raw.trim();
    if (!trimmed) {
        return {};
    }

    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        return { value: trimmed };
    }

    return {};
}

export function getOrgAuditActorUserId(doc: unknown): string {
    const record = asRecord(doc);
    if (!record) {
        return "";
    }
    return asString(record.actorUserId) || asString(record.userId);
}

export function getOrgAuditActionType(doc: unknown): string {
    const record = asRecord(doc);
    if (!record) {
        return "";
    }
    return asString(record.actionType) || asString(record.action);
}

export function getOrgAuditTimestamp(doc: unknown): string {
    const record = asRecord(doc);
    if (!record) {
        return "";
    }
    return asString(record.timestamp) || asString(record.$createdAt);
}

export function normalizeOrgAuditLog(doc: unknown): NormalizedOrgAuditLog | null {
    const record = asRecord(doc);
    if (!record) {
        return null;
    }

    const id = asString(record.$id);
    if (!id) {
        return null;
    }

    const ipAddress = asString(record.ipAddress);
    const userAgent = asString(record.userAgent);

    return {
        $id: id,
        organizationId: asString(record.organizationId),
        actorUserId: getOrgAuditActorUserId(record),
        actionType: getOrgAuditActionType(record),
        metadata: parseOrgAuditMetadata(record.metadata),
        timestamp: getOrgAuditTimestamp(record),
        ...(ipAddress ? { ipAddress } : {}),
        ...(userAgent ? { userAgent } : {}),
    };
}

export function buildOrgAuditLogDocument(
    input: OrgAuditLogWriteInput
): Record<string, unknown> {
    const metadata = input.metadata ?? {};
    const workspaceId = asString(metadata.workspaceId) || input.organizationId;
    const resourceType = asString(metadata.resourceType) || "organization";
    const resourceId =
        asString(metadata.resourceId) ||
        asString(metadata.workspaceId) ||
        asString(metadata.targetUserId) ||
        asString(metadata.removedUserId);
    const resourceName =
        asString(metadata.resourceName) ||
        asString(metadata.workspaceName) ||
        asString(metadata.organizationName);
    const userName =
        asString(metadata.userName) ||
        asString(metadata.actorName) ||
        asString(metadata.removedMemberName);
    const projectId = asString(metadata.projectId);

    return {
        organizationId: input.organizationId,
        workspaceId,
        projectId: projectId || null,
        userId: input.actorUserId,
        userName: userName || null,
        action: input.actionType,
        resourceType,
        resourceId: resourceId || null,
        resourceName: resourceName || null,
        metadata: JSON.stringify(metadata),
        ipAddress: input.ipAddress || null,
        actorUserId: input.actorUserId,
        actionType: input.actionType,
        timestamp: String(Date.now()),
        userAgent: input.userAgent || null,
    };
}

export function pickLiveOrgAuditLogDocument(
    payload: Record<string, unknown>
): Record<string, unknown> {
    const live: Record<string, unknown> = {};
    for (const key of LIVE_ORG_AUDIT_LOG_ATTRIBUTE_KEYS) {
        if (key in payload) {
            live[key] = payload[key];
        }
    }
    return live;
}
