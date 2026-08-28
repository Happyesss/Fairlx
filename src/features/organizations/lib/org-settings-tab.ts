export const ORG_SETTINGS_TABS = [
    "general",
    "members",
    "security",
    "departments",
    "billing",
    "audit",
    "rewards",
] as const;

export type OrgSettingsTab = (typeof ORG_SETTINGS_TABS)[number];

export const ORG_BILLING_SETTINGS_PATH = "/organization/settings/billing";
export const ORG_INVOICES_VIEW_ALL_HREF = `${ORG_BILLING_SETTINGS_PATH}?tab=invoices`;
export const ORG_INVOICE_PREVIEW_LIMIT = 10;
export const ORG_INVOICE_FULL_LIMIT = 100;

export function isOrgSettingsTab(value: string): value is OrgSettingsTab {
    return (ORG_SETTINGS_TABS as readonly string[]).includes(value);
}

/**
 * Resolve the organization settings tab from a dedicated billing path
 * and/or `?tab=` query. `tab=invoices` is a billing subsection, not a tab.
 */
export function resolveOrgSettingsTab(input: {
    pathname?: string | null;
    searchTab?: string | null;
    defaultTab?: string | null;
}): { tab: OrgSettingsTab; showAllInvoices: boolean } {
    const searchTab = (input.searchTab ?? "").trim().toLowerCase();
    const defaultTab = (input.defaultTab ?? "").trim().toLowerCase();
    const pathname = input.pathname ?? "";

    if (searchTab === "invoices" || defaultTab === "invoices") {
        return { tab: "billing", showAllInvoices: true };
    }

    if (isOrgSettingsTab(searchTab)) {
        return { tab: searchTab, showAllInvoices: false };
    }

    if (pathname.includes(ORG_BILLING_SETTINGS_PATH)) {
        return { tab: "billing", showAllInvoices: false };
    }

    if (isOrgSettingsTab(defaultTab)) {
        return { tab: defaultTab, showAllInvoices: false };
    }

    return { tab: "general", showAllInvoices: false };
}
