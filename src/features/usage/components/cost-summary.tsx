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
import {
    USAGE_RATE_TRAFFIC_GB,
    USAGE_RATE_STORAGE_GB_MONTH,
    USAGE_RATE_COMPUTE_UNIT,
} from "@/config";

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
    // Convert USD to display currency and format
    const formatCurrency = (amountUsd: number) => {
        const converted = amountUsd * exchangeRate;
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
            minimumFractionDigits: currency === "USD" ? 2 : 2,
            maximumFractionDigits: currency === "USD" ? 6 : 2,
        }).format(converted);
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
                            Estimated costs based on current rates
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
                                        <p>Rates are configured via environment variables</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                                <p className="text-muted-foreground">Traffic</p>
                                <p className="font-mono">{formatCurrency(USAGE_RATE_TRAFFIC_GB / 100)}/GB</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Storage</p>
                                <p className="font-mono">{formatCurrency(USAGE_RATE_STORAGE_GB_MONTH / 100)}/GB-mo</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Compute</p>
                                <p className="font-mono">{formatCurrency(USAGE_RATE_COMPUTE_UNIT / 100)}/unit</p>
                            </div>
                        </div>
                    </div>

                    {/* Cost Breakdown */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between py-2">
                            <div>
                                <p className="font-medium">Traffic</p>
                                <p className="text-sm text-muted-foreground">
                                    {summary?.trafficTotalGB.toFixed(4) || "0"} GB ×{" "}
                                    {formatCurrency(USAGE_RATE_TRAFFIC_GB / 100)}
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
                                    {summary?.storageAvgGB.toFixed(4) || "0"} GB-mo ×{" "}
                                    {formatCurrency(USAGE_RATE_STORAGE_GB_MONTH / 100)}
                                </p>
                            </div>
                            <span className="font-mono font-medium">
                                {formatCurrency(summary?.estimatedCost.storage || 0)}
                            </span>
                        </div>

                        <div className="flex items-center justify-between py-2">
                            <div>
                                <p className="font-medium">Compute</p>
                                <p className="text-sm text-muted-foreground">
                                    {summary?.computeTotalUnits.toLocaleString() || "0"} units ×{" "}
                                    {formatCurrency(USAGE_RATE_COMPUTE_UNIT / 100)}
                                </p>
                            </div>
                            <span className="font-mono font-medium">
                                {formatCurrency(summary?.estimatedCost.compute || 0)}
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
                                For period: {summary?.period || "Current"}
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
