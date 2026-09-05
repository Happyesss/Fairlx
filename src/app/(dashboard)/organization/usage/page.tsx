import { redirect } from "next/navigation";
import { getCurrent } from "@/features/auth/queries";
import { OrganizationUsageDashboardClient } from "./usage-dashboard-client";
import { requireOrganizationMembership } from "@/features/organizations/lib/require-org-account";

/**
 * Organization-level Usage Dashboard
 * 
 * Accessible at /organization/usage
 * Shows aggregated usage across all workspaces in the organization.
 */
export default async function OrganizationUsagePage() {
    const user = await getCurrent();

    if (!user) {
        redirect("/sign-in");
    }

    await requireOrganizationMembership(user);

    return <OrganizationUsageDashboardClient />;
}
