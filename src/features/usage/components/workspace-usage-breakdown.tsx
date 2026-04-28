"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, TrendingUp, Activity, HardDrive, Cpu, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { UsageEvent, UsageSummary } from "../types";
import { WorkspaceUsageDrawer } from "./workspace-usage-drawer";
import { 
    USAGE_RATE_TRAFFIC_GB, 
    USAGE_RATE_STORAGE_GB_MONTH, 
    USAGE_RATE_COMPUTE_UNIT 
} from "@/config";

interface WorkspaceUsageData {
    workspaceId: string;
    workspaceName: string;
    trafficBytes: number;
    trafficGB: number;
    storageBytes: number;
    storageGB: number;
    computeUnits: number;
    aiTokens: number;
    aiCostUSD: number;
    estimatedCost: number;
    status: "active" | "archived";
}

interface WorkspaceUsageBreakdownProps {
    organizationId: string;
    events?: UsageEvent[];
    summary: UsageSummary | null;
    workspaces?: Array<{ $id: string; name: string }>;
    isLoading?: boolean;
}

// Pricing (example rates - should match billing config)
// Pricing rates from global config (converted from cents to USD)
const PRICING = {
    trafficPerGB: USAGE_RATE_TRAFFIC_GB / 100,
    storagePerGB: USAGE_RATE_STORAGE_GB_MONTH / 100,
    computePerUnit: USAGE_RATE_COMPUTE_UNIT / 100,
};

