import { describe, expect, it } from "vitest";

import { AppRouteKey } from "./appRouteKeys";
import {
    mergeOwnerOrgRoutes,
    resolveClientNavRouteKeys,
    shouldResolvePersonalNavAccess,
} from "./visible-nav-routes";

describe("shouldResolvePersonalNavAccess", () => {
    it("uses org access when an organization id is present", () => {
        expect(shouldResolvePersonalNavAccess("org_1")).toBe(false);
    });

    it("falls back to personal access only when there is no organization id", () => {
        expect(shouldResolvePersonalNavAccess(undefined)).toBe(true);
        expect(shouldResolvePersonalNavAccess("")).toBe(true);
    });
});

describe("mergeOwnerOrgRoutes", () => {
    it("adds Organization for an org owner even if the server returned personal routes", () => {
        const keys = mergeOwnerOrgRoutes(
            [AppRouteKey.WORKSPACE_HOME, AppRouteKey.WORKSPACE_SETTINGS],
            { hasOrg: true, orgRole: "OWNER" },
        );
        expect(keys).toContain(AppRouteKey.ORG_DASHBOARD);
        expect(keys).toContain(AppRouteKey.ORG_MEMBERS);
    });

    it("does not add Organization for workspace members without org owner role", () => {
        const keys = mergeOwnerOrgRoutes([AppRouteKey.WORKSPACE_HOME], {
            hasOrg: true,
            orgRole: "MEMBER",
        });
        expect(keys).not.toContain(AppRouteKey.ORG_DASHBOARD);
    });
});

describe("resolveClientNavRouteKeys", () => {
    it("keeps Organization visible for owners after the access query resolves", () => {
        const keys = resolveClientNavRouteKeys({
            isLoading: false,
            serverKeys: [AppRouteKey.WORKSPACE_HOME, AppRouteKey.WORKSPACE_TASKS],
            hasOrg: true,
            orgRole: "OWNER",
        });
        expect(keys).toContain(AppRouteKey.ORG_DASHBOARD);
    });
});
