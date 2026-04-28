"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import {
    CalendarIcon,
    RefreshCw,
    Shield,
    Building2,
    ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { PageLoader } from "@/components/page-loader";
import { PageError } from "@/components/page-error";
import { cn } from "@/lib/utils";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetWorkspaces } from "@/features/workspaces/api/use-get-workspaces";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { useCurrent } from "@/features/auth/api/use-current";
import { useAccountType } from "@/features/organizations/hooks/use-account-type";
import { useGetOrganizations } from "@/features/organizations/api/use-get-organizations";
import { useCurrentUserOrgPermissions } from "@/features/org-permissions/api/use-current-user-permissions";
import { OrgPermissionKey } from "@/features/org-permissions/types";
import {
    useGetUsageDashboard,
    useExportUsage,
} from "@/features/usage/api";
import {
    UsageKPICards,
    UsageCharts,
    UsageEventsTable,
    UsageAlertsManager,
    CostSummary,
    WorkspaceUsageBreakdown,
} from "@/features/usage/components";
import { BillingEntityBadge } from "@/components/billing-entity-badge";
import { ResourceType, UsageSource, UsageSummary } from "@/features/usage/types";
// import { CurrencyRatePanel } from "@/features/currency/components/currency-rate-panel";
import { CurrencySelector, useDisplayCurrency } from "@/features/currency/components/currency-selector";

