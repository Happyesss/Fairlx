"use client";

import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Wallet, DollarSign, FileText, ExternalLink, Calendar, Loader2, CheckCircle2, AlertTriangle, Info, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { toast } from "sonner";
import Link from "next/link";
import Script from "next/script";

import { cn } from "@/lib/utils";
import { useGetOrganization } from "../api/use-get-organization";
import { useGetOrgMembers } from "../api/use-get-org-members";
import { useUpdateOrganization } from "../api/use-update-organization";
import { useGetInvoices } from "@/features/usage/api";

import {
    useGetBillingAccount,
    useGetBillingStatus,
    useSetupBilling
} from "@/features/billing/api";
import { BillingStatus, BillingAccountType } from "@/features/billing/types";
import { BillingWarningBanner } from "@/features/billing/components/billing-warning-banner";
import { useCurrentUserOrgPermissions } from "@/features/org-permissions/api/use-current-user-permissions";
import { OrgPermissionKey } from "@/features/org-permissions/types";
import { client } from "@/lib/rpc";



interface OrganizationBillingSettingsProps {
    organizationId: string;
    organizationName: string;
}

export function OrganizationBillingSettings({
    organizationId,
    organizationName,
}: OrganizationBillingSettingsProps) {
    const { data: organization, isLoading: isOrgLoading } = useGetOrganization({ orgId: organizationId });
    const queryClient = useQueryClient();
    const { data: membersDoc } = useGetOrgMembers({ organizationId });
    const { data: invoicesDoc, isLoading: isInvoicesLoading } = useGetInvoices({
        organizationId,
        limit: 10
    });
    const { mutate: updateOrganization } = useUpdateOrganization();

    const { hasPermission: hasOrgPermission } = useCurrentUserOrgPermissions({ orgId: organizationId });
    const canManageBilling = hasOrgPermission(OrgPermissionKey.BILLING_MANAGE);

    const { data: billingAccountData, isLoading: isBillingLoading } = useGetBillingAccount({
        organizationId,
        enabled: !!organizationId
    });
    const { data: billingStatus } = useGetBillingStatus({
        organizationId,
        enabled: !!organizationId
    });
    const { mutateAsync: setupBilling } = useSetupBilling();

    const [billingEmailValue, setBillingEmailValue] = useState("");
    const [alternativeEmailValue, setAlternativeEmailValue] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isAddingCredits, setIsAddingCredits] = useState(false);
    const [isScriptLoaded, setIsScriptLoaded] = useState(false);
    const [topupAmount, setTopupAmount] = useState("");

    useEffect(() => {
        if (organization) {
            try {
                const settings = organization.billingSettings ? JSON.parse(organization.billingSettings) : {};
                setBillingEmailValue(settings.primaryEmail || "");
                setAlternativeEmailValue(settings.alternativeEmail || "");
            } catch {
                // ignore
            }
        }
    }, [organization]);

    const ownerEmail = membersDoc?.documents.find(m => m.role === "OWNER")?.email;
    const billingAccount = billingAccountData?.data;
    const invoices = invoicesDoc?.documents || [];
    const isLoading = isOrgLoading || isBillingLoading;
    const walletBalance = billingAccountData?.walletBalance ?? 0;
    const walletCurrency = billingAccountData?.walletCurrency ?? "USD";

    const handleSaveBillingSettings = useCallback(async () => {
        if (!organizationId) { toast.error("Organization ID is required"); return; }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (billingEmailValue && !emailRegex.test(billingEmailValue)) {
            toast.error("Please enter a valid primary email address"); return;
        }
        if (alternativeEmailValue && !emailRegex.test(alternativeEmailValue)) {
            toast.error("Please enter a valid alternative email address"); return;
        }

        setIsSaving(true);
        const settings = { primaryEmail: billingEmailValue || ownerEmail, alternativeEmail: alternativeEmailValue };
        updateOrganization({ organizationId, billingSettings: JSON.stringify(settings) }, {
            onSuccess: () => { toast.success("Billing settings updated successfully!"); setIsSaving(false); },
            onError: () => { toast.error("Failed to save billing settings"); setIsSaving(false); }
        });
    }, [organizationId, billingEmailValue, alternativeEmailValue, ownerEmail, updateOrganization]);

    const handleAddCredits = useCallback(async () => {
        if (!organizationId) { toast.error("Organization ID is required"); return; }
        const amount = Number(topupAmount);
        if (!amount || amount < 1) { toast.error("Minimum top-up amount is $1"); return; }
        if (!isScriptLoaded) { toast.error("Payment system not ready. Please refresh the page."); return; }

        setIsAddingCredits(true);
        try {
            if (!billingAccountData?.data) {
                try {
                    await setupBilling({ json: {
                        type: BillingAccountType.ORG,
                        organizationId,
                        billingEmail: billingEmailValue || organization?.email || ownerEmail || undefined,
                        contactName: organization?.name || "Organization Admin",
                    }});
                } catch {
                    toast.error("Failed to initialize billing account. Please contact support.");
                    setIsAddingCredits(false); return;
                }
            }

            const orderResponse = await client.api.wallet["create-order"].$post({ json: { amount, organizationId } });
            if (!orderResponse.ok) {
                const errorData = await orderResponse.json().catch(() => ({}));
                throw new Error((errorData as { error?: string }).error || "Failed to create order");
            }

            const orderResult = await orderResponse.json() as {
                data: { orderId: string; paymentSessionId: string; key: string; amount: number; currency: string; environment: "sandbox" | "production"; walletId: string; originalUsdCents: number; exchangeRate: number; }
            };
            const orderData = orderResult.data;
            const cashfree = window.Cashfree({ mode: (orderData.environment || "sandbox") as "sandbox" | "production" });
            const checkoutResult = await cashfree.checkout({ paymentSessionId: orderData.paymentSessionId, redirectTarget: "_modal" });

            if (checkoutResult.error) {
                if (!checkoutResult.error.message?.includes("user")) {
                    toast.error(`Payment error: ${checkoutResult.error.message || "Unknown error"}`);
                }
            } else {
                try {
                    const verifyResponse = await client.api.wallet["verify-topup"].$post({ json: { cashfreeOrderId: orderData.orderId } });
                    if (!verifyResponse.ok) {
                        const errorData = await verifyResponse.json().catch(() => ({}));
                        const errorMsg = (errorData as { error?: string }).error || "Verification failed";
                        if (errorMsg.includes("ACTIVE")) {
                            toast.info("Payment is being processed. Your wallet will be credited shortly via webhook.");
                        } else {
                            throw new Error(errorMsg);
                        }
                    } else {
                        toast.success(`$${amount} added to your wallet successfully!`);
                        queryClient.invalidateQueries({ queryKey: ["billing-account"] });
                        queryClient.invalidateQueries({ queryKey: ["billing-status"] });
                        setTopupAmount("");
                    }
                } catch (verifyError) {
                    const msg = verifyError instanceof Error ? verifyError.message : "Verification failed";
                    toast.error(`Payment issue: ${msg}. Your wallet will be credited via webhook if payment succeeded.`);
                }
            }
            setIsAddingCredits(false);
        } catch {
            toast.error("Failed to initialize payment. Please try again.");
            setIsAddingCredits(false);
        }
    }, [organizationId, isScriptLoaded, billingAccountData?.data, billingEmailValue, organization?.email, organization?.name, ownerEmail, setupBilling, topupAmount, queryClient]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading billing settings...</p>
            </div>
        );
    }

    return (
        <>
            <Script
                src="https://sdk.cashfree.com/js/v3/cashfree.js"
                onLoad={() => setIsScriptLoaded(true)}
                onError={() => { /* ignore */ }}
            />

            <div className="flex flex-col gap-10">
                {billingStatus?.status === BillingStatus.DUE && (
                    <BillingWarningBanner
                        billingStatus={BillingStatus.DUE}
                        daysUntilSuspension={billingStatus.daysUntilSuspension}
                        organizationId={organizationId}
                    />
                )}

                {/* ── Billing Overview ── */}
                <section>
                    <h2 className="text-[18px] font-semibold mb-1">Billing</h2>
                    <p className="text-xs text-muted-foreground mb-6">Organization-level billing information and settings</p>

                    {billingStatus?.status === BillingStatus.SUSPENDED && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                <strong>Account Suspended</strong> — Your organization has been suspended due to an unpaid invoice.
                                Please update your payment method below to restore access.
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="divide-y divide-border">
                        {/* Billing Lifecycle */}
                        <div className="flex flex-col pt-4 pb-8 gap-4">
                            <div className="shrink-0">
                                <p className="text-sm font-medium">Billing Lifecycle</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Timeline of your billing activity</p>
                            </div>
                            <div className="rounded-lg border border-border p-5 bg-muted/30 relative overflow-hidden w-full max-w-xl">
                                <div className="relative pl-6 gap-5 flex flex-col">
                                    <div className="absolute left-[7px]  top-2 bottom-2 w-[2px] bg-primary/20" />
                                    <div className="relative">
                                        <div className="absolute -left-[23px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-background bg-muted-foreground/40 z-10" />
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-muted-foreground">Personal Account Usage</span>
                                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 uppercase tracking-wider font-bold">Historic</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">All activity prior to organization creation.</p>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute -left-[23px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-background bg-blue-600 z-10 shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Organization Managed Billing</span>
                                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 uppercase tracking-wider font-bold bg-blue-100 text-blue-700">Active</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Started {organization?.billingStartAt ? format(new Date(organization.billingStartAt), "PPP") : "on creation"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Billing Entity */}
                        <div className="flex flex-col py-8 gap-4">
                            <div className="shrink-0">
                                <p className="text-sm font-medium">Billing Entity</p>
                                <p className="text-xs text-muted-foreground mt-0.5">All workspaces in this organization share billing</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Input value={organization?.name || organizationName} disabled className="w-fit h-8 text-sm" />
                                <Badge  variant="secondary">Organization</Badge>
                            </div>
                        </div>

                        {/* Status */}
                        <div className="flex flex-col py-8 gap-4">
                            <div className="shrink-0">
                                <p className="text-sm font-medium">Billing Status</p>
                                {billingAccount?.billingCycleEnd && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Next billing: {format(new Date(billingAccount.billingCycleEnd), "PPP")}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge
                                    variant={billingStatus?.status === BillingStatus.ACTIVE ? "default" : billingStatus?.status === BillingStatus.DUE ? "secondary" : "destructive"}
                                    className={cn(
                                        billingStatus?.status === BillingStatus.ACTIVE && "bg-green-100 text-green-700",
                                        billingStatus?.status === BillingStatus.DUE && "bg-orange-100 text-orange-700"
                                    )}
                                >
                                    {billingStatus?.status || "ACTIVE"}
                                </Badge>
                                {billingStatus?.status === BillingStatus.DUE && billingStatus.daysUntilSuspension !== undefined && (
                                    <span className="text-xs text-orange-600">
                                        ({billingStatus.daysUntilSuspension} days until suspension)
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Primary Billing Email */}
                        <div className="flex flex-col py-8 gap-4">
                            <div className="shrink-0">
                                <p className="text-sm font-medium">Primary Billing Email</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {billingEmailValue ? "Custom billing email active" : `Default: ${ownerEmail || "owner email"}`}
                                </p>
                            </div>
                            <Input
                                id="billingEmail"
                                type="email"
                                value={billingEmailValue}
                                onChange={(e) => setBillingEmailValue(e.target.value)}
                                placeholder={ownerEmail || "owner@example.com"}
                                disabled={isSaving || !canManageBilling}
                                className="w-6/12 h-8 text-sm rounded-md border border-border bg-transparent px-2 shadow-none focus-visible:ring-0 focus-visible:border-primary"
                            />
                        </div>

                        {/* Alternative Email */}
                        <div className="flex flex-col py-8 gap-4">
                            <div className="shrink-0">
                                <p className="text-sm font-medium">Alternative Billing Email</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Optional secondary contact for billing notifications</p>
                            </div>
                            <Input
                                id="alternativeEmail"
                                type="email"
                                value={alternativeEmailValue}
                                onChange={(e) => setAlternativeEmailValue(e.target.value)}
                                placeholder="finance@company.com"
                                disabled={isSaving || !canManageBilling}
                                className="w-6/12 h-8 text-sm rounded-md border border-border bg-transparent px-2 shadow-none focus-visible:ring-0 focus-visible:border-primary"
                            />
                        </div>
                    </div>

                    {canManageBilling && (
                        <div className="w-full flex justify-end pt-4">
                            <Button onClick={handleSaveBillingSettings} disabled={isSaving} size="xs">
                                {isSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                                Save Billing Settings
                            </Button>
                        </div>
                    )}
                </section>

                {/* ── Wallet ── */}
                <section>
                    <h2 className="text-[18px] font-semibold mb-1 flex items-center gap-2">
                        <Wallet className="h-5 w-5" />
                        Wallet
                    </h2>
                    <p className="text-xs text-muted-foreground mb-6">
                        Manage your organization&apos;s Fairlx wallet for usage billing
                    </p>

                    <Alert className="mb-4">
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                            <strong>How wallet billing works:</strong> Usage costs are deducted from your wallet balance.
                            Add credits anytime via UPI, Card, or Net Banking. No recurring mandates needed.
                        </AlertDescription>
                    </Alert>

                    <div className="divide-y divide-border">
                        {/* Balance display */}
                        <div className="flex flex-col py-4 gap-4">
                            <div className="shrink-0">
                                <p className="text-sm font-medium">Available Balance</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Current wallet credit balance</p>
                            </div>
                            <div className="relative overflow-hidden rounded-xl border-none shadow-xl bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 p-6 text-white w-full max-w-sm">
                                <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                                <div className="relative">
                                    <span className="text-blue-200 text-xs uppercase tracking-widest font-bold">Total Balance</span>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-4xl font-extrabold tracking-tighter">
                                            {new Intl.NumberFormat("en-US", {
                                                style: "currency",
                                                currency: walletCurrency,
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 6,
                                            }).format(walletBalance)}
                                        </span>
                                        <span className="text-blue-200 font-medium uppercase">{walletCurrency}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-3 text-xs text-blue-100/80 bg-white/10 w-fit px-2.5 py-1 rounded-full">
                                        {walletBalance > 0 ? (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                        ) : (
                                            <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                                        )}
                                        {walletBalance > 0 ? "Good Standing" : "Top-up Required"}
                                    </div>
                                </div>
                            </div>
                            {walletBalance < 100 && (
                                <Alert className="border-orange-200 bg-orange-50 max-w-sm">
                                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                                    <AlertDescription className="text-orange-700 text-xs">
                                        Wallet balance is low. Add credits to avoid service interruptions.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>

                        {/* Add Credits */}
                        <div className="flex flex-col py-8   gap-4">
                            <div className="shrink-0">
                                <p className="text-sm font-medium">Add Credits</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Top up your wallet via UPI, Card, or Net Banking</p>
                            </div>
                            <div className="flex items-end gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="topup-amount" className="text-xs font-medium">Amount (USD)</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            id="topup-amount"
                                            type="number"
                                            min="1"
                                            className="pl-7 h-8 w-32 text-sm"
                                            placeholder="100"
                                            value={topupAmount}
                                            onChange={(e) => setTopupAmount(e.target.value)}
                                            disabled={isAddingCredits || !canManageBilling}
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[5, 10, 25, 50, 100].map((amt) => (
                                            <Button
                                                key={amt}
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setTopupAmount(String(amt))}
                                                disabled={isAddingCredits || !canManageBilling}
                                                className={cn(
                                                    "h-7 px-2.5 text-xs",
                                                    topupAmount === String(amt) && "border-primary bg-primary/10 text-primary"
                                                )}
                                            >
                                                ${amt}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <Button
                                    onClick={handleAddCredits}
                                    disabled={isAddingCredits || !topupAmount || Number(topupAmount) < 1 || !canManageBilling}
                                    size="xs"
                                    className="gap-1.5"
                                >
                                    {isAddingCredits ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Plus className="h-3.5 w-3.5" />
                                    )}
                                    {isAddingCredits ? "Processing..." : `Add $${topupAmount || "0"}`}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Info className="h-3 w-3" />
                                Payments processed securely by Cashfree. Minimum $1.
                            </p>
                        </div>
                    </div>
                </section>

                {/* ── Invoice History ── */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-[18px] font-semibold">Invoices</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">View and download past invoices</p>
                        </div>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                            <Link href="/organization/settings/billing?tab=invoices">
                                View All
                                <ExternalLink className="h-3 w-3" />
                            </Link>
                        </Button>
                    </div>

                    {isInvoicesLoading ? (
                        <div className="border rounded-lg overflow-hidden">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center gap-4 px-4 py-3 border-b">
                                    <div className="flex-1 space-y-1">
                                        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                                        <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                                    </div>
                                    <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                                    <div className="h-6 w-12 bg-muted animate-pulse rounded" />
                                </div>
                            ))}
                        </div>
                    ) : invoices.length === 0 ? (
                        <div className="text-center py-10 border rounded-lg border-dashed">
                            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                            <p className="text-sm text-muted-foreground">No invoices yet</p>
                            <p className="text-xs text-muted-foreground mt-1">Invoices are generated at the end of each billing cycle.</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/30 border-b text-xs font-medium text-muted-foreground">
                                <div className="flex-1">Invoice ID</div>
                                <div className="w-32">Date</div>
                                <div className="w-24 text-right">Amount</div>
                                <div className="w-20">Status</div>
                                <div className="w-20 text-right">Actions</div>
                            </div>
                            <div className="divide-y divide-border">
                                {invoices.map((invoice) => (
                                    <div key={invoice.$id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                                        <div className="flex-1 flex items-center gap-2.5 min-w-0">
                                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-sm font-medium truncate">{invoice.invoiceId}</span>
                                        </div>
                                        <div className="w-32 shrink-0 text-xs text-muted-foreground flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {format(new Date(invoice.createdAt), "MMM d, yyyy")}
                                        </div>
                                        <div className="w-24 shrink-0 text-sm font-semibold text-right">
                                            {new Intl.NumberFormat("en-US", {
                                                style: "currency",
                                                currency: "USD",
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 6,
                                            }).format(invoice.totalCost)}
                                        </div>
                                        <div className="w-20 shrink-0">
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-[10px] h-5 px-1.5 uppercase",
                                                    invoice.status === "paid" && "bg-emerald-100 text-emerald-700 border-emerald-200",
                                                    invoice.status === "draft" && "bg-muted text-muted-foreground"
                                                )}
                                            >
                                                {invoice.status}
                                            </Badge>
                                        </div>
                                        <div className="w-20 shrink-0 flex justify-end">
                                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                                                Download
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between mt-6 pt-4 border-t">
                        <p className="text-sm font-medium">View Detailed Usage</p>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                            <Link href="/organization/usage">
                                <DollarSign className="h-3.5 w-3.5" />
                                Usage Dashboard
                            </Link>
                        </Button>
                    </div>
                </section>
            </div>
        </>
    );
}
