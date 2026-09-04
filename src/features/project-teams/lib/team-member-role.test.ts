import { describe, expect, it } from "vitest";

import { projectTeamMemberRoleFromLabel } from "./team-member-role";

describe("projectTeamMemberRoleFromLabel", () => {
    it("maps lead-like labels to lead", () => {
        expect(projectTeamMemberRoleFromLabel("Lead")).toBe("lead");
        expect(projectTeamMemberRoleFromLabel("team lead")).toBe("lead");
    });

    it("defaults to member", () => {
        expect(projectTeamMemberRoleFromLabel(undefined)).toBe("member");
        expect(projectTeamMemberRoleFromLabel("Reviewer")).toBe("member");
    });
});
