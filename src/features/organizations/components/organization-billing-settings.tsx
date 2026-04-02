"use client";

import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Wallet, DollarSign, FileText, ExternalLink, Calendar, Loader2, CheckCircle2, AlertTriangle, Info, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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

// Billing API hooks
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

    // Permission check - BILLING_MANAGE required to edit
    const { hasPermission: hasOrgPermission } = useCurrentUserOrgPermissions({ orgId: organizationId });
    const canManageBilling = hasOrgPermission(OrgPermissionKey.BILLING_MANAGE);

    // Billing hooks
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

    // Sync state with organization data
    useEffect(() => {
        if (organization) {
            try {
                const settings = organization.billingSettings ? JSON.parse(organization.billingSettings) : {};
                setBillingEmailValue(settings.primaryEmail || "");
                setAlternativeEmailValue(settings.alternativeEmail || "");
            } catch {
                // Failed to parse billing settings
            }
        }
    }, [organization]);

    // Find organization owner email
    const ownerEmail = membersDoc?.documents.find(m => m.role === "OWNER")?.email;

    // Billing account data
    const billingAccount = billingAccountData?.data;

    const invoices = invoicesDoc?.documents || [];
    const isLoading = isOrgLoading || isBillingLoading;

    // Wallet balance from billing account data
    const walletBalance = billingAccountData?.walletBalance ?? 0;
    const walletCurrency = billingAccountData?.walletCurrency ?? "USD";

    // Handler for save billing settings - must be defined before any conditional returns
    const handleSaveBillingSettings = useCallback(async () => {
        if (!organizationId) {
            toast.error("Organization ID is required");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (billingEmailValue && !emailRegex.test(billingEmailValue)) {
            toast.error("Please enter a valid primary email address");
            return;
        }

        if (alternativeEmailValue && !emailRegex.test(alternativeEmailValue)) {
            toast.error("Please enter a valid alternative email address");
            return;
        }

        setIsSaving(true);

        const settings = {
            primaryEmail: billingEmailValue || ownerEmail,
            alternativeEmail: alternativeEmailValue
        };

        updateOrganization({
            organizationId,
            billingSettings: JSON.stringify(settings)
        }, {
            onSuccess: () => {
                toast.success("Billing settings updated successfully!");
                setIsSaving(false);
            },
            onError: () => {
                toast.error("Failed to save billing settings");
                setIsSaving(false);
            }
        });
    }, [organizationId, billingEmailValue, alternativeEmailValue, ownerEmail, updateOrganization]);

    // Handler for adding credits to wallet
    const handleAddCredits = useCallback(async () => {
        if (!organizationId) {
            toast.error("Organization ID is required");
            return;
        }

        const amount = Number(topupAmount);
        if (!amount || amount < 1) {
            toast.error("Minimum top-up amount is $1");
            return;
        }

        if (!isScriptLoaded) {
            toast.error("Payment system not ready. Please refresh the page.");
            return;
        }

        setIsAddingCredits(true);

        try {
            // First ensure billing account exists
            if (!billingAccountData?.data) {
                try {
                    await setupBilling({
                        json: {
                            type: BillingAccountType.ORG,
                            organizationId,
                            billingEmail: billingEmailValue || organization?.email || ownerEmail || undefined,
                            contactName: organization?.name || "Organization Admin",
                        }
                    });
                } catch {
                    toast.error("Failed to initialize billing account. Please contact support.");
                    setIsAddingCredits(false);
                    return;
                }
            }

            // Create a Cashfree order for wallet top-up
            const orderResponse = await client.api.wallet["create-order"].$post({
                json: {
                    amount: amount * 100, // Convert dollars to cents
                    organizationId,
                },
            });

            if (!orderResponse.ok) {
                const errorData = await orderResponse.json().catch(() => ({}));
                throw new Error((errorData as { error?: string }).error || "Failed to create order");
            }

            const orderResult = await orderResponse.json() as {
                data: {
                    orderId: string;
                    paymentSessionId: string;
                    key: string;
                    amount: number;
                    currency: string;
                    environment: "sandbox" | "production";
                    walletId: string;
                    originalUsdCents: number;
                    exchangeRate: number;
                }
            };
            const orderData = orderResult.data;

            // Open Cashfree Checkout for one-time payment
            const cashfree = window.Cashfree({ 
                mode: (orderData.environment || "sandbox") as "sandbox" | "production" 
            });

            const checkoutResult = await cashfree.checkout({
                paymentSessionId: orderData.paymentSessionId,
                redirectTarget: "_modal",
            });

            // Cashfree SDK v3 modal returns { error, paymentDetails } — NOT orderStatus/transaction
            if (checkoutResult.error) {
                // User closed modal or payment error
                if (checkoutResult.error.message?.includes("user")) {
                    // User dismissed — don't show error
                } else {
                    toast.error(`Payment error: ${checkoutResult.error.message || "Unknown error"}`);
                }
            } else {
                // Modal closed without error — verify payment server-side
                // The backend fetches order status and payment details from Cashfree API directly
                try {
                    const verifyResponse = await client.api.wallet["verify-topup"].$post({
                        json: {
                            cashfreeOrderId: orderData.orderId,
                        },
                    });

                    if (!verifyResponse.ok) {
                        const errorData = await verifyResponse.json().catch(() => ({}));
                        const errorMsg = (errorData as { error?: string }).error || "Verification failed";
                        // If order is still ACTIVE, payment might not be complete yet
                        if (errorMsg.includes("ACTIVE")) {
                            toast.info("Payment is being processed. Your wallet will be credited shortly via webhook.");
                        } else {
                            throw new Error(errorMsg);
                        }
                    } else {
                        toast.success(`$${amount} added to your wallet successfully!`);
                        // Refresh billing data to get updated balance
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
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading billing settings...</p>
            </div>
        );
    }

    return (
        <>
            {/* Load Cashfree SDK Script */}
            <Script
                src="https://sdk.cashfree.com/js/v3/cashfree.js"
                onLoad={() => setIsScriptLoaded(true)}
                onError={() => {
                    // Failed to load Cashfree script
                }}
            />

            <div className="space-y-6">
                {/* Billing Warning Banner - shows during grace period */}
                {billingStatus?.status === BillingStatus.DUE && (
                    <BillingWarningBanner
                        billingStatus={BillingStatus.DUE}
                        daysUntilSuspension={billingStatus.daysUntilSuspension}
                        organizationId={organizationId}
                    />
                )}

                {/* Billing Overview */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5" />
                            Billing Overview
                        </CardTitle>
                        <CardDescription>
                            Organization-level billing information and settings
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Billing Status Alert */}
                        {billingStatus?.status === BillingStatus.SUSPENDED && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                    <strong>Account Suspended</strong> - Your organization has been suspended due to an unpaid invoice.
                                    Please update your payment method below to restore access.
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Billing Timeline - Item 4.6 */}
                        <div className="rounded-lg border border-border p-5 bg-muted/50 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-3 opacity-10">
                                <Calendar className="h-16 w-16" />
                            </div>

                            <h4 className="text-sm font-semibold flex items-center gap-2 mb-4 text-blue-700 dark:text-blue-400">
                                <Calendar className="h-4 w-4" />
                                Billing Lifecycle
                            </h4>

                            <div className="relative pl-6 space-y-6">
                                {/* Vertical Line Connector */}
                                <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-primary/30" />

                                {/* Personal Phase */}
                                <div className="relative">
                                    <div className="absolute -left-[23px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-background bg-muted-foreground/50 z-10" />
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-foreground">Personal Account Usage</span>
                                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 uppercase tracking-wider font-bold bg-white/50 dark:bg-black/20">Historic</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            All activity prior to organization creation. Billed directly to your personal payment method.
                                        </p>
                                    </div>
                                </div>

                                {/* Organization Phase */}
                                <div className="relative">
                                    <div className="absolute -left-[23px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-background bg-blue-600 z-10 shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-blue-700 dark:text-blue-400">Organization Managed Billing</span>
                                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 uppercase tracking-wider font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">Active</Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-blue-600/80 dark:text-blue-400/80 font-medium">
                                            <span>Started on {organization?.billingStartAt ? format(new Date(organization.billingStartAt), "PPP") : "Creation"}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            All shared workspaces and team activity are consolidated into this organization&apos;s billing cycle.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                                <p className="text-[11px] text-blue-600/70 dark:text-blue-400/70 italic">
                                    * The transition occurred when your account was converted to an organization.
                                </p>
                                <Button variant="ghost" size="sm" asChild className="text-blue-600 dark:text-blue-400 font-semibold h-7 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40">
                                    <Link href="/organization/usage">
                                        View Detailed Usage
                                        <ExternalLink className="ml-1.5 h-3 w-3" />
                                    </Link>
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Billing Entity</Label>
                                <div className="flex items-center gap-2">
                                    <Input value={organization?.name || organizationName} disabled className="flex-1" />
                                    <Badge variant="default">Organization</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    All workspaces in this organization share billing
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label>Billing Status</Label>
                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant={
                                            billingStatus?.status === BillingStatus.ACTIVE ? "default" :
                                                billingStatus?.status === BillingStatus.DUE ? "secondary" :
                                                    "destructive"
                                        }
                                        className={cn(
                                            billingStatus?.status === BillingStatus.ACTIVE && "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400",
                                            billingStatus?.status === BillingStatus.DUE && "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400"
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
                                {billingAccount?.billingCycleEnd && (
                                    <p className="text-xs text-muted-foreground">
                                        Next billing: {format(new Date(billingAccount.billingCycleEnd), "PPP")}
                                    </p>
                                )}
                            </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="billingEmail">Primary Billing Email</Label>
                                <Input
                                    id="billingEmail"
                                    type="email"

                                    value={billingEmailValue}
                                    onChange={(e) => setBillingEmailValue(e.target.value)}
                                    placeholder={ownerEmail || "owner@example.com"}
                                    disabled={isSaving || !canManageBilling}
                                />
                                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    {billingEmailValue ? (
                                        <span>Custom billing email active</span>
                                    ) : (
                                        <>
                                            <Badge variant="outline" className="text-[9px] h-3.5 px-1 uppercase font-bold">Default</Badge>
                                            <span>Using owner: {ownerEmail || "loading..."}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="alternativeEmail">Alternative Billing Email (Optional)</Label>
                                <Input
                                    id="alternativeEmail"
                                    type="email"
                                    value={alternativeEmailValue}
                                    onChange={(e) => setAlternativeEmailValue(e.target.value)}
                                    placeholder="finance@company.com"
                                    disabled={isSaving || !canManageBilling}
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Secondary contact for billing notifications
                                </p>
                            </div>
                        </div>

                        <Button onClick={handleSaveBillingSettings} disabled={isSaving || !canManageBilling}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save Billing Settings"
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Wallet Balance & Add Credits */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Wallet className="h-5 w-5" />
                            Wallet Balance
                        </CardTitle>
                        <CardDescription>
                            Manage your organization&apos;s Fairlx wallet for usage billing
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Wallet explanation */}
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                                <strong>How wallet billing works:</strong> Usage costs are deducted from your wallet balance.
                                Add credits anytime via UPI, Card, or Net Banking. No recurring mandates needed.
                            </AlertDescription>
                        </Alert>

                        {/* Current Balance */}
                        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "p-2 rounded-full",
                                    walletBalance > 0
                                        ? "bg-green-100 dark:bg-green-900/30"
                                        : "bg-orange-100 dark:bg-orange-900/30"
                                )}>
                                    {walletBalance > 0 ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    ) : (
                                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                                    )}
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">
                                        {new Intl.NumberFormat("en-US", {
                                            style: "currency",
                                            currency: walletCurrency,
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 6,
                                        }).format(walletBalance)}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Available Balance
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Low balance warning */}
                        {walletBalance < 100 && (
                            <Alert className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30">
                                <AlertTriangle className="h-4 w-4 text-orange-600" />
                                <AlertDescription className="text-orange-700 dark:text-orange-400">
                                    Your wallet balance is low. Add credits to avoid service interruptions.
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Add Credits Section */}
                        <div className="border rounded-lg border-dashed p-6">
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <Label htmlFor="topup-amount" className="text-sm font-medium mb-2 block">
                                            Amount ($)
                                        </Label>
                                        <Input
                                            id="topup-amount"
                                            type="number"
                                            min="1"
                                            step="100"
                                            placeholder="500"
                                            value={topupAmount}
                                            onChange={(e) => setTopupAmount(e.target.value)}
                                            disabled={isAddingCredits || !canManageBilling}
                                        />
                                    </div>
                                </div>

                                {/* Quick top-up amounts */}
                                <div className="flex flex-wrap gap-2">
                                    {[1, 5, 10, 25, 50].map((amt) => (
                                        <Button
                                            key={amt}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setTopupAmount(String(amt))}
                                            disabled={isAddingCredits || !canManageBilling}
                                            className={cn(
                                                "text-xs",
                                                topupAmount === String(amt) && "border-primary bg-primary/10"
                                            )}
                                        >
                                            ${amt}
                                        </Button>
                                    ))}
                                </div>

                                <Button
                                    onClick={handleAddCredits}
                                    disabled={isAddingCredits || !topupAmount || Number(topupAmount) < 1 || !canManageBilling}
                                    className="w-full"
                                    size="lg"
                                >
                                    {isAddingCredits ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add {topupAmount ? `$${Number(topupAmount)}` : "$0"} to Wallet
                                        </>
                                    )}
                                </Button>

                                <p className="text-xs text-muted-foreground text-center">
                                    Payments processed securely by Cashfree. Minimum $1.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Invoice History */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Invoice History
                                </CardTitle>
                                <CardDescription>
                                    View and download past invoices
                                </CardDescription>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/organization/settings/billing?tab=invoices`}>
                                    View All Invoices
                                    <ExternalLink className="ml-2 h-3 w-3" />
                                </Link>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {isInvoicesLoading ? (
                                <div className="flex flex-col items-center justify-center py-10 space-y-2">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground">Loading invoices...</p>
                                </div>
                            ) : invoices.length === 0 ? (
                                <div className="text-center py-10 border rounded-lg border-dashed">
                                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                                    <p className="text-sm text-muted-foreground">No invoices found for this organization yet.</p>
                                    <p className="text-xs text-muted-foreground mt-1">Invoices are generated at the end of each billing cycle.</p>
                                </div>
                            ) : (
                                invoices.map((invoice) => (
                                    <div
                                        key={invoice.$id}
                                        className="flex items-center justify-between p-3 rounded-lg border"
                                    >
                                        <div className="flex items-center gap-4">
                                            <FileText className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <div className="font-medium">{invoice.invoiceId}</div>
                                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {format(new Date(invoice.createdAt), "PPP")}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <div className="font-semibold">
                                                    {new Intl.NumberFormat("en-US", {
                                                        style: "currency",
                                                        currency: "USD",
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 6,
                                                    }).format(invoice.totalCost)}
                                                </div>
                                                <Badge
                                                    variant={invoice.status === 'paid' ? 'default' : 'outline'}
                                                    className={cn(
                                                        "text-[10px] h-4 px-1.5 uppercase",
                                                        invoice.status === 'paid' && "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
                                                        invoice.status === 'draft' && "bg-muted text-muted-foreground border-border"
                                                    )}
                                                >
                                                    {invoice.status}
                                                </Badge>
                                            </div>
                                            <Button variant="ghost" size="sm">
                                                Download
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Usage Dashboard Link */}
                <Card className="bg-card border-blue-600/20">
                    <CardContent className="py-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-foreground">View Detailed Usage</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Monitor your organization&apos;s usage metrics and costs
                                </p>
                            </div>
                            <Button asChild>
                                <Link href="/organization/usage">
                                    <DollarSign className="mr-2 h-4 w-4" />
                                    Usage Dashboard
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
