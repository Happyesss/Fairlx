"use client";

import { Info, HelpCircle } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { USAGE_RATE_TRAFFIC_GB, USAGE_RATE_STORAGE_GB_MONTH, USAGE_RATE_COMPUTE_UNIT, BILLING_CURRENCY } from "@/config";
import { centsToUsd } from "@/lib/usage-cost";

interface BillingExplainerProps {
    usageBreakdown?: {
        trafficGB?: number;
        storageAvgGB?: number;
        computeUnits?: number;
    };
    periodStart?: string;
    periodEnd?: string;
}

/**
 * Billing Explainer Component
 * 
 * Shows users how their bill was calculated with:
 * - Usage period dates
 * - Rate breakdown per resource type
 * - Current usage statistics (if provided)
 * - Invoice lock explanation
 * 
 * Place this in the billing admin panel to build trust.
 */
export function BillingExplainer({
    usageBreakdown,
    periodStart,
    periodEnd,
}: BillingExplainerProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: BILLING_CURRENCY,
        }).format(amount);
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return "-";
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    return (
        <Card className="border-border bg-card">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Info className="h-4 w-4 text-primary" />
                    How This Bill Was Calculated
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
                {/* Usage Window */}
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Usage Period</span>
                    <span className="font-medium">
                        {formatDate(periodStart)} – {formatDate(periodEnd)}
                    </span>
                </div>

                {/* Rate Breakdown */}
                <div className="space-y-2 border-t pt-3">
                    <div className="flex justify-between">
                        <div className="flex items-center gap-1">
                            <span>Traffic (per GB)</span>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Data transferred in/out of your workspaces</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <span>{formatCurrency(centsToUsd(USAGE_RATE_TRAFFIC_GB))}</span>
                    </div>

                    <div className="flex justify-between">
                        <div className="flex items-center gap-1">
                            <span>Storage (per GB/month)</span>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Average storage used during the billing period</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <span>{formatCurrency(centsToUsd(USAGE_RATE_STORAGE_GB_MONTH))}</span>
                    </div>

                    <div className="flex justify-between">
                        <div className="flex items-center gap-1">
                            <span>Compute (per unit)</span>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>AI features, document processing, and background jobs</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <span>{formatCurrency(centsToUsd(USAGE_RATE_COMPUTE_UNIT))}</span>
                    </div>
                </div>

                {/* Current Usage (if provided) */}
                {usageBreakdown && (
                    <div className="space-y-2 border-t pt-3">
                        <div className="text-xs uppercase text-muted-foreground font-medium">
                            Your Usage This Period
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                                <p className="text-lg font-bold">
                                    {usageBreakdown.trafficGB?.toFixed(2) ?? "0.00"}
                                </p>
                                <p className="text-xs text-muted-foreground">GB Traffic</p>
                            </div>
                            <div>
                                <p className="text-lg font-bold">
                                    {usageBreakdown.storageAvgGB?.toFixed(2) ?? "0.00"}
                                </p>
                                <p className="text-xs text-muted-foreground">GB Storage</p>
                            </div>
                            <div>
                                <p className="text-lg font-bold">
                                    {usageBreakdown.computeUnits?.toLocaleString() ?? "0"}
                                </p>
                                <p className="text-xs text-muted-foreground">Compute Units</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Invoice Lock Note */}
                <div className="border-t pt-3 text-xs text-muted-foreground">
                    <p>
                        <strong>Note:</strong> All usage is billed in USD. Visibility currency is display-only.
                        Invoices are generated at the end of each billing period.
                        Once generated, the usage snapshot is locked and cannot be modified.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
