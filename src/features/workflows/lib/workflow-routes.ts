/**
 * Canonical workflow editor URLs.
 *
 * The editor lives under spaces when a workflow is space-scoped.
 * Workspace-level workflows (no spaceId) use /workspaces/.../workflows/...
 * There is no /projects/.../workflows/... page — project pages only assign a workflow.
 */

export function getWorkflowEditorHref(params: {
  workspaceId: string;
  workflowId: string;
  spaceId?: string | null;
}): string {
  const { workspaceId, workflowId, spaceId } = params;
  if (spaceId) {
    return `/workspaces/${workspaceId}/spaces/${spaceId}/workflows/${workflowId}`;
  }
  return `/workspaces/${workspaceId}/workflows/${workflowId}`;
}
