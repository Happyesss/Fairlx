import { describe, expect, it } from "vitest";
import {
    ORG_BILLING_SETTINGS_PATH,
    ORG_INVOICE_FULL_LIMIT,
    ORG_INVOICE_PREVIEW_LIMIT,
    ORG_INVOICES_VIEW_ALL_HREF,
    resolveOrgSettingsTab,
} from "./org-settings-tab";

describe("resolveOrgSettingsTab", () => {
    it("defaults to the general tab", () => {
        expect(resolveOrgSettingsTab({})).toEqual({
            tab: "general",
            showAllInvoices: false,
        });
    });

    it("maps tab=invoices to the billing tab with the full invoice list", () => {
        expect(resolveOrgSettingsTab({ searchTab: "invoices" })).toEqual({
            tab: "billing",
            showAllInvoices: true,
        });
        expect(resolveOrgSettingsTab({ defaultTab: "Invoices" })).toEqual({
            tab: "billing",
            showAllInvoices: true,
        });
    });

    it("honors a valid ?tab= value", () => {
        expect(resolveOrgSettingsTab({ searchTab: "billing" })).toEqual({
            tab: "billing",
            showAllInvoices: false,
        });
        expect(resolveOrgSettingsTab({ searchTab: " members " })).toEqual({
            tab: "members",
            showAllInvoices: false,
        });
    });

    it("opens billing when the dedicated billing settings path is used", () => {
        expect(resolveOrgSettingsTab({
            pathname: ORG_BILLING_SETTINGS_PATH,
        })).toEqual({
            tab: "billing",
            showAllInvoices: false,
        });
    });

    it("lets tab=invoices win over the billing settings path", () => {
        expect(resolveOrgSettingsTab({
            pathname: ORG_BILLING_SETTINGS_PATH,
            searchTab: "invoices",
        })).toEqual({
            tab: "billing",
            showAllInvoices: true,
        });
    });

    it("ignores unknown tabs and falls back to general", () => {
        expect(resolveOrgSettingsTab({ searchTab: "unknown" })).toEqual({
            tab: "general",
            showAllInvoices: false,
        });
    });
});

describe("invoice view-all constants", () => {
    it("keeps the production View All URL stable", () => {
        expect(ORG_INVOICES_VIEW_ALL_HREF).toBe(
            "/organization/settings/billing?tab=invoices"
        );
        expect(ORG_INVOICE_PREVIEW_LIMIT).toBe(10);
        expect(ORG_INVOICE_FULL_LIMIT).toBe(100);
    });
});
