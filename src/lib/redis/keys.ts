/**
 * CENTRALIZED Cache Key Registry + TTL Configuration
 * 
 * Every cacheable data point in the entire PMT is defined here.
 * No magic strings elsewhere — all keys go through this module.
 * 
 * Naming convention: domain:entity:id[:qualifier]
 * Pattern convention: domain:entity:id:* (for invalidation)
 */

// =============================================================
// TTL CONFIGURATION (seconds)
// =============================================================
export const TTL = {
    // ── AUTHENTICATION & SESSION ──
    AUTH_LIFECYCLE: 300,          // Polled on navigation — invalidated on prefs update (5 min)

    // ── PERMISSIONS (change on member/role CRUD only → invalidated explicitly) ──
    PROJECT_ACCESS: 600,          // resolveUserProjectAccess() — invalidated on role change (10 min)
    ORG_ACCESS: 600,              // resolveUserOrgAccess() — invalidated on org member change (10 min)
    WORKSPACE_RBAC: 600,          // resolveWorkspacePermissions() — invalidated on role CRUD (10 min)
    WORKSPACE_MEMBER: 600,        // getMember() — invalidated on member CRUD (10 min)
    WORKFLOW_PERMISSION: 600,     // checkWorkflowPermission() — invalidated on change (10 min)

    // ── BILLING (changes on payment events only → invalidated explicitly) ──
    BILLING_ACCOUNT: 1800,        // resolveBillingAccount() — very stable (30 min)
    BILLING_STATUS: 600,          // ACTIVE/DUE/SUSPENDED — invalidated on payment events (10 min)
    WALLET_BALANCE: 120,          // Changes on transactions (2 min)

    // ── ENTITY DOCUMENTS (change on explicit update only → invalidated on save) ──
    WORKSPACE: 900,               // 15 min
    PROJECT: 900,                 // 15 min
    SPACE: 900,                   // 15 min
    SPRINT: 300,                  // 5 min
    WORKFLOW: 1800,               // Workflows change very rarely (30 min)
    WORKFLOW_STATUSES: 1800,      // Status definitions change very rarely (30 min)
    WORKFLOW_TRANSITIONS: 1800,   // Transition rules change very rarely (30 min)
    CUSTOM_FIELDS: 1800,          // Custom field definitions (30 min)
    CUSTOM_COLUMNS: 1800,         // Custom column definitions (30 min)
    SAVED_VIEW: 600,              // User's saved views/filters (10 min)
    ORGANIZATION: 900,            // 15 min

    // ── LISTS (change on item CRUD → invalidated on write) ──
    TASK_LIST: 180,               // Board/list views — invalidated on task CRUD (3 min)
    WORK_ITEM_LIST: 180,          // Sprint board — invalidated on item CRUD (3 min)
    SPRINT_LIST: 300,             // Sprint planning — invalidated on sprint CRUD (5 min)
    PROJECT_LIST: 600,            // Workspace project list — invalidated on project CRUD (10 min)
    SPACE_LIST: 600,              // Space overview — invalidated on space CRUD (10 min)
    MEMBER_LIST: 600,             // Workspace/project member list (10 min)
    COMMENT_LIST: 180,            // Task comments — invalidated on comment CRUD (3 min)
    MY_SPACE_ITEMS: 300,          // Cross-workspace work items for user (5 min)
    NOTIFICATION_LIST: 60,        // Notification feed — needs freshness (1 min)
    EPIC_LIST: 600,               // Epics per project (10 min)

    // ── COUNTERS (change on related CRUD → invalidated via increment/decrement) ──
    NOTIFICATION_UNREAD: 60,      // Polled frequently — invalidated on new notif (1 min)
    COMMENT_COUNT: 300,           // Per-task comment count (5 min)
    WORK_ITEM_COUNT: 300,         // Per-sprint work item count (5 min)
    SPACE_PROJECT_COUNT: 600,     // Per-space project count (10 min)
    SPACE_MEMBER_COUNT: 600,      // Per-space member count (10 min)

    // ── ANALYTICS (inherently aggregated, expensive to compute) ──
    PROJECT_ANALYTICS: 600,       // 10 count queries → 1 cached result (10 min)
    WORKSPACE_ANALYTICS: 600,     // Similar aggregation (10 min)
    SPRINT_BURNDOWN: 300,         // Sprint progress tracking (5 min)

    // ── USER/MEMBER RESOLUTION (almost never changes) ──
    MEMBER_TO_USER: 3600,         // Member doc ID → user profile (1 hour)
    USER_PROFILE: 3600,           // User name/email/avatar (1 hour)
    WORKSPACE_ADMINS: 900,        // List of admin users in workspace (15 min)

    // ── WRITE-PATH (operational, not content caching) ──
    IDEMPOTENCY: 3600,            // Usage write dedup (1 hour)
    RATE_LIMIT: 60,               // Sliding window
    WORK_ITEM_KEY_SEQ: 120,       // Next key number for work item generation (2 min)

    // ── BYOB (Bring Your Own Backend) ──
    BYOB_CONFIG: 300,              // BYOB tenant config resolution (5 min)
} as const;