export function WorkspaceUsageBreakdown({
    summary,
    workspaces = [],
    isLoading
}: WorkspaceUsageBreakdownProps) {
    const [sortBy, setSortBy] = useState<keyof WorkspaceUsageData>("estimatedCost");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

    // Helper to get workspace name
    const getWorkspaceName = (id: string) => {
        const ws = workspaces.find(w => w.$id === id);
        return ws ? ws.name : "Unknown Workspace";
    };

    // Aggregate events by workspace
    const workspaceData = useMemo(() => {
        if (!workspaces.length) return [];

        const byWorkspace = summary?.breakdown?.byWorkspace || {};

        // Convert to display format, iterating through ALL workspaces
        return workspaces.map((ws) => {
            const data = byWorkspace[ws.$id] || { traffic: 0, storage: 0, compute: 0 };

            const trafficBytes = data.traffic || 0;
            const storageBytes = Math.max(0, data.storage || 0);
            
            const trafficGB = trafficBytes / (1024 * 1024 * 1024);
            const storageGB = storageBytes / (1024 * 1024 * 1024);
            const computeUnits = data.compute || 0;
            const aiTokens = data.ai || 0;
            const aiCostUSD = data.aiCost || 0;

            const estimatedCost =
                (trafficGB * PRICING.trafficPerGB) +
                (storageGB * PRICING.storagePerGB) +
                (computeUnits * PRICING.computePerUnit) +
                aiCostUSD;

            return {
                workspaceId: ws.$id,
                workspaceName: ws.name,
                trafficBytes,
                trafficGB,
                storageBytes,
                storageGB,
                computeUnits,
                aiTokens,
                aiCostUSD,
                estimatedCost,
                status: "active" as const,
            };
        });
    }, [summary, workspaces]);

    const sortedWorkspaces = useMemo(() =>
        [...workspaceData].sort((a, b) => {
            const aVal = a[sortBy];
            const bVal = b[sortBy];
            const multiplier = sortOrder === "asc" ? 1 : -1;
            return (aVal > bVal ? 1 : -1) * multiplier;
        }),
        [workspaceData, sortBy, sortOrder]
    );

    const totals = useMemo(() =>
        workspaceData.reduce(
            (acc, ws) => ({
                trafficBytes: acc.trafficBytes + ws.trafficBytes,
                trafficGB: acc.trafficGB + ws.trafficGB,
                storageBytes: acc.storageBytes + ws.storageBytes,
                storageGB: acc.storageGB + ws.storageGB,
                computeUnits: acc.computeUnits + ws.computeUnits,
                aiTokens: acc.aiTokens + ws.aiTokens,
                estimatedCost: acc.estimatedCost + ws.estimatedCost,
            }),
            { trafficBytes: 0, trafficGB: 0, storageBytes: 0, storageGB: 0, computeUnits: 0, aiTokens: 0, estimatedCost: 0 }
        ),
        [workspaceData]
    );

    const handleSort = (column: keyof WorkspaceUsageData) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortBy(column);
            setSortOrder("desc");
        }
    };

    const formatNumber = (num: number, decimals = 2) => {
        return num.toFixed(decimals);
    };

    const formatBytes = (bytes: number) => {
        if (bytes <= 0) return "0 B";
        const k = 1024;
        const dm = 2;
        const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const safeIndex = Math.max(0, Math.min(i, sizes.length - 1));
        return parseFloat((bytes / Math.pow(k, safeIndex)).toFixed(dm)) + " " + sizes[safeIndex];
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Workspace Usage Breakdown</CardTitle>
                    <CardDescription>Loading workspace usage data...</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="animate-pulse space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-12 bg-muted rounded" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (workspaceData.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Workspace Usage Breakdown
                    </CardTitle>
                    <CardDescription>
                        Usage and costs by workspace for the current billing period
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Inbox className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-center">No usage data available for this period</p>
                        <p className="text-sm text-center mt-2 opacity-75">
                            Usage will appear here once workspaces start generating activity
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Workspace Usage Breakdown
                    </CardTitle>
                    <CardDescription>
                        Usage and costs by workspace for the current billing period
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Workspace</TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => handleSort("trafficGB")}
                                    >
                                        <div className="flex items-center gap-1">
                                            <Activity className="h-3 w-3" />
                                            Traffic
                                            {sortBy === "trafficGB" && (sortOrder === "desc" ? " ↓" : " ↑")}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => handleSort("storageGB")}
                                    >
                                        <div className="flex items-center gap-1">
                                            <HardDrive className="h-3 w-3" />
                                            Storage
                                            {sortBy === "storageGB" && (sortOrder === "desc" ? " ↓" : " ↑")}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => handleSort("computeUnits")}
                                    >
                                        <div className="flex items-center gap-1">
                                            <Cpu className="h-3 w-3" />
                                            Compute
                                            {sortBy === "computeUnits" && (sortOrder === "desc" ? " ↓" : " ↑")}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => handleSort("aiTokens")}
                                    >
                                        <div className="flex items-center gap-1">
                                            <TrendingUp className="h-3 w-3" />
                                            AI Usage
                                            {sortBy === "aiTokens" && (sortOrder === "desc" ? " ↓" : " ↑")}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-muted/50 text-right"
                                        onClick={() => handleSort("estimatedCost")}
                                    >
                                        Est. Cost
                                        {sortBy === "estimatedCost" && (sortOrder === "desc" ? " ↓" : " ↑")}
                                    </TableHead>
                                    <TableHead className="w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedWorkspaces.map((workspace) => (
                                    <TableRow key={workspace.workspaceId}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                {workspace.workspaceName}
                                                <Badge variant={workspace.status === "active" ? "default" : "secondary"} className="text-xs">
                                                    {workspace.status}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>{formatBytes(workspace.trafficBytes)}</TableCell>
                                        <TableCell>{formatBytes(workspace.storageBytes)}</TableCell>
                                        <TableCell>{workspace.computeUnits.toLocaleString()}</TableCell>
                                        <TableCell>{workspace.aiTokens.toLocaleString()} tokens</TableCell>
                                        <TableCell className="text-right font-medium">
                                            ${formatNumber(workspace.estimatedCost, 4)}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSelectedWorkspaceId(workspace.workspaceId)}
                                            >
                                                <ExternalLink className="h-3 w-3 mr-1" />
                                                View
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {/* Totals Row */}
                                <TableRow className="bg-muted/50 font-semibold">
                                    <TableCell className="font-bold">Total</TableCell>
                                    <TableCell>{formatBytes(totals.trafficBytes)}</TableCell>
                                    <TableCell>{formatBytes(totals.storageBytes)}</TableCell>
                                    <TableCell>{totals.computeUnits.toLocaleString()}</TableCell>
                                    <TableCell>{totals.aiTokens.toLocaleString()} tokens</TableCell>
                                    <TableCell className="text-right font-bold">
                                        ${formatNumber(totals.estimatedCost, 4)}
                                    </TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                        Click column headers to sort. All usage is billed to the organization.
                    </p>
                </CardContent>
            </Card>

            <WorkspaceUsageDrawer
                workspaceId={selectedWorkspaceId}
                workspaceName={selectedWorkspaceId ? getWorkspaceName(selectedWorkspaceId) : undefined}
                isOpen={!!selectedWorkspaceId}
                onClose={() => setSelectedWorkspaceId(null)}
            />
        </>
    );
}
