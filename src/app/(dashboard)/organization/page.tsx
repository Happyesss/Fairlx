import { redirect } from "next/navigation";
import { getCurrent } from "@/features/auth/queries";
import { OrganizationSettingsClient } from "@/app/(dashboard)/workspaces/[workspaceId]/organization/client";
import { resolveOrgSettingsTab } from "@/features/organizations/lib/org-settings-tab";
import { requireOrganizationMembership } from "@/features/organizations/lib/require-org-account";

/**
 * Dashboard-level Organization Settings Page
 * 
 * This route is accessible at /organization (not workspace-scoped)
 * Allows ORG account owners/admins to manage organization settings
 * even when ZERO workspaces exist.
 * 
 * Organization is the control plane - it should never depend on workspace existence.
 */
export default async function OrganizationPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>;
}) {
    const user = await getCurrent();

    if (!user) {
        redirect("/sign-in");
    }

    await requireOrganizationMembership(user);

    const params = await searchParams;
    const { tab, showAllInvoices } = resolveOrgSettingsTab({
        searchTab: params.tab,
    });

    return (
        <OrganizationSettingsClient
            defaultTab={tab}
            showAllInvoices={showAllInvoices}
        />
    );
}