// =============================================================
// CACHE KEY BUILDERS
// =============================================================
export const CK = {
    // ── AUTHENTICATION ──
    authLifecycle: (userId: string) =>
        `auth:lifecycle:${userId}`,

    // ── PERMISSIONS ──
    projectAccess: (userId: string, projectId: string) =>
        `perm:proj:v2:${projectId}:${userId}`,
    orgAccess: (userId: string, orgId: string) =>
        `perm:org:${orgId}:${userId}`,
    workspaceRbac: (userId: string, workspaceId: string) =>
        `perm:ws:${workspaceId}:${userId}`,
    workspaceMember: (userId: string, workspaceId: string) =>
        `member:ws:${workspaceId}:${userId}`,
    workflowPermission: (userId: string, workspaceId: string, spaceId?: string) =>
        `perm:wf:${workspaceId}:${spaceId || "none"}:${userId}`,

    // ── BILLING ──
    billingAccount: (entityId: string) =>
        `billing:acct:${entityId}`,
    billingStatus: (entityId: string) =>
        `billing:status:${entityId}`,
    walletBalance: (walletId: string) =>
        `wallet:bal:${walletId}`,

    // ── ENTITY DOCUMENTS ──
    workspace: (id: string) => `doc:ws:${id}`,
    project: (id: string) => `doc:proj:${id}`,
    space: (id: string) => `doc:space:${id}`,
    sprint: (id: string) => `doc:sprint:${id}`,
    workflow: (id: string) => `doc:wf:${id}`,
    workflowStatuses: (workflowId: string) => `doc:wfst:${workflowId}`,
    workflowTransitions: (workflowId: string) => `doc:wftr:${workflowId}`,
    customFields: (workspaceId: string, projectId?: string) =>
        `doc:cf:${workspaceId}:${projectId || "all"}`,
    customColumns: (workspaceId: string) => `doc:cc:${workspaceId}`,
    savedViews: (userId: string, workspaceId: string, projectId?: string) =>
        `doc:sv:${workspaceId}:${userId}:${projectId || "all"}`,
    organization: (id: string) => `doc:org:${id}`,

    // ── LISTS ──
    taskList: (workspaceId: string, filterHash: string) =>
        `list:tasks:${workspaceId}:${filterHash}`,
    workItemList: (workspaceId: string, filterHash: string) =>
        `list:witems:${workspaceId}:${filterHash}`,
    sprintList: (workspaceId: string, projectId: string) =>
        `list:sprints:${workspaceId}:${projectId}`,
    projectList: (workspaceId: string) =>
        `list:projects:${workspaceId}`,
    spaceList: (workspaceId: string) =>
        `list:spaces:${workspaceId}`,
    memberList: (workspaceId: string) =>
        `list:members:${workspaceId}`,
    projectMemberList: (projectId: string) =>
        `list:pmembers:${projectId}`,
    commentList: (taskId: string) =>
        `list:comments:${taskId}`,
    mySpaceItems: (userId: string) =>
        `list:myspace:${userId}`,
    notificationList: (userId: string) =>
        `list:notifs:${userId}`,
    epicList: (projectId: string) =>
        `list:epics:${projectId}`,

    // ── COUNTERS ──
    notifUnread: (userId: string) =>
        `cnt:notif:${userId}`,
    commentCount: (taskId: string) =>
        `cnt:comments:${taskId}`,
    workItemCount: (sprintId: string) =>
        `cnt:witems:${sprintId}`,
    spaceProjectCount: (spaceId: string) =>
        `cnt:sproj:${spaceId}`,
    spaceMemberCount: (spaceId: string) =>
        `cnt:smem:${spaceId}`,

    // ── ANALYTICS ──
    projectAnalytics: (projectId: string, month: string) =>
        `analytics:proj:${projectId}:${month}`,
    workspaceAnalytics: (workspaceId: string, month: string) =>
        `analytics:ws:${workspaceId}:${month}`,
    sprintBurndown: (sprintId: string) =>
        `analytics:burndown:${sprintId}`,

    // ── USER/MEMBER RESOLUTION ──
    memberToUser: (memberId: string) =>
        `resolve:m2u:${memberId}`,
    userProfile: (userId: string) =>
        `resolve:user:${userId}`,
    workspaceAdmins: (workspaceId: string) =>
        `resolve:admins:${workspaceId}`,

    // ── WRITE-PATH ──
    idempotency: (key: string) =>
        `idem:${key}`,
    rateLimit: (userId: string, endpoint: string) =>
        `rate:${endpoint}:${userId}`,
    workItemKeySeq: (projectId: string) =>
        `seq:wikey:${projectId}`,

    // ── BYOB ──
    byobConfig: (orgSlug: string) =>
        `byob:config:${orgSlug}`,
} as const;