export function UsageDashboardClient() {
    const router = useRouter();
    const workspaceId = useWorkspaceId();
    const { data: user } = useCurrent();
    const { isAdmin, isLoading: isMemberLoading } = useCurrentMember({ workspaceId });
    const { isOrg, primaryOrganizationId } = useAccountType();
    const { data: organizations } = useGetOrganizations();
    const { data: workspacesData } = useGetWorkspaces();
    const { data: projectsData } = useGetProjects({ workspaceId });
    // Org-level permissions - single source of truth
    const { hasPermission: hasOrgPermission, isLoading: isOrgPermissionLoading } = useCurrentUserOrgPermissions({
        orgId: primaryOrganizationId || ""
    });
    const canViewBilling = hasOrgPermission(OrgPermissionKey.BILLING_VIEW);

    // Currency display hook
    const { currency, setCurrency, rate, rates } = useDisplayCurrency();

    // Get current org for ORG accounts
    const currentOrg = isOrg && primaryOrganizationId
        ? organizations?.documents?.find((o: { $id: string }) => o.$id === primaryOrganizationId)
        : null;

    // Create name lookup maps for context display
    const workspaceNames = useMemo(() => {
        const map = new Map<string, string>();
        if (workspacesData?.documents) {
            for (const ws of workspacesData.documents) {
                map.set(ws.$id, ws.name);
            }
        }
        return map;
    }, [workspacesData]);

    const projectNames = useMemo(() => {
        const map = new Map<string, string>();
        if (projectsData?.documents) {
            for (const proj of projectsData.documents) {
                map.set(proj.$id, proj.name);
            }
        }
        return map;
    }, [projectsData]);

    // State for filters
    const [page, setPage] = useState(0);
    const pageSize = 10;
    const [resourceTypeFilters, setResourceTypeFilters] = useState<ResourceType[]>([]);
    const [sourceFilters, setSourceFilters] = useState<UsageSource[]>([]);
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    // Current period for summary
    const currentPeriod = format(new Date(), "yyyy-MM");

    // CRITICAL FIX: Determine query parameters based on account type
    // For ORG accounts, use organizationId for org-level aggregation
    // For PERSONAL accounts, use workspaceId for workspace-level queries
    const usageQueryParams = isOrg && primaryOrganizationId
        ? { organizationId: primaryOrganizationId }
        : { workspaceId };

    // When filters are active, fetch more events for proper client-side filtering
    // Otherwise use standard pagination
    const hasActiveFilters = resourceTypeFilters.length > 0 || sourceFilters.length > 0;
    const fetchLimit = hasActiveFilters ? 500 : pageSize; // Fetch more when filtering
    const fetchOffset = hasActiveFilters ? 0 : page * pageSize; // Start from 0 when filtering

    // PERFORMANCE OPTIMIZED: Single combined API call instead of 3 separate ones
    // This does auth/access check ONCE and fetches events + summary + alerts in parallel
    const {
        data: dashboardData,
        isLoading: isDashboardLoading,
        refetch: refetchDashboard,
    } = useGetUsageDashboard({
        ...usageQueryParams,
        period: currentPeriod,
        startDate: dateRange.from?.toISOString(),
        endDate: dateRange.to?.toISOString(),
        eventsLimit: fetchLimit,
        eventsOffset: fetchOffset,
    });

    const isEventsLoading = isDashboardLoading;
    const isSummaryLoading = isDashboardLoading;
    const isAlertsLoading = isDashboardLoading;

    const exportUsage = useExportUsage();

    // Handle export
    const handleExport = async (format: "csv" | "json") => {
        try {
            const result = await exportUsage.mutateAsync({
                ...usageQueryParams,
                format,
                startDate: dateRange.from?.toISOString(),
                endDate: dateRange.to?.toISOString(),
                resourceType: resourceTypeFilters.length === 1 ? resourceTypeFilters[0] : undefined,
            });

            if (format === "csv" && result instanceof Blob) {
                const url = URL.createObjectURL(result);
                const a = document.createElement("a");
                a.href = url;
                a.download = `usage-export-${new Date().toISOString().split("T")[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else if (format === "json") {
                const blob = new Blob([JSON.stringify(result, null, 2)], {
                    type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `usage-export-${new Date().toISOString().split("T")[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch {
            // Export failed silently
        }
    };

    const events = dashboardData?.data?.events?.documents || [];
    const totalEvents = dashboardData?.data?.events?.total || 0;
    const rawSummary = (dashboardData?.data?.summary || null) as UsageSummary | null;
    const alerts = dashboardData?.data?.alerts?.documents || [];

    // REFINED SUMMARY: Correct cumulative storage balance
    const summary = useMemo(() => {
        if (!rawSummary) return null;
        
        // Calculate the cumulative ending balance for storage from daily deltas
        // This ensures "Storage Used" shows current utilization, not just period net change
        let cumulativeBytes = 0;
        rawSummary.dailyUsage.forEach(day => {
            cumulativeBytes = Math.max(0, cumulativeBytes + Number(day.storage || 0));
        });
        
        // Recalculate storage cost based on the ending balance
        const storageRate = 2.0; // cents/GB-mo
        const currentStorageGB = cumulativeBytes / (1024 * 1024 * 1024);
        const storageCost = (currentStorageGB * storageRate) / 100;
        
        const newEstimatedCost = {
            ...rawSummary.estimatedCost,
            storage: Number(storageCost.toFixed(6)),
            total: Number((rawSummary.estimatedCost.total - rawSummary.estimatedCost.storage + storageCost).toFixed(6))
        };
        
        return {
            ...rawSummary,
            storageAvgBytes: cumulativeBytes,
            storageAvgGB: cumulativeBytes / (1024 * 1024 * 1024),
            estimatedCost: newEstimatedCost
        };
    }, [rawSummary]);

    // Loading state
    if (isMemberLoading || isOrgPermissionLoading) {
        return <PageLoader />;
    }

    // Admin check - either workspace admin (if in workspace) or org billing viewer (if org account)
    const hasAdminAccess = workspaceId ? isAdmin : (isOrg && canViewBilling);

    if (!hasAdminAccess) {
        return (
            <PageError message="You need admin access to view the usage dashboard." />
        );
    }



    return (
        <div>
            <div className="max-w-[1600px] mx-auto">
                {/* Header Section - Matching workspace dashboard style */}
                <div className="mb-8">
                    {/* Back navigation - conditional for org vs personal accounts */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mb-4 gap-2 text-muted-foreground hover:text-foreground"
                        onClick={() => router.push(isOrg ? "/organization" : `/workspaces/${workspaceId}`)}
                    >
                        <ArrowLeft className="size-4" />
                        {isOrg ? "Back to Organization" : "Back to Workspace"}
                    </Button>
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-muted-foreground">
                            {isOrg
                                ? "Organization-wide usage monitoring and billing insights"
                                : "Monitor and optimize your resource usage"}
                        </p>
                        <BillingEntityBadge />
                    </div>
                    <div className="flex items-center gap-3 mb-1">
                        {isOrg && <Building2 className="h-8 w-8 text-primary" />}
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">
                            {isOrg
                                ? `${(currentOrg as { name?: string })?.name || "Organization"} Usage Dashboard`
                                : `Welcome to Admin Dashboard${user?.name ? `, ${user.name.split(' ')[0]}` : ""}.`}
                        </h1>
                    </div>
                    {isOrg && (
                        <p className="text-sm text-muted-foreground">
                            Viewing aggregated usage across all workspaces in your organization
                        </p>
                    )}
                </div>

                {/* Toolbar - Matching workspace dashboard style */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                            <Shield className="h-3.5 w-3.5" />
                            <span className="font-medium">Admin Only</span>
                        </div>
                        {/* Currency Selector with live rate */}
                        <CurrencySelector
                            value={currency}
                            onChange={setCurrency}
                            rates={rates}
                            showRates={true}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Date Range Picker */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "justify-start text-left font-normal text-xs bg-muted text-foreground px-3 py-1.5 border border-border hover:bg-muted/80",
                                        !dateRange.from && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                    {dateRange.from ? (
                                        dateRange.to ? (
                                            <>
                                                {format(dateRange.from, "LLL dd")} -{" "}
                                                {format(dateRange.to, "LLL dd, y")}
                                            </>
                                        ) : (
                                            format(dateRange.from, "LLL dd, y")
                                        )
                                    ) : (
                                        <span>Pick a date range</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange.from}
                                    selected={{ from: dateRange.from, to: dateRange.to }}
                                    onSelect={(range) =>
                                        setDateRange({ from: range?.from, to: range?.to })
                                    }
                                    numberOfMonths={2}
                                />
                                <div className="flex gap-2 p-3 border-t">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setDateRange({
                                                from: startOfMonth(new Date()),
                                                to: endOfMonth(new Date()),
                                            })
                                        }
                                    >
                                        This Month
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const lastMonth = subMonths(new Date(), 1);
                                            setDateRange({
                                                from: startOfMonth(lastMonth),
                                                to: endOfMonth(lastMonth),
                                            });
                                        }}
                                    >
                                        Last Month
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => refetchDashboard()}
                            className="h-7 w-7 hover:bg-muted"
                        >
                            <RefreshCw className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>
                </div>

                {/* Main Grid Layout - Matching workspace dashboard 12-column grid */}
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Section (9 columns) */}
                    <div className="col-span-12 xl:col-span-9 space-y-6">
                        {/* KPI Cards */}
                        <UsageKPICards
                            summary={summary}
                            isLoading={isSummaryLoading}
                            currency={currency}
                            exchangeRate={rate}
                        />

                        {/* Charts */}
                        <UsageCharts
                            events={events}
                            summary={summary}
                            isLoading={isEventsLoading || isSummaryLoading}
                            currency={currency}
                            exchangeRate={rate}
                        />

                        {/* Events Table */}
                        <UsageEventsTable
                            events={events}
                            total={totalEvents}
                            isLoading={isEventsLoading}
                            page={page}
                            pageSize={pageSize}
                            onPageChange={setPage}
                            onExport={handleExport}
                            resourceTypeFilters={resourceTypeFilters}
                            sourceFilters={sourceFilters}
                            onResourceTypeFilterChange={setResourceTypeFilters}
                            onSourceFilterChange={setSourceFilters}
                            workspaceNames={workspaceNames}
                            projectNames={projectNames}
                            dateRange={dateRange}
                            onDateRangeChange={setDateRange}
                        />

                        {/* Workspace Breakdown - ORG accounts only */}
                        {isOrg && primaryOrganizationId && (
                            <WorkspaceUsageBreakdown
                                organizationId={primaryOrganizationId}
                                events={dashboardData?.data?.events?.documents || []}
                                summary={summary}
                                workspaces={workspacesData?.documents?.map((w) => ({ $id: w.$id, name: w.name })) || []}
                                isLoading={isEventsLoading || isSummaryLoading}
                            />
                        )}
                    </div>

                    {/* Right Sidebar (3 columns) - Matching workspace dashboard */}
                    <div className="col-span-12 xl:col-span-3">
                        <div className="flex flex-col space-y-6 sticky top-6">
                            {/* Cost Summary - with selected currency */}
                            <CostSummary
                                summary={summary}
                                isLoading={isSummaryLoading}
                                currency={currency}
                                exchangeRate={rate}
                            />

                            {/* Alerts Manager */}
                            <UsageAlertsManager
                                alerts={alerts}
                                workspaceId={workspaceId}
                                isLoading={isAlertsLoading}
                            />
                        </div>
                    </div>
                </div>

                {/* Currency Rate Panel - ORG accounts only, for billing conversion visibility
                {isOrg && (
                    <div className="mt-6">
                        <CurrencyRatePanel />
                    </div>
                )} */}
            </div>
        </div>
    );
}
