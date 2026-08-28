/**
 * Live Appwrite collection adapters for departments.
 *
 * org_member_departments: organizationId, memberId, departmentId
 * department_permissions: organizationId, departmentId, permissions (JSON array blob)
 *
 * API clients still send orgMemberId / permissionKey.
 */

export function getAssignmentMemberId(assignment: {
    memberId?: string;
    orgMemberId?: string;
}): string {
    return assignment.memberId || assignment.orgMemberId || "";
}

export function parseDepartmentPermissionKeys(doc: {
    permissionKey?: string;
    permissions?: unknown;
}): string[] {
    if (typeof doc.permissionKey === "string" && doc.permissionKey.length > 0) {
        return [doc.permissionKey];
    }

    const raw = doc.permissions;
    if (Array.isArray(raw)) {
        return raw.filter((key): key is string => typeof key === "string" && key.length > 0);
    }

    if (typeof raw !== "string") {
        return [];
    }

    const trimmed = raw.trim();
    if (!trimmed) {
        return [];
    }

    if (trimmed.startsWith("[")) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.filter((key): key is string => typeof key === "string" && key.length > 0);
            }
        } catch {
            // Fall through to comma / single-key parsing
        }
    }

    if (trimmed.includes(",")) {
        return trimmed.split(",").map((key) => key.trim()).filter(Boolean);
    }

    return [trimmed];
}

export function serializeDepartmentPermissionKeys(keys: string[]): string {
    return JSON.stringify(keys);
}