// =============================================================
// INVALIDATION PATTERN BUILDERS (for bulk invalidation)
// =============================================================
export const CKPattern = {
    /** When project members change → invalidate all permission caches for that project */
    // Must match CK.projectAccess: `perm:proj:v2:${projectId}:${userId}`
    projectPerms: (projectId: string) => `perm:proj:v2:${projectId}:*`,
    /** When org members/roles change → invalidate all org permission caches */
    orgPerms: (orgId: string) => `perm:org:${orgId}:*`,
    /** When workspace members change */
    workspacePerms: (workspaceId: string) => `perm:ws:${workspaceId}:*`,
    workspaceMembers: (workspaceId: string) => `member:ws:${workspaceId}:*`,
    /** When billing status changes */
    billingEntity: (entityId: string) => `billing:*:${entityId}`,
    /** When tasks change in a workspace (invalidate all task list views) */
    taskLists: (workspaceId: string) => `list:tasks:${workspaceId}:*`,
    /** When work items change */
    workItemLists: (workspaceId: string) => `list:witems:${workspaceId}:*`,
    /** When sprints change in a project */
    sprintLists: (workspaceId: string) => `list:sprints:${workspaceId}:*`,
    /** When a user's notifications change */
    userNotifs: (userId: string) => `list:notifs:${userId}`,
    /** When workflow definitions change */
    workflowData: (workflowId: string) => `doc:wf*:${workflowId}`,
    /** All permissions for a user (across all contexts) */
    allUserPerms: (userId: string) => `perm:*:*:${userId}`,
    /** When BYOB tenant config changes */
    byobTenant: (orgSlug: string) => `byob:*:${orgSlug}`,
} as const;

// =============================================================
// FILTER HASH UTILITY
// =============================================================

/**
 * Generate a deterministic hash for filter combinations.
 * Used to create unique cache keys for different board/list views.
 * 
 * Example: taskList("ws123", hashFilters({ projectId: "p1", status: "TODO" }))
 */
export function hashFilters(filters: Record<string, string | null | undefined>): string {
    const sorted = Object.entries(filters)
        .filter(([, v]) => v != null)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("&");

    // Simple hash — not cryptographic, just for cache key uniqueness
    let hash = 0;
    for (let i = 0; i < sorted.length; i++) {
        const char = sorted.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
}
