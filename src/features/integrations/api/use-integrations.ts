"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string }).error || `Request failed (${res.status})`);
  }
  return json as T;
}

export function useProjectIntegrations(projectId: string) {
  return useQuery({
    queryKey: ["project-integrations", projectId],
    enabled: !!projectId,
    queryFn: () =>
      api<{ data: Array<Record<string, unknown>> }>(
        `/api/integrations?projectId=${encodeURIComponent(projectId)}`
      ),
  });
}

export function useUpsertIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: Record<string, unknown>) =>
      api("/api/integrations", { method: "POST", body: JSON.stringify(json) }),
    onSuccess: (_, vars) => {
      toast.success("Integration saved");
      qc.invalidateQueries({
        queryKey: ["project-integrations", vars.projectId as string],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      await api(`/api/integrations/${id}`, { method: "DELETE" });
      return { projectId };
    },
    onSuccess: (data) => {
      toast.success("Disconnected");
      qc.invalidateQueries({ queryKey: ["project-integrations", data.projectId] });
    },
  });
}

export function useSlackOAuthStart() {
  return useMutation({
    mutationFn: ({
      projectId,
      workspaceId,
    }: {
      projectId: string;
      workspaceId: string;
    }) =>
      api<{ data: { url: string } }>(
        `/api/integrations/slack/oauth/start?projectId=${encodeURIComponent(projectId)}&workspaceId=${encodeURIComponent(workspaceId)}`
      ),
    onSuccess: (data) => {
      if (data.data?.url) window.location.href = data.data.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMcpTokens(projectId?: string, workspaceId?: string) {
  const hasKey = !!projectId || !!workspaceId;
  return useQuery({
    queryKey: ["mcp-tokens", projectId ?? workspaceId ?? ""],
    enabled: hasKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (projectId) params.set("projectId", projectId);
      else if (workspaceId) params.set("workspaceId", workspaceId);
      return api<{ data: Array<Record<string, unknown>> }>(
        `/api/integrations/mcp/tokens?${params.toString()}`
      );
    },
  });
}

export function useCreateMcpToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: { projectId?: string; workspaceId: string; name: string }) =>
      api<{ data: { token: string; name: string; $id: string; tokenPrefix: string; scope: string } }>(
        "/api/integrations/mcp/tokens",
        { method: "POST", body: JSON.stringify(json) }
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["mcp-tokens", vars.projectId ?? vars.workspaceId] });
    },
  });
}

export function useDeleteMcpToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      projectId,
      workspaceId,
    }: {
      id: string;
      projectId?: string;
      workspaceId?: string;
    }) => {
      await api(`/api/integrations/mcp/tokens/${id}`, { method: "DELETE" });
      return { projectId, workspaceId };
    },
    onSuccess: (data) => {
      toast.success("Token revoked");
      qc.invalidateQueries({ queryKey: ["mcp-tokens", data.projectId ?? data.workspaceId] });
    },
  });
}

export function useAgentContext(workItemId: string, projectId: string, enabled = true) {
  return useQuery({
    queryKey: ["agent-context", workItemId, projectId],
    enabled: enabled && !!workItemId && !!projectId,
    queryFn: () =>
      api<{
        data: {
          workItemId: string;
          workItemKey: string;
          title: string;
          description?: string | null;
          projectId: string;
          workspaceId: string;
          suggestedBranch: string;
          vcs: {
            provider: "github" | "gitlab" | "bitbucket";
            owner: string;
            repo: string;
            defaultBranch: string;
            cloneUrl: string;
          } | null;
          github: {
            provider?: "github" | "gitlab" | "bitbucket";
            owner: string;
            repo: string;
            defaultBranch: string;
            cloneUrl: string;
          } | null;
          mcp: { fairlxUrl: string; instructions: string };
          customMcps: Array<{ name: string; url: string }>;
          prompts: { claude: string; codex: string };
        };
      }>(
        `/api/integrations/agent-context?workItemId=${encodeURIComponent(workItemId)}&projectId=${encodeURIComponent(projectId)}`
      ),
  });
}
