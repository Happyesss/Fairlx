"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { 
    Building2, 
    CreditCard, 
    TrendingUp, 
    Calendar, 
    Wallet, 
    ArrowUpRight, 
    Plus, 
    Loader2,
    ExternalLink,
    FileText,
    Clock,
    BarChart3
} from "lucide-react";
import { format, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useAccountType } from "@/features/organizations/hooks/use-account-type";
import { useGetOrganizations } from "@/features/organizations/api/use-get-organizations";
import { 
    useGetUsageSummary, 
    useGetUsageEvents 
} from "@/features/usage/api";
import { WorkspaceUsageBreakdown } from "@/features/usage/components";
import { RedeemCouponCard } from "@/features/github-rewards/components/RedeemCouponCard";
import { 
    useGetBillingAccount, 
    useSetupBilling, 
    useGetBillingStatus,
    useGetInvoices
} from "@/features/billing/api";
import { useCurrent } from "@/features/auth/api/use-current";
import { BillingAccountType, BillingStatus, BillingInvoice } from "@/features/billing/types";
import { client } from "@/lib/rpc";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import Script from "next/script";
import { cn } from "@/lib/utils";

export const BillingDashboardClient = () => {
    const params = useParams();
    const queryClient = useQueryClient();
    const workspaceId = params.workspaceId as string;
    const { isOrg, isPersonal, primaryOrganizationId, accountType } = useAccountType();
    const { data: user } = useCurrent();
    const { data: organizations } = useGetOrganizations();
    const { data: usageSummary, isLoading: usageLoading } = useGetUsageSummary({
        workspaceId,
        period: new Date().toISOString().slice(0, 7), // Current month YYYY-MM
    });

    // Billing hooks
    const { data: billingAccountData } = useGetBillingAccount({
        organizationId: isOrg ? primaryOrganizationId : undefined,
        userId: isPersonal ? user?.$id : undefined,
        enabled: !!(isOrg ? primaryOrganizationId : user?.$id)
    });
    const { mutateAsync: setupBilling } = useSetupBilling();

    const [isAddingCredits, setIsAddingCredits] = useState(false);
    const [isScriptLoaded, setIsScriptLoaded] = useState(false);
    const [topupAmount, setTopupAmount] = useState("");

    // Wallet balance
    const walletBalance = billingAccountData?.walletBalance ?? 0;
    const walletCurrency = billingAccountData?.walletCurrency ?? "USD";
    const trialExpiresAt = billingAccountData?.trialExpiresAt;
    const initialTrialAmount = billingAccountData?.initialTrialAmount ?? 0;
    
    // Credit breakdown logic
    // Trial credits are consumed first. 
    // Remaining Trial = min(current balance, initial trial amount)
    // Real Credits = current balance - remaining trial
    const trialBalance = Math.min(walletBalance, initialTrialAmount);
    const realBalance = Math.max(0, walletBalance - trialBalance);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: walletCurrency,
            minimumFractionDigits: 2,
        }).format(amount);
    };

    // Handler for adding credits
    const handleAddCredits = useCallback(async () => {
        const entityId = isOrg ? primaryOrganizationId : user?.$id;
        if (!entityId) {
            toast.error("Account ID is required");
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
            // Ensure billing account exists
            if (!billingAccountData?.data) {
                try {
                    await setupBilling({
                        json: {
                            type: isOrg ? BillingAccountType.ORG : BillingAccountType.PERSONAL,
                            organizationId: isOrg ? primaryOrganizationId : undefined,
                            userId: isPersonal ? user?.$id : undefined,
                            billingEmail: user?.email || undefined,
                            contactName: user?.name || "User",
                        }
                    });
                } catch {
                    toast.error("Failed to initialize billing. Please contact support.");
                    setIsAddingCredits(false);
                    return;
                }
            }

            // Create order
            const orderResponse = await client.api.wallet["create-order"].$post({
                json: {
                    amount,
                    organizationId: isOrg ? primaryOrganizationId : undefined,
                    userId: isPersonal ? user?.$id : undefined,
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
                    environment: string; 
                } 
            };
            const orderData = orderResult.data;

            const cashfree = (window as Window & { 
                Cashfree: (args: { mode: string }) => { 
                    checkout: (args: { paymentSessionId: string; redirectTarget: string }) => Promise<{ error?: { message?: string } }> 
                } 
            }).Cashfree({ 
                mode: orderData.environment || "sandbox" 
            });

            const checkoutResult = await cashfree.checkout({
                paymentSessionId: orderData.paymentSessionId,
                redirectTarget: "_modal",
            });

            if (checkoutResult.error) {
                if (!checkoutResult.error.message?.includes("user")) {
                    toast.error(`Payment error: ${checkoutResult.error.message}`);
                }
            } else {
                // Verify
                const verifyResponse = await client.api.wallet["verify-topup"].$post({
                    json: { cashfreeOrderId: orderData.orderId },
                });

                if (!verifyResponse.ok) {
                    toast.info("Payment is being processed. Wallet will be credited shortly.");
                } else {
                    toast.success(`$${amount} added successfully!`);
                    queryClient.invalidateQueries({ queryKey: ["billing-account"] });
                    setTopupAmount("");
                }
            }
            setIsAddingCredits(false);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to initialize payment";
            toast.error(message);
            setIsAddingCredits(false);
        }
    }, [isOrg, isPersonal, primaryOrganizationId, user, topupAmount, isScriptLoaded, billingAccountData, setupBilling, queryClient]);

    // Fetch events for workspace breakdown
    const { data: eventsData, isLoading: eventsLoading } = useGetUsageEvents({
        workspaceId: isOrg ? undefined : workspaceId,
        organizationId: isOrg ? primaryOrganizationId : undefined,
        limit: 500,
    });

    // Get current org for ORG accounts
    const currentOrg = isOrg && primaryOrganizationId
        ? organizations?.documents?.find((o: { $id: string }) => o.$id === primaryOrganizationId)
        : null;

    // Fetch invoices
    const { data: invoicesDoc, isLoading: isInvoicesLoading } = useGetInvoices({
        organizationId: isOrg ? primaryOrganizationId : undefined,
        userId: isPersonal ? user?.$id : undefined,
        limit: 10
    });
    const invoices = invoicesDoc?.documents || [];

    // Billing status
    const { data: billingStatus } = useGetBillingStatus({
        organizationId: isOrg ? primaryOrganizationId : undefined,
        userId: isPersonal ? user?.$id : undefined,
        enabled: !!(isOrg ? primaryOrganizationId : user?.$id)
    });

    return (
        <div className="flex flex-col gap-6 sm:gap-8 min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-background via-background to-muted/20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-bold">Billing & Usage</h1>
                    <p className="text-muted-foreground">
                        {isOrg
                            ? `Organization billing for ${(currentOrg as { name?: string })?.name || "your organization"}`
                            : "Personal account billing"
                        }
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {!isOrg && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-xs gap-1.5"
                            onClick={() => window.location.href = `/workspaces/${workspaceId}/admin/usage`}
                        >
                            <BarChart3 className="size-3.5" />
                            Usage Dashboard
                        </Button>
                    )}
                    <Badge variant={isOrg ? "default" : "secondary"} className="text-xs">
                        {accountType} Account
                    </Badge>
                </div>
            </div>

            <Separator />

            {/* Billing Entity Card */}
            <Card>
                <CardHeader className="flex flex-row items-center gap-3">
                    {isOrg ? (
                        <Building2 className="h-8 w-8 text-primary" />
                    ) : (
                        <CreditCard className="h-8 w-8 text-primary" />
                    )}
                    <div>
                        <CardTitle>
                            {isOrg ? (currentOrg as { name?: string })?.name || "Organization" : "Personal Plan"}
                        </CardTitle>
                        <CardDescription>
                            {isOrg
                                ? "All workspaces in this organization share billing"
                                : "Individual workspace billing"
                            }
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-1">
                            <span className="text-sm text-muted-foreground">Billing Scope</span>
                            <span className="font-medium">{isOrg ? "Organization" : "User"}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-sm text-muted-foreground">Billing Entity ID</span>
                            <span className="font-mono text-sm truncate">
                                {isOrg ? primaryOrganizationId : "User"}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-sm text-muted-foreground">Current Period</span>
                            <span className="font-medium flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Wallet & Credits - PREMIUM ENHANCED SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Wallet Balance Display */}
                <Card className="lg:col-span-2 relative overflow-hidden group border-none shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-blue-700 to-purple-800 opacity-90 transition-opacity group-hover:opacity-100" />
                    
                    {/* Animated shapes */}
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-blue-400/20 rounded-full blur-2xl" />

                    <CardHeader className="relative z-10 text-white pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-blue-50">
                                <Wallet className="h-5 w-5" />
                                Fairlx Wallet
                            </CardTitle>
                            <Badge variant="outline" className="text-white/80 border-white/20 bg-white/10 backdrop-blur-md">
                                {isOrg ? "Organization Funds" : "Personal Credits"}
                            </Badge>
                        </div>
                        <CardDescription className="text-blue-100/70">
                            Available balance for AI compute and automated tasks
                        </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="relative z-10 pt-4 pb-8">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div>
                                <span className="text-blue-200 text-xs uppercase tracking-widest font-bold">Total Available</span>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-4xl sm:text-6xl font-extrabold text-white tracking-tighter">
                                        {new Intl.NumberFormat("en-US", {
                                            style: "currency",
                                            currency: walletCurrency,
                                            minimumFractionDigits: 2,
                                        }).format(walletBalance)}
                                    </span>
                                    <span className="text-blue-200 font-medium text-lg uppercase">{walletCurrency}</span>
                                </div>
                                
                                {initialTrialAmount > 0 && (
                                    <div className="mt-3 flex items-center gap-2 text-blue-200/80 text-sm font-medium bg-black/10 w-fit px-3 py-1 rounded-lg border border-white/5">
                                        <span>{formatCurrency(realBalance)} real</span>
                                        <Plus className="h-3 w-3 opacity-50" />
                                        <span>{formatCurrency(trialBalance)} trial</span>
                                        <span className="mx-1 opacity-30 text-xs">=</span>
                                        <span className="text-blue-100 font-bold">{formatCurrency(walletBalance)} total</span>
                                    </div>
                                )}

                                {trialExpiresAt && (
                                    <div className="mt-4 flex items-center gap-2 text-blue-50/90 text-sm bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full w-fit border border-white/10">
                                        <Clock className="h-3.5 w-3.5" />
                                        <span>Trial credit expires in <span className="font-bold">{differenceInDays(new Date(trialExpiresAt), new Date())} days</span></span>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20">
                                    <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-sm font-medium text-blue-50">Real-time usage active</span>
                                </div>
                                <div className="text-[11px] text-blue-200/60 italic text-right px-1">
                                    * Balance updates instantly after compute operations
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Top-up Card */}
                <Card className="border-border/50 shadow-lg hover:shadow-xl transition-all">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Plus className="h-4 w-4 text-primary" />
                            Add Credits
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                                <Input
                                    type="number"
                                    placeholder="50.00"
                                    className="pl-7 h-11 text-lg font-semibold"
                                    value={topupAmount}
                                    onChange={(e) => setTopupAmount(e.target.value)}
                                    disabled={isAddingCredits}
                                />
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {[5, 10, 25, 50].map((amt) => (
                                    <Button
                                        key={amt}
                                        variant="outline"
                                        size="sm"
                                        className={cn(
                                            "h-8 text-xs font-bold",
                                            topupAmount === String(amt) && "bg-primary/10 border-primary text-primary"
                                        )}
                                        onClick={() => setTopupAmount(String(amt))}
                                    >
                                        ${amt}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <Button 
                            className="w-full h-11 font-bold text-base"
                            onClick={handleAddCredits}
                            disabled={isAddingCredits || !topupAmount || Number(topupAmount) < 1}
                        >
                            {isAddingCredits ? (
                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            ) : (
                                <ArrowUpRight className="h-5 w-5 mr-2" />
                            )}
                            {isAddingCredits ? "Processing..." : `Top up $${topupAmount || '0'}`}
                        </Button>
                        <p className="text-[10px] text-muted-foreground text-center">
                            Secure payment via UPI, Cards & Net Banking
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Usage Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Traffic Usage
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {usageLoading ? "..." : `${usageSummary?.data?.trafficTotalGB?.toFixed(2) || 0} GB`}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <TrendingUp className="h-3 w-3 text-emerald-500" />
                            This month
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Storage Usage
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {usageLoading ? "..." : `${usageSummary?.data?.storageAvgGB?.toFixed(2) || 0} GB`}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            Average this month
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Compute Units
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {usageLoading ? "..." : (usageSummary?.data?.computeTotalUnits?.toLocaleString() || 0)}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            AI + automation
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* GitHub Star Reward - Redeem Coupon */}
            <RedeemCouponCard
                workspaceId={workspaceId}
                organizationId={isOrg ? primaryOrganizationId : undefined}
            />

            {/* Billing Lifecycle & Invoices */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Billing Lifecycle */}
                <Card className="border-border/50 bg-muted/20">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" />
                            Billing Lifecycle
                        </CardTitle>
                        <CardDescription>Your current billing period and status</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="relative pl-6 space-y-6">
                            <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-primary/20" />
                            
                            <div className="relative">
                                <div className="absolute -left-[23px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-background bg-primary z-10 shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-sm">Current Period</span>
                                        <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none">ACTIVE</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Started on {startOfMonth(new Date()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                                    </p>
                                </div>
                            </div>

                            <div className="relative">
                                <div className="absolute -left-[23px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-background bg-muted-foreground/30 z-10" />
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-sm">Next Invoice</span>
                                        <span className="text-[10px] font-bold text-muted-foreground">UPCOMING</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Expected on {endOfMonth(new Date()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Account Status</p>
                                <div className="flex items-center gap-2">
                                    <div className={cn(
                                        "h-2 w-2 rounded-full",
                                        billingStatus?.status === BillingStatus.ACTIVE ? "bg-emerald-500" : "bg-orange-500"
                                    )} />
                                    <span className="text-sm font-medium">{billingStatus?.status || "ACTIVE"}</span>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-xs h-8 text-primary">
                                Learn about billing
                                <ArrowUpRight className="ml-1 h-3 w-3" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Invoice History */}
                <Card className="border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                Invoice History
                            </CardTitle>
                            <CardDescription>Recent billing statements</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" className="h-8 text-xs">
                            View All
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {isInvoicesLoading ? (
                                <div className="py-8 flex flex-col items-center justify-center gap-2">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">Fetching invoices...</span>
                                </div>
                            ) : invoices.length === 0 ? (
                                <div className="py-8 text-center border border-dashed rounded-xl">
                                    <FileText className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                                    <p className="text-xs text-muted-foreground">No invoices generated yet</p>
                                </div>
                            ) : (
                                invoices.map((invoice: BillingInvoice) => (
                                    <div key={invoice.$id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center">
                                                <FileText className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold">{invoice.invoiceId}</p>
                                                <p className="text-[10px] text-muted-foreground">{format(new Date(invoice.$createdAt), "MMM dd, yyyy")}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-sm font-bold">
                                                    {new Intl.NumberFormat("en-US", {
                                                        style: "currency",
                                                        currency: "USD",
                                                    }).format(invoice.totalCost)}
                                                </p>
                                                <Badge variant="outline" className="h-4 text-[9px] uppercase tracking-tighter border-emerald-500/20 text-emerald-600 bg-emerald-500/5">Paid</Badge>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <ExternalLink className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Organization Workspaces Breakdown (ORG only) */}
            {isOrg && primaryOrganizationId && (
                <WorkspaceUsageBreakdown
                    organizationId={primaryOrganizationId}
                    summary={usageSummary?.data || null}
                    events={eventsData?.data?.documents || []}
                    isLoading={usageLoading || eventsLoading}
                />
            )}

            {/* Upgrade CTA for Personal accounts */}
            {!isOrg && (
                <Card className="bg-gradient-to-r from-indigo-600 to-blue-700 border-none shadow-xl overflow-hidden relative group">
                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
                    <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                    
                    <CardContent className="py-6 sm:py-8 relative z-10 text-white">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
                            <div className="text-center md:text-left">
                                <h3 className="text-xl font-bold">Scale to Organization</h3>
                                <p className="text-blue-100/70 text-sm mt-1 max-w-md">
                                    Collaborate with team members, manage multiple workspaces, and get unified billing for your entire team.
                                </p>
                            </div>
                            <Button size="lg" className="bg-white text-indigo-700 hover:bg-blue-50 font-bold px-8 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg">
                                <Building2 className="mr-2 h-5 w-5" />
                                Upgrade Now
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
            {/* Scripts */}
            <Script
                src="https://sdk.cashfree.com/js/v3/cashfree.js"
                onLoad={() => setIsScriptLoaded(true)}
            />
        </div>
    );
};
