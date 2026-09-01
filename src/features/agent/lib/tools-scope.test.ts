import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { AgentContext } from "../types";
import { defaultHarnessData } from "./harness";
import { applyScopeDefaults } from "./tools";

function context(): AgentContext {
  return {
    user: { id: "u1", name: "Ada", email: "ada@fairlx.dev" },
    workspaces: [{ id: "w1", name: "Acme" }],
    projects: [{ id: "p1", name: "Website", workspaceId: "w1", key: "WEB" }],
    workItems: [{ id: "i1", title: "Fix login", workspaceId: "w1", projectId: "p1", key: "WEB-1", status: "TODO" }],
    notifications: [],
    githubRepos: [{ id: "r1", repositoryName: "acme", owner: "acme", branch: "main", workspaceId: "w1", projectId: "p1" }],
    integrations: [],
    docs: [{ id: "d1", title: "API docs", workspaceId: "w1", projectId: "p1" }],
  };
}

function ctx(overrides: Partial<Parameters<typeof applyScopeDefaults>[1]> = {}): Parameters<typeof applyScopeDefaults>[1] {
  const data = defaultHarnessData();
  return {
    runId: "run1",
    userId: "u1",
    context: context(),
    harness: { ...data, id: "h1", userId: "u1", updatedAt: new Date().toISOString() },
    mcp: { mcpServers: {} },
    runs: [],
    workspaceId: "w1",
    projectId: "p1",
    ...overrides,
  };
}

describe("applyScopeDefaults", () => {
  it("fills missing workspaceId and projectId from context", () => {
    const next = applyScopeDefaults({}, ctx());
    expect(next.workspaceId).toBe("w1");
    expect(next.projectId).toBe("p1");
  });

  it("resolves workspace names and project keys to ids", () => {
    const next = applyScopeDefaults({ workspaceId: "Acme", projectId: "WEB" }, ctx());
    expect(next.workspaceId).toBe("w1");
    expect(next.projectId).toBe("p1");
  });

  it("does not substitute unmatched ids", () => {
    const next = applyScopeDefaults(
      { workspaceId: "other-ws", projectId: "other-proj" },
      ctx(),
    );
    expect(next.workspaceId).toBe("other-ws");
    expect(next.projectId).toBe("other-proj");
  });
});
