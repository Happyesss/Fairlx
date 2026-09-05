import { redirect } from "next/navigation";
import { getCurrent } from "@/features/auth/queries";
import { OrganizationSettingsClient } from "@/app/(dashboard)/workspaces/[workspaceId]/organization/client";
import { resolveOrgSettingsTab } from "@/features/organizations/lib/org-settings-tab";
import { requireOrganizationMembership } from "@/features/organizations/lib/require-org-account";

/**
 * Organization billing settings
 *
 * Accessible at /organization/settings/billing
 * Used by invoice "View All", suspension recovery, and billing banners.
 * Organization is the control plane — this must work with zero workspaces.
 */
export default async function OrganizationBillingSettingsPage({
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
        pathname: "/organization/settings/billing",
        searchTab: params.tab,
    });

    return (
        <OrganizationSettingsClient
            defaultTab={tab}
            showAllInvoices={showAllInvoices}
        />
    );
}
