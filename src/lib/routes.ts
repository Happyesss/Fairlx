/**
 * Centralized Route Builders
 * 
 * ENTERPRISE SAFETY: All navigation routes are built through these functions
 * to prevent navigation with undefined IDs and ensure consistent URL structure.
 * 
 * USAGE:
 * - Import and use instead of string concatenation
 * - TypeScript will catch undefined IDs at compile time
 */

/**
 * Workspace routes
 */
export const routes = {
    // === AUTH ===
    signIn: () => "/sign-in",
    signUp: () => "/sign-up",
    forgotPassword: () => "/forgot-password",
    resetPassword: () => "/reset-password",
    verifyEmail: () => "/verify-email",
    verifyEmailSent: () => "/verify-email-sent",
    verifyEmailNeeded: () => "/verify-email-needed",
    authCallback: () => "/auth/callback",
    onboarding: () => "/onboarding",

    // === WORKSPACE ===
    workspace: (workspaceId: string) => `/workspaces/${workspaceId}`,
    workspaceCreate: () => "/workspaces/create",
    workspaceSettings: (workspaceId: string) => `/workspaces/${workspaceId}/settings`,
    workspaceMembers: (workspaceId: string) => `/workspaces/${workspaceId}/members`,
    workspaceBilling: (workspaceId: string) => `/workspaces/${workspaceId}/billing`,
    workspaceAuditLogs: (workspaceId: string) => `/workspaces/${workspaceId}/audit-logs`,

    // === PROJECT ===
    project: (workspaceId: string, projectId: string) =>
        `/workspaces/${workspaceId}/projects/${projectId}`,
    projectKanban: (workspaceId: string, projectId: string) =>
        `/workspaces/${workspaceId}/projects/${projectId}?task-view=kanban`,
    projectSettings: (workspaceId: string, projectId: string) =>
        `/workspaces/${workspaceId}/projects/${projectId}/settings`,
    projectBacklog: (workspaceId: string, projectId: string) =>
        `/workspaces/${workspaceId}/projects/${projectId}/backlog`,
    projectSprints: (workspaceId: string, projectId: string) =>
        `/workspaces/${workspaceId}/projects/${projectId}/sprints`,
    projectDocs: (workspaceId: string, projectId: string) =>
        `/workspaces/${workspaceId}/projects/${projectId}/docs`,

    // === TASK ===
    task: (workspaceId: string, taskId: string) =>
        `/workspaces/${workspaceId}/tasks/${taskId}`,
    tasks: (workspaceId: string) => `/workspaces/${workspaceId}/tasks`,
    myBacklog: (workspaceId: string) => `/workspaces/${workspaceId}/my-backlog`,

    // === PROJECT TEAMS (Project-scoped) ===
    projectTeams: (workspaceId: string, projectId: string) =>
        `/workspaces/${workspaceId}/projects/${projectId}/teams`,

    // === SPACE ===
    space: (workspaceId: string, spaceId: string) =>
        `/workspaces/${workspaceId}/spaces/${spaceId}`,
    spaces: (workspaceId: string) => `/workspaces/${workspaceId}/spaces`,

    // === ORGANIZATION ===
    organization: () => "/organization",
    organizationSettings: (workspaceId: string) =>
        `/workspaces/${workspaceId}/organization`,

    // === PROFILE ===
    profile: () => "/profile",
    profileAccountInfo: () => "/profile/accountinfo",
    profilePassword: () => "/profile/password",

    // === MISC ===
    welcome: () => "/welcome",
    timeline: (workspaceId: string) => `/workspaces/${workspaceId}/timeline`,
    timeTracking: (workspaceId: string) => `/workspaces/${workspaceId}/time-tracking`,
    programs: (workspaceId: string) => `/workspaces/${workspaceId}/programs`,
    inviteJoin: (workspaceId: string, inviteCode: string) =>
        `/workspaces/${workspaceId}/join/${inviteCode}`,
};

/**
 * Type-safe route helper that validates IDs
 */
export function safeRoute<T extends keyof typeof routes>(
    route: T,
    ...args: Parameters<typeof routes[T]>
): string {
    // Validate all string arguments are not undefined/null/empty
    for (const arg of args) {
        if (typeof arg === "string" && (!arg || arg === "undefined")) {
            return "/"; // Safe fallback
        }
    }

    // @ts-expect-error - TypeScript can't infer the spread correctly
    return routes[route](...args);
}
