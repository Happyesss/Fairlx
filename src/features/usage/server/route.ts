import { Hono } from "hono";
import { ID, Query, Databases } from "node-appwrite";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import {
    DATABASE_ID,
    USAGE_EVENTS_ID,
    USAGE_AGGREGATIONS_ID,
    USAGE_ALERTS_ID,
    INVOICES_ID,
    USAGE_RATE_TRAFFIC_GB,
    USAGE_RATE_STORAGE_GB_MONTH,
    USAGE_RATE_COMPUTE_UNIT,
    ORGANIZATION_MEMBERS_ID,
    WORKSPACES_ID,
    ORG_MEMBER_DEPARTMENTS_ID,
    DEPARTMENT_PERMISSIONS_ID,
} from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";
import { createAdminClient } from "@/lib/appwrite";
import { getMember } from "@/features/members/utils";
import { MemberRole } from "@/features/members/types";
import { OrganizationRole, OrgMemberStatus } from "@/features/organizations/types";
import { OrgPermissionKey } from "@/features/org-permissions/types";

import {
    createUsageEventSchema,
    getUsageEventsSchema,
    exportUsageSchema,
    getUsageAggregationsSchema,
    calculateAggregationSchema,
    getUsageSummarySchema,
    createUsageAlertSchema,
    updateUsageAlertSchema,
    getUsageAlertsSchema,
    getInvoicesSchema,
} from "../schemas";
import {
    UsageEvent,
    UsageAggregation,
    UsageAlert,
    UsageSummary,
    Invoice,
    ResourceType,
    UsageSource,
} from "../types";

// Helper to check workspace-level admin access
async function checkAdminAccess(
    databases: Parameters<typeof getMember>[0]["databases"],
    workspaceId: string,
    userId: string
): Promise<boolean> {
    const member = await getMember({ databases, workspaceId, userId });
    return member?.role === MemberRole.ADMIN || member?.role === MemberRole.OWNER;
}

/**
 * Helper to check organization-level billing access
 * 
 * PERFORMANCE OPTIMIZED:
 * - Fast path: Check if user is OWNER first (single DB query)
 * - Only resolve full permissions if not OWNER
 * - In-memory cache for repeated calls within same request
 * 
 * ACCESS GRANTED TO:
 * - OWNER (always has full access)
 * - Any user with BILLING_VIEW permission via department membership
 */

const CACHE_TTL_MS = 30_000; // 30 seconds

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

// In-memory cache for permission checks (TTL-based to handle serverless persistence)
const permissionCache = new Map<string, CacheEntry<boolean>>();

async function checkOrgAdminAccess(
    databases: Databases,
    organizationId: string,
    userId: string
): Promise<boolean> {
    // Check cache first (avoids repeated DB queries in same request)
    const cacheKey = `${organizationId}:${userId}`;
    const cached = permissionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }

    const setCache = (value: boolean) => {
        permissionCache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    };

    try {
        // FAST PATH: Check if user is OWNER first (single query)
        const membership = await databases.listDocuments(
            DATABASE_ID,
            ORGANIZATION_MEMBERS_ID,
            [
                Query.equal("organizationId", organizationId),
                Query.equal("userId", userId),
                Query.equal("status", OrgMemberStatus.ACTIVE),
                Query.limit(1),
            ]
        );

        if (membership.total === 0) {
            setCache(false);
            return false;
        }

        const member = membership.documents[0];

        // OWNER always has access - fast path complete
        if (member.role === OrganizationRole.OWNER) {
            setCache(true);
            return true;
        }

        // NON-OWNER: Check department permissions
        // Get user's department assignments
        const deptAssignments = await databases.listDocuments(
            DATABASE_ID,
            ORG_MEMBER_DEPARTMENTS_ID,
            [Query.equal("orgMemberId", member.$id)]
        );

        if (deptAssignments.total === 0) {
            setCache(false);
            return false;
        }

        const departmentIds = deptAssignments.documents.map((d) => (d as unknown as { departmentId: string }).departmentId);

        // Check if any department has BILLING_VIEW permission
        const { databases: adminDb } = await createAdminClient();

        const billingPermissions = await adminDb.listDocuments(
            DATABASE_ID,
            DEPARTMENT_PERMISSIONS_ID,
            [
                Query.equal("departmentId", departmentIds),
                Query.equal("permissionKey", OrgPermissionKey.BILLING_VIEW),
                Query.limit(1),
            ]
        );

        const hasAccess = billingPermissions.total > 0;
        setCache(hasAccess);
        return hasAccess;
    } catch {
        setCache(false);
        return false;
    }
}

/**
 * Helper to get all workspace IDs belonging to an organization
 * 
 * PERFORMANCE OPTIMIZED: Cached to avoid repeated queries in same request
 * 
 * WHY: For org-level usage queries, we need to aggregate usage across all
 * workspaces in the organization. This fetches all workspace IDs to use
 * in Query.equal("workspaceId", [...]) filters.
 */
const workspaceCache = new Map<string, CacheEntry<string[]>>();

