"use client";

import { DollarSign, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { UsageSummary } from "../types";
import { formatUsdAsDisplayCurrency, getUsageRatesUsd } from "@/lib/usage-cost";

interface CostSummaryProps {
    summary: UsageSummary | null;
    isLoading: boolean;
    /** Display currency code (e.g., "USD", "INR") */
    currency?: string;
    /** Exchange rate from USD to display currency */
    exchangeRate?: number;
}

export function CostSummary({
    summary,
    isLoading,
    currency = "USD",
    exchangeRate = 1,
}: CostSummaryProps) {
    const formatCurrency = (amountUsd: number) =>
        formatUsdAsDisplayCurrency(amountUsd, currency, exchangeRate);

    const rates = summary?.rates ?? getUsageRatesUsd();

    const formatBytes = (bytes: number) => {
        if (!bytes || bytes === 0) return "0 B";
        const k = 1024;
        const dm = 2;
        const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    };

    if (isLoading) {
        return (
            <Card className="animate-pulse">
                <CardHeader>
                    <div className="h-6 w-32 bg-muted rounded" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-8 bg-muted rounded" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-emerald-500" />
                    <div>
                        <CardTitle>Cost Breakdown</CardTitle>
                        <CardDescription>
                            Billed in USD. Visibility currency is display-only.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Rate Information */}
                    <div className="text-sm text-muted-foreground border-b pb-4">
                        <div className="flex items-center gap-1 mb-2">
                            <span className="font-medium">Current Rates</span>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="h-3 w-3" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Usage is billed in USD. Visibility currency converts for display only.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                                <p className="text-muted-foreground">Traffic</p>
                                <p className="font-mono">{formatCurrency(rates.trafficPerGBUsd)}/GB</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Storage</p>
                                <p className="font-mono">{formatCurrency(rates.storagePerGBMonthUsd)}/GB-mo</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Compute</p>
                                <p className="font-mono">{formatCurrency(rates.computePerUnitUsd)}/unit</p>
                            </div>
                        </div>
                    </div>

                    {/* Cost Breakdown */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between py-2">
                            <div>
                                <p className="font-medium">Traffic</p>
                                <p className="text-sm text-muted-foreground">
                                    {formatBytes(summary?.trafficTotalBytes || 0)} ×{" "}
                                    {formatCurrency(rates.trafficPerGBUsd)}/GB
                                </p>
                            </div>
                            <span className="font-mono font-medium">
                                {formatCurrency(summary?.estimatedCost.traffic || 0)}
                            </span>
                        </div>

                        <div className="flex items-center justify-between py-2">
                            <div>
                                <p className="font-medium">Storage</p>
                                <p className="text-sm text-muted-foreground">
                                    {formatBytes(summary?.storageAvgBytes || 0)}-mo ×{" "}
                                    {formatCurrency(rates.storagePerGBMonthUsd)}/GB
                                </p>
                            </div>
                            <span className="font-mono font-medium">
                                {formatCurrency(summary?.estimatedCost.storage || 0)}
                            </span>
                        </div>

                        <div className="flex items-center justify-between py-2">
                            <div>
                                <p className="font-medium">Compute (Jobs)</p>
                                <p className="text-sm text-muted-foreground">
                                    {summary?.computeTotalUnits.toLocaleString() || "0"} units ×{" "}
                                    {formatCurrency(rates.computePerUnitUsd)}
                                </p>
                            </div>
                            <span className="font-mono font-medium">
                                {formatCurrency(summary?.estimatedCost.compute || 0)}
                            </span>
                        </div>

                        <div className="flex items-center justify-between py-2">
                            <div>
                                <p className="font-medium">AI Usage</p>
                                <p className="text-sm text-muted-foreground">
                                    {summary?.aiTokensTotal?.toLocaleString() || "0"} tokens (dynamic pricing)
                                </p>
                            </div>
                            <span className="font-mono font-medium">
                                {formatCurrency(summary?.estimatedCost.ai || 0)}
                            </span>
                        </div>

                        <div className="border-t pt-3">
                            <div className="flex items-center justify-between">
                                <span className="text-lg font-semibold">Total Estimated</span>
                                <span className="text-lg font-mono font-bold text-emerald-600">
                                    {formatCurrency(summary?.estimatedCost.total || 0)}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                For period: {summary?.period || "Current"}. Billed in USD.
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
