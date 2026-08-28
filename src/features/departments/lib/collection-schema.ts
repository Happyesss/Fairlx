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

export function parseDepartmentPermissionKeys(doc: unknown): string[] {
    if (!doc || typeof doc !== "object") {
        return [];
    }

    const record = doc as { permissionKey?: unknown; permissions?: unknown };

    if (typeof record.permissionKey === "string" && record.permissionKey.length > 0) {
        return [record.permissionKey];
    }

    const raw = record.permissions;
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