async function getOrgWorkspaceIds(
    databases: Databases,
    organizationId: string
): Promise<string[]> {
    // Check cache first
    const cached = workspaceCache.get(organizationId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }

    const setCache = (value: string[]) => {
        workspaceCache.set(organizationId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    };

    try {
        const workspaces = await databases.listDocuments(
            DATABASE_ID,
            WORKSPACES_ID,
            [
                Query.equal("organizationId", organizationId),
                Query.limit(100), // Max workspaces per org
            ]
        );

        const workspaceIds = workspaces.documents.map((ws: { $id: string }) => ws.$id);
        setCache(workspaceIds);
        return workspaceIds;
    } catch {
        setCache([]);
        return [];
    }
}

/**
 * PERFORMANCE OPTIMIZED: Combined access check + workspace lookup
 * 
 * WHY: Every usage endpoint was calling checkOrgAdminAccess THEN getOrgWorkspaceIds
 * sequentially (~3-4s combined). These are independent and can run in parallel (~1.5-2s).
 * 
 * With 5+ endpoints on the usage page loading simultaneously, this saves 5-10s of total wall time.
 */
async function checkOrgAccessAndGetWorkspaces(
    databases: Databases,
    organizationId: string,
    userId: string
): Promise<{ isAdmin: boolean; workspaceIds: string[] }> {
    const [isAdmin, workspaceIds] = await Promise.all([
        checkOrgAdminAccess(databases, organizationId, userId),
        getOrgWorkspaceIds(databases, organizationId),
    ]);
    return { isAdmin, workspaceIds };
}

/**
 * CRITICAL ITEM 3: Determine billing entity for a usage event based on timestamp
 * 
 * BILLING ATTRIBUTION TIMELINE SAFETY
 * ====================================
 * 
 * AUTHORITATIVE RULE:
 *   billingEffectiveAt = organization.billingStartAt (= accountConversionCompletedAt)
 * 
 *   IF usage.createdAt < billingEffectiveAt → bill PERSONAL account
 *   ELSE → bill ORGANIZATION
 * 
 * WHY THIS MATTERS:
 * - When PERSONAL converts to ORG, historical usage stays with the user
 * - Only post-conversion usage bills to organization
 * - Prevents retroactive billing reassignment
 * 
 * HANDLING DELAYED INGESTION:
 * - Usage events may arrive out-of-order (async ingestion)
 * - We use event.timestamp (when usage occurred), NOT ingestion time
 * - This ensures late-arriving events are correctly attributed
 * 
 * LOGIC:
 * - If workspace has no org: bill to user (via workspace.userId)
 * - If workspace has org AND event BEFORE org.billingStartAt: bill to user
 * - If workspace has org AND event AFTER org.billingStartAt: bill to org
 * 
 * This ensures correct revenue attribution across conversion boundaries.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getBillingEntityForEvent(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    databases: Databases,
    workspaceId: string,
    eventTimestamp: string
): Promise<{ entityId: string; entityType: "user" | "organization" }> {
    try {
        // Get workspace to check organizationId
        const workspace = await databases.getDocument(
            DATABASE_ID,
            "workspaces",
            workspaceId
        );

        // If no organization, bill to workspace owner (user)
        if (!workspace.organizationId) {
            return {
                entityId: workspace.userId,
                entityType: "user",
            };
        }

        // Get organization to check billingStartAt
        const organization = await databases.getDocument(
            DATABASE_ID,
            "organizations",
            workspace.organizationId
        );

        const billingStartAt = organization.billingStartAt
            ? new Date(organization.billingStartAt)
            : null;
        const eventDate = new Date(eventTimestamp);

        // If event occurred before org billing started, bill to user
        if (billingStartAt && eventDate < billingStartAt) {
            return {
                entityId: workspace.userId,
                entityType: "user",
            };
        }

        // Event after org billing started, bill to organization
        return {
            entityId: workspace.organizationId,
            entityType: "organization",
        };
    } catch {
        // Fallback: bill to workspace owner
        try {
            const workspace = await databases.getDocument(
                DATABASE_ID,
                "workspaces",
                workspaceId
            );
            return {
                entityId: workspace.userId,
                entityType: "user",
            };
        } catch {
            throw new Error("Cannot determine billing entity");
        }
    }
}

// Convert bytes to GB
function bytesToGB(bytes: number): number {
    return bytes / (1024 * 1024 * 1024);
}

// Calculate cost based on usage (in BILLING_CURRENCY)
function calculateCost(
    trafficGB: number,
    storageAvgGB: number,
    computeUnits: number
) {
    const traffic = Number((trafficGB * USAGE_RATE_TRAFFIC_GB).toFixed(6));
    const storage = Number((storageAvgGB * USAGE_RATE_STORAGE_GB_MONTH).toFixed(6));
    const compute = Number((computeUnits * USAGE_RATE_COMPUTE_UNIT).toFixed(6));
    
    return {
        traffic,
        storage,
        compute,
        total: Number((traffic + storage + compute).toFixed(6)),
    };
}

const app = new Hono()
    // ===============================
    // COMBINED DASHBOARD ENDPOINT
    // WHY: The usage page was making 3+ independent API calls, each running
    // session auth + org access check + workspace lookup (~3-5s overhead per call).
    // This combined endpoint does auth/access ONCE and fetches all data in parallel.
    // Expected improvement: ~20s → ~5-8s for full page data load.
    // ===============================
    .get(
        "/dashboard",
        sessionMiddleware,
        zValidator("query", z.object({
            organizationId: z.string().optional(),
            workspaceId: z.string().optional(),
            period: z.string().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            eventsLimit: z.coerce.number().optional().default(10),
            eventsOffset: z.coerce.number().optional().default(0),
        })),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const params = c.req.valid("query");

            // Default period to current month
            const targetPeriod = params.period || new Date().toISOString().slice(0, 7);
            const monthStart = `${targetPeriod}-01T00:00:00.000Z`;
            const nextMonth = new Date(targetPeriod + "-01");
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            const monthEnd = nextMonth.toISOString();

            let orgWorkspaceIds: string[] = [];

            // SINGLE access check (instead of 3 separate ones)
            if (params.organizationId) {
                const { isAdmin: isOrgAdmin, workspaceIds } = await checkOrgAccessAndGetWorkspaces(
                    databases, params.organizationId, user.$id
                );
                if (!isOrgAdmin) {
                    return c.json({ error: "Organization admin access required" }, 403);
                }
                orgWorkspaceIds = workspaceIds;
                if (orgWorkspaceIds.length === 0) {
                    // Return empty dashboard data
                    return c.json({
                        data: {
                            events: { documents: [], total: 0 },
                            summary: {
                                period: targetPeriod,
                                trafficTotalBytes: 0, trafficTotalGB: 0,
                                storageAvgBytes: 0, storageAvgGB: 0,
                                computeTotalUnits: 0,
                                estimatedCost: { traffic: 0, storage: 0, compute: 0, total: 0 },
                                eventCount: 0,
                                breakdown: { bySource: {}, byResourceType: {}, byWorkspace: {} },
                                dailyUsage: [],
                            },
                            alerts: { documents: [], total: 0 },
                        }
                    });
                }
            } else if (params.workspaceId) {
                const isAdmin = await checkAdminAccess(databases, params.workspaceId, user.$id);
                if (!isAdmin) {
                    return c.json({ error: "Admin access required" }, 403);
                }
            } else {
                return c.json({ error: "Either workspaceId or organizationId is required" }, 400);
            }

            // Build workspace filter
            const wsFilter = params.organizationId
                ? Query.equal("workspaceId", orgWorkspaceIds)
                : Query.equal("workspaceId", params.workspaceId!);

            // PARALLEL: Fetch latest aggregation + events + alerts
            // We need to know the latest aggregated date to avoid missing "yesterday's" events
            // if the cron hasn't run yet.
            const latestAggResult = await databases.listDocuments<UsageAggregation>(
                DATABASE_ID, USAGE_AGGREGATIONS_ID,
                [
                    ...(params.organizationId
                        ? [Query.equal("workspaceId", orgWorkspaceIds)]
                        : [Query.equal("workspaceId", params.workspaceId!)]),
                    Query.orderDesc("period"),
                    Query.limit(1),
                ]
            ).catch(() => ({ documents: [] as UsageAggregation[] }));

            const latestAggDate = latestAggResult.documents[0]?.period || monthStart.split("T")[0];
            const liveEventsStart = new Date(latestAggDate);
            liveEventsStart.setDate(liveEventsStart.getDate() + 1);
            const liveEventsStartISO = liveEventsStart.toISOString().split("T")[0] + "T00:00:00.000Z";
            
            const [eventsResult, dailySummariesResult, todayEventsResult, alertsResult] = await Promise.all([
                // 1. Events (paginated, for the events table)
                databases.listDocuments<UsageEvent>(
                    DATABASE_ID, USAGE_EVENTS_ID,
                    [
                        wsFilter,
                        Query.orderDesc("timestamp"),
                        Query.limit(params.eventsLimit),
                        Query.offset(params.eventsOffset),
                        ...(params.startDate ? [Query.greaterThanEqual("timestamp", params.startDate)] : []),
                        ...(params.endDate ? [Query.lessThanEqual("timestamp", params.endDate)] : []),
                    ]
                ).catch(() => ({ documents: [] as UsageEvent[], total: 0 })),

                // 2. Daily summaries for the month (pre-aggregated, ~30 records max)
                databases.listDocuments<UsageAggregation>(
                    DATABASE_ID, USAGE_AGGREGATIONS_ID,
                    [
                        ...(params.organizationId
                            ? [Query.equal("workspaceId", orgWorkspaceIds)]
                            : [Query.equal("workspaceId", params.workspaceId!)]),
                        Query.greaterThanEqual("period", monthStart.split("T")[0]),
                        Query.lessThanEqual("period", monthEnd.split("T")[0]),
                        Query.orderAsc("period"),
                        Query.limit(200),
                    ]
                ).catch(() => ({ documents: [] as UsageAggregation[], total: 0 })),

                // 3. Live events (not yet aggregated)
                databases.listDocuments<UsageEvent>(
                    DATABASE_ID, USAGE_EVENTS_ID,
                    [
                        wsFilter,
                        Query.greaterThanEqual("timestamp", liveEventsStartISO),
                        Query.limit(5000),
                    ]
                ).catch(() => ({ documents: [] as UsageEvent[], total: 0 })),

                // 4. Alerts
                databases.listDocuments<UsageAlert>(
                    DATABASE_ID, USAGE_ALERTS_ID,
                    [wsFilter, Query.orderDesc("$createdAt")]
                ).catch(() => ({ documents: [] as UsageAlert[], total: 0 })),
            ]);

            // Compute summary from daily summaries + today's live events
            let trafficTotalGB = 0;
            let storageAvgGB = 0;
            let computeTotalUnits = 0;
            const byWorkspace: Record<string, { traffic: number; storage: number; compute: number }> = {};
            const dailyUsageMap: Record<string, Record<string, number | string>> = {};

            // Process daily summaries (fast — ~30 records)
            // NOTE: Daily summaries store values in GB, but the chart component expects
            //       bytes and auto-scales to KB/MB/GB. So we convert GB→bytes here.

            for (const summary of dailySummariesResult.documents) {
                const sTrafficGB = bytesToGB(summary.trafficBytes || 0);
                const sStorageGB = bytesToGB(summary.storageBytes || 0);
                const sComputeUnits = summary.computeUnits || 0;

                trafficTotalGB += sTrafficGB;
                storageAvgGB += sStorageGB;
                computeTotalUnits += sComputeUnits;

                // Per-workspace breakdown (kept in GB for KPI cards)
                const wsId = summary.workspaceId;
                if (!byWorkspace[wsId]) {
                    byWorkspace[wsId] = { traffic: 0, storage: 0, compute: 0 };
                }
                byWorkspace[wsId].traffic += sTrafficGB;
                byWorkspace[wsId].storage += sStorageGB;
                byWorkspace[wsId].compute += sComputeUnits;

                // Daily chart data — converted to BYTES for chart component
                const date = summary.period; // YYYY-MM-DD
                if (!dailyUsageMap[date]) {
                    dailyUsageMap[date] = { date, traffic: 0, storage: 0, compute: 0 };
                }
                dailyUsageMap[date].traffic = (dailyUsageMap[date].traffic as number) + (summary.trafficBytes || 0);
                dailyUsageMap[date].storage = (dailyUsageMap[date].storage as number) + (summary.storageBytes || 0);
                dailyUsageMap[date].compute = (dailyUsageMap[date].compute as number) + sComputeUnits;
            }

            const bySource: Record<string, number> = { api: 0, file: 0, job: 0, ai: 0 };
            const byResourceType: Record<string, number> = { traffic: 0, storage: 0, compute: 0 };

            for (const event of todayEventsResult.documents) {
                const eventUnits = event.units ?? 0;
                const weightedUnits = event.weightedUnits || eventUnits;
                
                bySource[event.source] = (bySource[event.source] || 0) + weightedUnits;
                byResourceType[event.resourceType] = (byResourceType[event.resourceType] || 0) + weightedUnits;

                if (event.workspaceId) {
                    if (!byWorkspace[event.workspaceId]) {
                        byWorkspace[event.workspaceId] = { traffic: 0, storage: 0, compute: 0 };
                    }
                    switch (event.resourceType) {
                        case ResourceType.TRAFFIC:
                            byWorkspace[event.workspaceId].traffic += bytesToGB(eventUnits);
                            break;
                        case ResourceType.STORAGE:
                            byWorkspace[event.workspaceId].storage += bytesToGB(eventUnits);
                            break;
                        case ResourceType.COMPUTE:
                            byWorkspace[event.workspaceId].compute += weightedUnits;
                            break;
                    }
                }

                // Add live data to chart by collapsing events into their respective dates
                const eventDate = event.timestamp.split("T")[0];
                if (!dailyUsageMap[eventDate]) {
                    dailyUsageMap[eventDate] = { date: eventDate, traffic: 0, storage: 0, compute: 0 };
                }
                
                switch (event.resourceType) {
                    case ResourceType.TRAFFIC:
                        dailyUsageMap[eventDate].traffic = (dailyUsageMap[eventDate].traffic as number) + (eventUnits);
                        break;
                    case ResourceType.STORAGE:
                        dailyUsageMap[eventDate].storage = (dailyUsageMap[eventDate].storage as number) + (eventUnits);
                        break;
                    case ResourceType.COMPUTE:
                        dailyUsageMap[eventDate].compute = (dailyUsageMap[eventDate].compute as number) + (weightedUnits);
                        break;
                }
            }

            // Total event count
            const totalEventCount = dailySummariesResult.total + todayEventsResult.total;

            return c.json({
                data: {
                    events: {
                        documents: eventsResult.documents,
                        total: eventsResult.total,
                    },
                    summary: {
                        period: targetPeriod,
                        trafficTotalBytes: Number((trafficTotalGB * 1024 * 1024 * 1024).toFixed(0)),
                        trafficTotalGB: Number(trafficTotalGB.toFixed(6)),
                        storageAvgBytes: Number((storageAvgGB * 1024 * 1024 * 1024).toFixed(0)),
                        storageAvgGB: Number(storageAvgGB.toFixed(6)),
                        computeTotalUnits: Number(computeTotalUnits.toFixed(0)),
                        estimatedCost: calculateCost(trafficTotalGB, storageAvgGB, computeTotalUnits),
                        eventCount: totalEventCount,
                        breakdown: {
                            bySource: bySource as Record<UsageSource, number>,
                            byResourceType: byResourceType as Record<ResourceType, number>,
                            byWorkspace: byWorkspace as Record<string, { [ResourceType.TRAFFIC]: number; [ResourceType.STORAGE]: number; [ResourceType.COMPUTE]: number }>,
                        },
                        dailyUsage: Object.values(dailyUsageMap).sort((a, b) => (a.date as string).localeCompare(b.date as string)) as { date: string; [key: string]: number | string }[],
                    },
                    alerts: {
                        documents: alertsResult.documents,
                        total: alertsResult.total,
                    },
                }
            });
        }
    )

    // ===============================
    // Usage Events Endpoints
    // ===============================

    // GET /usage/events - List usage events (paginated)
    .get(
        "/events",
        sessionMiddleware,
        zValidator("query", getUsageEventsSchema),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const params = c.req.valid("query");


            // Build base query
            const queries = [
                Query.orderDesc("timestamp"),
                Query.limit(params.limit),
                Query.offset(params.offset),
            ];

            // Handle org-level vs workspace-level query
            if (params.organizationId) {
                // OPTIMIZED: Parallel access check + workspace lookup
                const { isAdmin: isOrgAdmin, workspaceIds: orgWorkspaceIds } = await checkOrgAccessAndGetWorkspaces(databases, params.organizationId, user.$id);
                if (!isOrgAdmin) {
                    return c.json({ error: "Organization admin access required" }, 403);
                }
                if (orgWorkspaceIds.length === 0) {
                    return c.json({ data: { documents: [], total: 0 } });
                }
                queries.push(Query.equal("workspaceId", orgWorkspaceIds));
            } else if (params.workspaceId) {
                // Workspace-level: check workspace admin access
                const isAdmin = await checkAdminAccess(databases, params.workspaceId, user.$id);
                if (!isAdmin) {
                    return c.json({ error: "Admin access required" }, 403);
                }
                queries.push(Query.equal("workspaceId", params.workspaceId));
            } else {
                return c.json({ error: "Either workspaceId or organizationId is required" }, 400);
            }

            if (params.projectId) {
                queries.push(Query.equal("projectId", params.projectId));
            }
            if (params.resourceType) {
                queries.push(Query.equal("resourceType", params.resourceType));
            }
            if (params.source) {
                queries.push(Query.equal("source", params.source));
            }
            if (params.startDate) {
                queries.push(Query.greaterThanEqual("timestamp", params.startDate));
            }
            if (params.endDate) {
                queries.push(Query.lessThanEqual("timestamp", params.endDate));
            }

            const events = await databases.listDocuments<UsageEvent>(
                DATABASE_ID,
                USAGE_EVENTS_ID,
                queries
            );

            return c.json({ data: events });
        }
    )

    // POST /usage/events - Create usage event
    .post(
        "/events",
        sessionMiddleware,
        zValidator("json", createUsageEventSchema),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const data = c.req.valid("json");

            // SECURITY: Check billing suspension before allowing usage writes
            const { assertBillingNotSuspended } = await import("@/lib/billing-primitives");
            try {
                await assertBillingNotSuspended(databases, { workspaceId: data.workspaceId });
            } catch {
                return c.json({
                    error: "Account suspended - cannot record usage",
                    code: "BILLING_SUSPENDED"
                }, 403);
            }

            // Check admin access (or allow internal service calls)
            const isAdmin = await checkAdminAccess(databases, data.workspaceId, user.$id);
            if (!isAdmin) {
                return c.json({ error: "Admin access required" }, 403);
            }

            const event = await databases.createDocument<UsageEvent>(
                DATABASE_ID,
                USAGE_EVENTS_ID,
                ID.unique(),
                {
                    workspaceId: data.workspaceId,
                    projectId: data.projectId || null,
                    resourceType: data.resourceType,
                    units: data.units,
                    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
                    timestamp: data.timestamp || new Date().toISOString(),
                    source: data.source,
                }
            );

            return c.json({ data: event }, 201);
        }
    )

    // GET /usage/events/export - Export usage events
    .get(
        "/events/export",
        sessionMiddleware,
        zValidator("query", exportUsageSchema),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const params = c.req.valid("query");

            // Build base query for export (fetch all matching events)
            const queries = [
                Query.orderDesc("timestamp"),
                Query.limit(10000), // Max export limit
            ];

            // Handle org-level vs workspace-level export
            if (params.organizationId) {
                // OPTIMIZED: Parallel access check + workspace lookup
                const { isAdmin: isOrgAdmin, workspaceIds: orgWorkspaceIds } = await checkOrgAccessAndGetWorkspaces(databases, params.organizationId, user.$id);
                if (!isOrgAdmin) {
                    return c.json({ error: "Organization admin access required" }, 403);
                }
                if (orgWorkspaceIds.length === 0) {
                    return c.json({ data: [] });
                }
                queries.push(Query.equal("workspaceId", orgWorkspaceIds));
            } else if (params.workspaceId) {
                const isAdmin = await checkAdminAccess(databases, params.workspaceId, user.$id);
                if (!isAdmin) {
                    return c.json({ error: "Admin access required" }, 403);
                }
                queries.push(Query.equal("workspaceId", params.workspaceId));
            } else {
                return c.json({ error: "Either workspaceId or organizationId is required" }, 400);
            }

            if (params.resourceType) {
                queries.push(Query.equal("resourceType", params.resourceType));
            }
            if (params.startDate) {
                queries.push(Query.greaterThanEqual("timestamp", params.startDate));
            }
            if (params.endDate) {
                queries.push(Query.lessThanEqual("timestamp", params.endDate));
            }

            const events = await databases.listDocuments<UsageEvent>(
                DATABASE_ID,
                USAGE_EVENTS_ID,
                queries
            );

            if (params.format === "json") {
                return c.json({ data: events.documents });
            }

            // Generate CSV
            const headers = [
                "id",
                "workspaceId",
                "projectId",
                "resourceType",
                "units",
                "source",
                "timestamp",
                "metadata",
            ];
            const csvRows = [headers.join(",")];

            for (const event of events.documents) {
                const row = [
                    event.$id,
                    event.workspaceId,
                    event.projectId || "",
                    event.resourceType,
                    event.units.toString(),
                    event.source,
                    event.timestamp,
                    event.metadata ? `"${event.metadata.replace(/"/g, '""')}"` : "",
                ];
                csvRows.push(row.join(","));
            }

            const csv = csvRows.join("\n");
            return c.text(csv, 200, {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="usage-export-${new Date().toISOString().split("T")[0]}.csv"`,
            });
        }
    )

    // GET /usage/summary - Get usage summary for current period
    // 
    // CRITICAL FIX IMPLEMENTED: Filters events by billing entity
    // Events are attributed to org or user based on billingEntityType stored at creation
    .get(
        "/summary",
        sessionMiddleware,
        zValidator("query", getUsageSummarySchema),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const { workspaceId, organizationId, period } = c.req.valid("query");

            // Default to current month
            const targetPeriod = period || new Date().toISOString().slice(0, 7);
            const startOfMonth = `${targetPeriod}-01T00:00:00.000Z`;
            const nextMonth = new Date(targetPeriod + "-01");
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            const endOfMonth = nextMonth.toISOString();

            // Build base query
            const queries = [
                Query.greaterThanEqual("timestamp", startOfMonth),
                Query.lessThan("timestamp", endOfMonth),
                Query.limit(5000), // Reduced from 10000 for better performance
            ];

            // Handle org-level vs workspace-level query
            if (organizationId) {
                // OPTIMIZED: Parallel access check + workspace lookup
                const { isAdmin: isOrgAdmin, workspaceIds: orgWorkspaceIds } = await checkOrgAccessAndGetWorkspaces(databases, organizationId, user.$id);
                if (!isOrgAdmin) {
                    return c.json({ error: "Organization admin access required" }, 403);
                }
                if (orgWorkspaceIds.length === 0) {
                    return c.json({
                        data: {
                            period: targetPeriod,
                            trafficTotalBytes: 0,
                            trafficTotalGB: 0,
                            storageAvgBytes: 0,
                            storageAvgGB: 0,
                            computeTotalUnits: 0,
                            estimatedCost: { traffic: 0, storage: 0, compute: 0, total: 0 },
                            eventCount: 0,
                            breakdown: { bySource: {}, byResourceType: {} },
                        }
                    });
                }
                queries.push(Query.equal("workspaceId", orgWorkspaceIds));
            } else if (workspaceId) {
                const isAdmin = await checkAdminAccess(databases, workspaceId, user.$id);
                if (!isAdmin) {
                    return c.json({ error: "Admin access required" }, 403);
                }
                queries.push(Query.equal("workspaceId", workspaceId));
            } else {
                return c.json({ error: "Either workspaceId or organizationId is required" }, 400);
            }

            // Fetch events for the period
            const events = await databases.listDocuments<UsageEvent>(
                DATABASE_ID,
                USAGE_EVENTS_ID,
                queries
            );

            // Calculate totals
            let trafficTotalBytes = 0;
            let storageTotalBytes = 0;
            let computeTotalUnits = 0;
            const bySource: Record<string, number> = {
                api: 0,
                file: 0,
                job: 0,
                ai: 0,
            };
            const byResourceType: Record<string, number> = {
                traffic: 0,
                storage: 0,
                compute: 0,
            };
            const byWorkspace: Record<string, { traffic: number, storage: number, compute: number }> = {};
            const dailyUsageMap: Record<string, Record<string, number | string>> = {};

            for (const event of events.documents) {
                const date = event.timestamp.split("T")[0];
                if (!dailyUsageMap[date]) {
                    dailyUsageMap[date] = { date, docs: 0, github: 0, ai: 0, traffic: 0, storage: 0, compute: 0 };
                }

                // Extract moduleName for daily breakdown
                let moduleName = event.resourceType as string;
                if (event.metadata) {
                    try {
                        const meta = typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata;
                        if (meta.module) moduleName = meta.module.toLowerCase();
                    } catch { /* ignore */ }
                }

                bySource[event.source] = (bySource[event.source] || 0) + event.units;
                byResourceType[event.resourceType] =
                    (byResourceType[event.resourceType] || 0) + event.units;

                const units = event.resourceType === ResourceType.COMPUTE
                    ? (event.weightedUnits || event.units)
                    : event.units;

                // Workspace-level breakdown
                if (event.workspaceId) {
                    if (!byWorkspace[event.workspaceId]) {
                        byWorkspace[event.workspaceId] = { traffic: 0, storage: 0, compute: 0 };
                    }
                    byWorkspace[event.workspaceId][event.resourceType as keyof typeof byWorkspace[string]] += units;
                }

                // Add to daily usage map
                if (dailyUsageMap[date][moduleName] !== undefined) {
                    dailyUsageMap[date][moduleName] = (dailyUsageMap[date][moduleName] as number) + units;
                } else {
                    // Fallback if module is unexpected
                    dailyUsageMap[date][moduleName] = units;
                }

                switch (event.resourceType) {
                    case ResourceType.TRAFFIC:
                        trafficTotalBytes += event.units;
                        break;
                    case ResourceType.STORAGE:
                        storageTotalBytes += event.units;
                        break;
                    case ResourceType.COMPUTE:
                        // WHY: Use weightedUnits for billing if available
                        // This ensures AI operations are billed at higher rates
                        // Falls back to raw units for backward compatibility
                        computeTotalUnits += event.weightedUnits || event.units;
                        break;
                }
            }

            // For storage billing: use total bytes (sum of uploads - deletes)
            // NOT an average across all events - that was diluting the value incorrectly
            const trafficTotalGB = bytesToGB(trafficTotalBytes);
            const storageAvgGB = bytesToGB(storageTotalBytes);

            const summary: UsageSummary = {
                period: targetPeriod,
                trafficTotalBytes,
                trafficTotalGB,
                storageAvgBytes: storageTotalBytes,
                storageAvgGB,
                computeTotalUnits,
                estimatedCost: calculateCost(trafficTotalGB, storageAvgGB, computeTotalUnits),
                eventCount: events.total,
                breakdown: {
                    bySource: bySource as Record<UsageSource, number>,
                    byResourceType: byResourceType as Record<ResourceType, number>,
                    byWorkspace: byWorkspace as Record<string, { [ResourceType.TRAFFIC]: number, [ResourceType.STORAGE]: number, [ResourceType.COMPUTE]: number }>,
                },
                dailyUsage: Object.values(dailyUsageMap).sort((a, b) => (a.date as string).localeCompare(b.date as string)) as { date: string;[key: string]: number | string }[],
            };

            return c.json({ data: summary });
        }
    )

    // ===============================
    // Usage Aggregations Endpoints
    // ===============================

    // GET /usage/aggregations - List aggregations
    .get(
        "/aggregations",
        sessionMiddleware,
        zValidator("query", getUsageAggregationsSchema),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const { workspaceId, organizationId, startPeriod, endPeriod } = c.req.valid("query");

            // Build base query
            const queries = [
                Query.orderDesc("period"),
                Query.limit(24), // Last 2 years
            ];

            // Handle org-level vs workspace-level query
            if (organizationId) {
                // OPTIMIZED: Parallel access check + workspace lookup
                const { isAdmin: isOrgAdmin, workspaceIds: orgWorkspaceIds } = await checkOrgAccessAndGetWorkspaces(databases, organizationId, user.$id);
                if (!isOrgAdmin) {
                    return c.json({ error: "Organization admin access required" }, 403);
                }
                if (orgWorkspaceIds.length === 0) {
                    return c.json({ data: { documents: [], total: 0 } });
                }
                queries.push(Query.equal("workspaceId", orgWorkspaceIds));
            } else if (workspaceId) {
                const isAdmin = await checkAdminAccess(databases, workspaceId, user.$id);
                if (!isAdmin) {
                    return c.json({ error: "Admin access required" }, 403);
                }
                queries.push(Query.equal("workspaceId", workspaceId));
            } else {
                return c.json({ error: "Either workspaceId or organizationId is required" }, 400);
            }

            if (startPeriod) {
                queries.push(Query.greaterThanEqual("period", startPeriod));
            }
            if (endPeriod) {
                queries.push(Query.lessThanEqual("period", endPeriod));
            }

            const aggregations = await databases.listDocuments<UsageAggregation>(
                DATABASE_ID,
                USAGE_AGGREGATIONS_ID,
                queries
            );

            return c.json({ data: aggregations });
        }
    )

    // POST /usage/aggregations/calculate - Calculate aggregation for a period
    //
    // CRITICAL FIX IMPLEMENTED: Filters events by billing entity
    // Aggregations respect billing entity boundaries for accurate org/user split
    //
    // PRODUCTION HARDENING:
    // - Checks billing status (suspended accounts cannot recalculate)
    // - Finalized periods are immutable
    // - Uses isFinalized flag to prevent concurrent modifications
    .post(
        "/aggregations/calculate",
        sessionMiddleware,
        zValidator("json", calculateAggregationSchema),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const { workspaceId, period, billingEntityId } = c.req.valid("json");

            // PRODUCTION HARDENING: Check billing status
            const { assertBillingNotSuspended } = await import("@/lib/billing-primitives");
            try {
                await assertBillingNotSuspended(databases, { workspaceId });
            } catch {
                return c.json({
                    error: "Account suspended - cannot calculate aggregations",
                    code: "BILLING_SUSPENDED"
                }, 403);
            }

            // Check admin access
            const isAdmin = await checkAdminAccess(databases, workspaceId, user.$id);
            if (!isAdmin) {
                return c.json({ error: "Admin access required" }, 403);
            }

            // Check if aggregation already exists
            const aggregationQuery = [
                Query.equal("workspaceId", workspaceId),
                Query.equal("period", period),
            ];

            // If billing entity specified, check for entity-specific aggregation
            if (billingEntityId) {
                aggregationQuery.push(Query.equal("billingEntityId", billingEntityId));
            }

            const existing = await databases.listDocuments<UsageAggregation>(
                DATABASE_ID,
                USAGE_AGGREGATIONS_ID,
                aggregationQuery
            );

            // HARD LOCK: Finalized periods MUST NOT be modified
            // WHY: Once billing is finalized, data becomes immutable for audit
            if (existing.total > 0 && existing.documents[0].isFinalized) {
                throw new Error("BILLING_PERIOD_LOCKED: Cannot recalculate finalized period. This period has been invoiced and is immutable.");
            }

            // Calculate aggregation
            const startOfMonth = `${period}-01T00:00:00.000Z`;
            const nextMonth = new Date(period + "-01");
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            const endOfMonth = nextMonth.toISOString();

            // Build query with billing entity filter
            const eventQueries = [
                Query.equal("workspaceId", workspaceId),
                Query.greaterThanEqual("timestamp", startOfMonth),
                Query.lessThan("timestamp", endOfMonth),
                Query.limit(10000),
            ];

            // CRITICAL: Filter by billing entity for accurate attribution
            if (billingEntityId) {
                eventQueries.push(Query.equal("billingEntityId", billingEntityId));
            }

            const events = await databases.listDocuments<UsageEvent>(
                DATABASE_ID,
                USAGE_EVENTS_ID,
                eventQueries
            );

            let trafficTotalBytes = 0;
            let storageTotalBytes = 0;
            let computeTotalUnits = 0;

            for (const event of events.documents) {
                switch (event.resourceType) {
                    case ResourceType.TRAFFIC:
                        trafficTotalBytes += event.units;
                        break;
                    case ResourceType.STORAGE:
                        storageTotalBytes += event.units;
                        break;
                    case ResourceType.COMPUTE:
                        // WHY: Use weightedUnits for accurate billing
                        // AI operations have higher weights than basic CRUD
                        computeTotalUnits += event.weightedUnits || event.units;
                        break;
                }
            }

            const trafficTotalGB = bytesToGB(trafficTotalBytes);
            const storageAvgGB = bytesToGB(storageTotalBytes / Math.max(events.total, 1));

            // Create or update aggregation
            let aggregation: UsageAggregation;
            if (existing.total > 0) {
                aggregation = await databases.updateDocument<UsageAggregation>(
                    DATABASE_ID,
                    USAGE_AGGREGATIONS_ID,
                    existing.documents[0].$id,
                    {
                        trafficTotalGB,
                        storageAvgGB,
                        computeTotalUnits,
                    }
                );
            } else {
                aggregation = await databases.createDocument<UsageAggregation>(
                    DATABASE_ID,
                    USAGE_AGGREGATIONS_ID,
                    ID.unique(),
                    {
                        workspaceId,
                        period,
                        trafficTotalGB,
                        storageAvgGB,
                        computeTotalUnits,
                        createdAt: new Date().toISOString(),
                        isFinalized: false,
                    }
                );
            }

            return c.json({ data: aggregation });
        }
    )

    // ===============================
    // Usage Alerts Endpoints
    // ===============================

    // GET /usage/alerts - List alerts
    .get(
        "/alerts",
        sessionMiddleware,
        zValidator("query", getUsageAlertsSchema),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const { workspaceId, organizationId } = c.req.valid("query");

            // Build base query
            const queries = [
                Query.orderDesc("$createdAt"),
            ];

            // Handle org-level vs workspace-level query
            if (organizationId) {
                // OPTIMIZED: Parallel access check + workspace lookup
                const { isAdmin: isOrgAdmin, workspaceIds: orgWorkspaceIds } = await checkOrgAccessAndGetWorkspaces(databases, organizationId, user.$id);
                if (!isOrgAdmin) {
                    return c.json({ error: "Organization admin access required" }, 403);
                }
                if (orgWorkspaceIds.length === 0) {
                    return c.json({ data: { documents: [], total: 0 } });
                }
                queries.push(Query.equal("workspaceId", orgWorkspaceIds));
            } else if (workspaceId) {
                const isAdmin = await checkAdminAccess(databases, workspaceId, user.$id);
                if (!isAdmin) {
                    return c.json({ error: "Admin access required" }, 403);
                }
                queries.push(Query.equal("workspaceId", workspaceId));
            } else {
                return c.json({ error: "Either workspaceId or organizationId is required" }, 400);
            }

            const alerts = await databases.listDocuments<UsageAlert>(
                DATABASE_ID,
                USAGE_ALERTS_ID,
                queries
            );

            return c.json({ data: alerts });
        }
    )

    // POST /usage/alerts - Create alert
    .post(
        "/alerts",
        sessionMiddleware,
        zValidator("json", createUsageAlertSchema),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const data = c.req.valid("json");

            // Check admin access
            const isAdmin = await checkAdminAccess(databases, data.workspaceId, user.$id);
            if (!isAdmin) {
                return c.json({ error: "Admin access required" }, 403);
            }

            const alert = await databases.createDocument<UsageAlert>(
                DATABASE_ID,
                USAGE_ALERTS_ID,
                ID.unique(),
                {
                    workspaceId: data.workspaceId,
                    resourceType: data.resourceType,
                    threshold: data.threshold,
                    alertType: data.alertType,
                    isEnabled: true,
                    webhookUrl: data.webhookUrl || null,
                    createdBy: user.$id,
                    lastTriggeredAt: null,
                }
            );

            return c.json({ data: alert }, 201);
        }
    )

    // PATCH /usage/alerts/:alertId - Update alert
    .patch(
        "/alerts/:alertId",
        sessionMiddleware,
        zValidator("json", updateUsageAlertSchema),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const { alertId } = c.req.param();
            const updates = c.req.valid("json");

            // Get alert to check workspace
            const alert = await databases.getDocument<UsageAlert>(
                DATABASE_ID,
                USAGE_ALERTS_ID,
                alertId
            );

            // Check admin access
            const isAdmin = await checkAdminAccess(databases, alert.workspaceId, user.$id);
            if (!isAdmin) {
                return c.json({ error: "Admin access required" }, 403);
            }

            const updatedAlert = await databases.updateDocument<UsageAlert>(
                DATABASE_ID,
                USAGE_ALERTS_ID,
                alertId,
                updates
            );

            return c.json({ data: updatedAlert });
        }
    )

    // DELETE /usage/alerts/:alertId - Delete alert
    .delete("/alerts/:alertId", sessionMiddleware, async (c) => {
        const user = c.get("user");
        const databases = c.get("databases");
        const { alertId } = c.req.param();

        // Get alert to check workspace
        const alert = await databases.getDocument<UsageAlert>(
            DATABASE_ID,
            USAGE_ALERTS_ID,
            alertId
        );

        // Check admin access
        const isAdmin = await checkAdminAccess(databases, alert.workspaceId, user.$id);
        if (!isAdmin) {
            return c.json({ error: "Admin access required" }, 403);
        }

        await databases.deleteDocument(DATABASE_ID, USAGE_ALERTS_ID, alertId);

        return c.json({ data: { $id: alertId } });
    })

    // ===============================
    // Invoice Endpoints
    // WHY: Invoices provide immutable snapshots of billing periods
    // Once an invoice is generated, the aggregation becomes locked
    // ===============================

    // GET /usage/invoices - List invoices (paginated)
    .get(
        "/invoices",
        sessionMiddleware,
        zValidator("query", getInvoicesSchema),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const { workspaceId, organizationId, limit, offset } = c.req.valid("query");

            // Build base query
            const queries = [
                Query.orderDesc("$createdAt"),
                Query.limit(limit),
                Query.offset(offset),
            ];

            // Handle org-level vs workspace-level query
            if (organizationId) {
                // OPTIMIZED: Parallel access check + workspace lookup
                const { isAdmin: isOrgAdmin, workspaceIds: orgWorkspaceIds } = await checkOrgAccessAndGetWorkspaces(databases, organizationId, user.$id);
                if (!isOrgAdmin) {
                    return c.json({ error: "Organization admin access required" }, 403);
                }
                if (orgWorkspaceIds.length === 0) {
                    return c.json({ data: { documents: [], total: 0 } });
                }
                queries.push(Query.equal("workspaceId", orgWorkspaceIds));
            } else if (workspaceId) {
                // Check workspace admin access
                const isAdmin = await checkAdminAccess(databases, workspaceId, user.$id);
                if (!isAdmin) {
                    return c.json({ error: "Admin access required" }, 403);
                }
                queries.push(Query.equal("workspaceId", workspaceId));
            }

            const invoices = await databases.listDocuments<Invoice>(
                DATABASE_ID,
                INVOICES_ID,
                queries
            );

            return c.json({ data: invoices });
        }
    )

    // POST /usage/invoices/generate - Generate invoice from aggregation
    // WHY: This creates an immutable billing snapshot and locks the period
    .post("/invoices/generate", sessionMiddleware, async (c) => {
        const user = c.get("user");
        const databases = c.get("databases");
        const body = await c.req.json();
        const { workspaceId, period } = body;

        if (!workspaceId || !period) {
            return c.json({ error: "workspaceId and period are required" }, 400);
        }

        // Check admin access
        const isAdmin = await checkAdminAccess(databases, workspaceId, user.$id);
        if (!isAdmin) {
            return c.json({ error: "Admin access required" }, 403);
        }

        // Get aggregation for period
        const aggregations = await databases.listDocuments<UsageAggregation>(
            DATABASE_ID,
            USAGE_AGGREGATIONS_ID,
            [
                Query.equal("workspaceId", workspaceId),
                Query.equal("period", period),
            ]
        );

        if (aggregations.total === 0) {
            return c.json({ error: "No aggregation found for this period" }, 404);
        }

        const aggregation = aggregations.documents[0];

        // Check if already has an invoice
        if (aggregation.invoiceId) {
            return c.json({ error: "Invoice already exists for this period" }, 400);
        }

        // Calculate total cost
        const totalCost =
            aggregation.trafficTotalGB * USAGE_RATE_TRAFFIC_GB +
            aggregation.storageAvgGB * USAGE_RATE_STORAGE_GB_MONTH +
            aggregation.computeTotalUnits * USAGE_RATE_COMPUTE_UNIT;

        // Generate invoice ID (human-readable format)
        const invoiceNumber = `INV-${workspaceId.slice(-6).toUpperCase()}-${period.replace('-', '')}`;

        // Create invoice
        const invoice = await databases.createDocument<Invoice>(
            DATABASE_ID,
            INVOICES_ID,
            ID.unique(),
            {
                invoiceId: invoiceNumber,
                workspaceId,
                period,
                trafficGB: aggregation.trafficTotalGB,
                storageAvgGB: aggregation.storageAvgGB,
                computeUnits: aggregation.computeTotalUnits,
                totalCost,
                aggregationSnapshotId: aggregation.$id,
                status: 'draft',
                createdAt: new Date().toISOString(),
            }
        );

        // Link aggregation to invoice and finalize
        // WHY: Once invoice is generated, aggregation becomes immutable
        await databases.updateDocument<UsageAggregation>(
            DATABASE_ID,
            USAGE_AGGREGATIONS_ID,
            aggregation.$id,
            {
                invoiceId: invoice.$id,
                isFinalized: true,
                finalizedAt: new Date().toISOString(),
            }
        );

        return c.json({ data: invoice }, 201);
    })

    // PATCH /usage/invoices/:invoiceId/finalize - Mark invoice as finalized
    .patch("/invoices/:invoiceId/finalize", sessionMiddleware, async (c) => {
        const user = c.get("user");
        const databases = c.get("databases");
        const { invoiceId } = c.req.param();

        // Get invoice
        const invoice = await databases.getDocument<Invoice>(
            DATABASE_ID,
            INVOICES_ID,
            invoiceId
        );

        // Check admin access
        const isAdmin = await checkAdminAccess(databases, invoice.workspaceId, user.$id);
        if (!isAdmin) {
            return c.json({ error: "Admin access required" }, 403);
        }

        if (invoice.status !== 'draft') {
            return c.json({ error: "Only draft invoices can be finalized" }, 400);
        }

        const updated = await databases.updateDocument<Invoice>(
            DATABASE_ID,
            INVOICES_ID,
            invoiceId,
            { status: 'finalized' }
        );

        return c.json({ data: updated });
    })

    // PATCH /usage/invoices/:invoiceId/pay - Mark invoice as paid
    .patch("/invoices/:invoiceId/pay", sessionMiddleware, async (c) => {
        const user = c.get("user");
        const databases = c.get("databases");
        const { invoiceId } = c.req.param();

        // Get invoice
        const invoice = await databases.getDocument<Invoice>(
            DATABASE_ID,
            INVOICES_ID,
            invoiceId
        );

        // Check admin access
        const isAdmin = await checkAdminAccess(databases, invoice.workspaceId, user.$id);
        if (!isAdmin) {
            return c.json({ error: "Admin access required" }, 403);
        }

        if (invoice.status === 'paid') {
            return c.json({ error: "Invoice is already paid" }, 400);
        }

        const updated = await databases.updateDocument<Invoice>(
            DATABASE_ID,
            INVOICES_ID,
            invoiceId,
            {
                status: 'paid',
                paidAt: new Date().toISOString(),
            }
        );

        return c.json({ data: updated });
    });

export default app;
