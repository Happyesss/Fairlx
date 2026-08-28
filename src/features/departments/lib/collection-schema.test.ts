import { describe, expect, it } from "vitest";
import {
    getAssignmentMemberId,
    parseDepartmentPermissionKeys,
    serializeDepartmentPermissionKeys,
} from "./collection-schema";

describe("getAssignmentMemberId", () => {
    it("prefers memberId over orgMemberId", () => {
        expect(getAssignmentMemberId({ memberId: "m1", orgMemberId: "m2" })).toBe("m1");
    });

    it("falls back to orgMemberId", () => {
        expect(getAssignmentMemberId({ orgMemberId: "m2" })).toBe("m2");
    });
});

describe("parseDepartmentPermissionKeys", () => {
    it("reads a JSON permissions blob", () => {
        expect(parseDepartmentPermissionKeys({
            permissions: JSON.stringify(["BILLING_VIEW", "MEMBERS_VIEW"]),
        })).toEqual(["BILLING_VIEW", "MEMBERS_VIEW"]);
    });

    it("reads a permissionKey document", () => {
        expect(parseDepartmentPermissionKeys({ permissionKey: "DEPARTMENTS_MANAGE" }))
            .toEqual(["DEPARTMENTS_MANAGE"]);
    });

    it("reads comma-separated permissions", () => {
        expect(parseDepartmentPermissionKeys({ permissions: "BILLING_VIEW, MEMBERS_VIEW" }))
            .toEqual(["BILLING_VIEW", "MEMBERS_VIEW"]);
    });

    it("reads Appwrite documents that only share $id fields", () => {
        expect(parseDepartmentPermissionKeys({
            $id: "perm_1",
            $collectionId: "department_permissions",
            permissions: JSON.stringify(["BILLING_VIEW"]),
        })).toEqual(["BILLING_VIEW"]);
    });

    it("returns an empty list for non-objects", () => {
        expect(parseDepartmentPermissionKeys(null)).toEqual([]);
        expect(parseDepartmentPermissionKeys(undefined)).toEqual([]);
    });
});

describe("serializeDepartmentPermissionKeys", () => {
    it("writes a JSON array", () => {
        expect(serializeDepartmentPermissionKeys(["BILLING_VIEW"]))
            .toBe(JSON.stringify(["BILLING_VIEW"]));
    });
});
