import { describe, expect, it } from "vitest";
import {
    buildOrgAuditLogDocument,
    getOrgAuditActionType,
    getOrgAuditActorUserId,
    getOrgAuditTimestamp,
    LIVE_ORG_AUDIT_LOG_ATTRIBUTE_KEYS,
    normalizeOrgAuditLog,
    parseOrgAuditMetadata,
    pickLiveOrgAuditLogDocument,
} from "./audit-log-schema";

describe("parseOrgAuditMetadata", () => {
    it("parses a JSON object string", () => {
        expect(parseOrgAuditMetadata(JSON.stringify({ workspaceId: "ws_1" })))
            .toEqual({ workspaceId: "ws_1" });
    });

    it("passes object metadata through", () => {
        expect(parseOrgAuditMetadata({ fromRole: "MEMBER" })).toEqual({ fromRole: "MEMBER" });
    });

    it("returns an empty object for invalid values", () => {
        expect(parseOrgAuditMetadata(null)).toEqual({});
        expect(parseOrgAuditMetadata("")).toEqual({});
        expect(parseOrgAuditMetadata(["x"])).toEqual({});
    });
});

describe("field adapters", () => {
    it("prefers actorUserId and actionType over live aliases", () => {
        const doc = {
            actorUserId: "actor_1",
            userId: "user_1",
            actionType: "member_added",
            action: "legacy_action",
            timestamp: "1712345678901",
            $createdAt: "2024-01-01T00:00:00.000+00:00",
        };

        expect(getOrgAuditActorUserId(doc)).toBe("actor_1");
        expect(getOrgAuditActionType(doc)).toBe("member_added");
        expect(getOrgAuditTimestamp(doc)).toBe("1712345678901");
    });

    it("falls back to live collection fields", () => {
        const doc = {
            userId: "user_1",
            action: "organization_created",
            $createdAt: "2024-01-01T00:00:00.000+00:00",
        };

        expect(getOrgAuditActorUserId(doc)).toBe("user_1");
        expect(getOrgAuditActionType(doc)).toBe("organization_created");
        expect(getOrgAuditTimestamp(doc)).toBe("2024-01-01T00:00:00.000+00:00");
    });
});

describe("normalizeOrgAuditLog", () => {
    it("maps a live workspace-style document onto the UI shape", () => {
        expect(normalizeOrgAuditLog({
            $id: "log_1",
            organizationId: "org_1",
            workspaceId: "org_1",
            userId: "user_1",
            action: "member_added",
            resourceType: "organization",
            metadata: JSON.stringify({ addedUserId: "user_2" }),
            $createdAt: "2024-06-01T12:00:00.000+00:00",
        })).toEqual({
            $id: "log_1",
            organizationId: "org_1",
            actorUserId: "user_1",
            actionType: "member_added",
            metadata: { addedUserId: "user_2" },
            timestamp: "2024-06-01T12:00:00.000+00:00",
        });
    });

    it("maps an app-schema document", () => {
        expect(normalizeOrgAuditLog({
            $id: "log_2",
            organizationId: "org_1",
            actorUserId: "actor_1",
            actionType: "organization_created",
            metadata: { organizationName: "Acme" },
            timestamp: "1712345678901",
            ipAddress: "1.1.1.1",
        })).toEqual({
            $id: "log_2",
            organizationId: "org_1",
            actorUserId: "actor_1",
            actionType: "organization_created",
            metadata: { organizationName: "Acme" },
            timestamp: "1712345678901",
            ipAddress: "1.1.1.1",
        });
    });

    it("returns null for documents without an id", () => {
        expect(normalizeOrgAuditLog({ organizationId: "org_1" })).toBeNull();
        expect(normalizeOrgAuditLog(null)).toBeNull();
    });
});

describe("buildOrgAuditLogDocument", () => {
    it("writes live required fields using app-schema input", () => {
        const payload = buildOrgAuditLogDocument({
            organizationId: "org_1",
            actorUserId: "user_1",
            actionType: "organization_created",
            metadata: { organizationName: "Acme" },
        });

        expect(payload.organizationId).toBe("org_1");
        expect(payload.workspaceId).toBe("org_1");
        expect(payload.userId).toBe("user_1");
        expect(payload.action).toBe("organization_created");
        expect(payload.resourceType).toBe("organization");
        expect(payload.metadata).toBe(JSON.stringify({ organizationName: "Acme" }));
        expect(payload.actorUserId).toBe("user_1");
        expect(payload.actionType).toBe("organization_created");
        expect(typeof payload.timestamp).toBe("string");
    });

    it("keeps an explicit workspaceId from metadata", () => {
        const payload = buildOrgAuditLogDocument({
            organizationId: "org_1",
            actorUserId: "user_1",
            actionType: "workspace_created",
            metadata: {
                workspaceId: "ws_9",
                workspaceName: "Design",
                resourceType: "workspace",
            },
        });

        expect(payload.workspaceId).toBe("ws_9");
        expect(payload.resourceType).toBe("workspace");
        expect(payload.resourceId).toBe("ws_9");
        expect(payload.resourceName).toBe("Design");
    });
});

describe("pickLiveOrgAuditLogDocument", () => {
    it("strips app-schema keys that are missing from the live collection", () => {
        const live = pickLiveOrgAuditLogDocument(buildOrgAuditLogDocument({
            organizationId: "org_1",
            actorUserId: "user_1",
            actionType: "member_removed",
            metadata: { removedUserId: "user_2" },
            userAgent: "Mozilla",
        }));

        expect(Object.keys(live).sort()).toEqual([...LIVE_ORG_AUDIT_LOG_ATTRIBUTE_KEYS].sort());
        expect(live).not.toHaveProperty("actorUserId");
        expect(live).not.toHaveProperty("actionType");
        expect(live).not.toHaveProperty("timestamp");
        expect(live).not.toHaveProperty("userAgent");
        expect(live.userId).toBe("user_1");
        expect(live.action).toBe("member_removed");
    });
});
