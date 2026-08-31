import { describe, expect, it } from "vitest";

import { buildSystemPrompt } from "./prompt";
import { searchAgentIndex } from "./search";
import { commitStaged, emptyChatMeta, emptyGitStaging, stageItem, unstageItem } from "./git-staging";
import { resolveSpecialist, buildContextGraph } from "./graph";
import { readPersonalContent } from "./personal";
import { defaultHarnessData } from "./harness";
import type { AgentContext, AgentRun } from "../types";

function harness() {
  const data = defaultHarnessData();
  return {
    ...data,
    id: "h1",
    userId: "u1",
    updatedAt: new Date().toISOString(),
    knowledge: [
      {
        id: "k1",
        title: "Release checklist",
        content: "Always run tests before shipping.",
        createdAt: new Date().toISOString(),
      },
    ],
    automations: [
      {
        id: "a1",
        name: "Triage bugs",
        description: "Summarize new bugs",
        trigger: "New high-priority bug",
        action: "Inspect the item and draft a fix plan",
        enabled: true,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

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

function run(prompt = "Plan the login fix"): AgentRun {
  return {
    id: "run1",
    userId: "u1",
    title: prompt,
    prompt,
    status: "running",
    mode: "agent",
    workspaceId: "w1",
    projectId: "p1",
    messages: [{ id: "m1", role: "user", content: prompt, createdAt: new Date().toISOString() }],
    events: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("agent search", () => {
  it("ranks projects and knowledge for a query", () => {
    const hits = searchAgentIndex({
      query: "login",
      context: context(),
      harness: harness(),
      runs: [run("Fix login")],
    });
    expect(hits.some((hit) => hit.kind === "work_item" && hit.title === "Fix login")).toBe(true);
    expect(hits.some((hit) => hit.kind === "run")).toBe(true);
  });
});

describe("git staging", () => {
  it("stages, unstages, and plans a commit", () => {
    let staging = emptyGitStaging();
    staging = stageItem(staging, { path: "src/app.ts", summary: "wire search" });
    expect(staging.items[0]?.status).toBe("staged");
    staging = unstageItem(staging, "src/app.ts");
    expect(staging.items[0]?.status).toBe("unstaged");
    staging = stageItem(staging, { path: "src/app.ts" });
    const planned = commitStaged(staging, "Add search");
    expect(planned.committed).toHaveLength(1);
    expect(planned.staging.items[0]?.status).toBe("committed");
  });
});

describe("graph and prompt", () => {
  it("routes git prompts to the git specialist", () => {
    expect(resolveSpecialist("stage the login change and plan a commit")).toBe("git");
  });

  it("builds a context graph and system prompt with automations and knowledge", () => {
    const h = harness();
    const graph = buildContextGraph({
      harness: h,
      context: context(),
      run: run(),
      mcp: { mcpServers: { fairlx: { url: "/api/mcp", transport: "http" } } },
    });
    expect(graph.nodes.some((node) => node.kind === "workspace")).toBe(true);
    const prompt = buildSystemPrompt({
      harness: h,
      context: context(),
      run: run("New high-priority bug on login"),
      mcp: { mcpServers: { "fairlx-personal": { url: "in-process://personal" } } },
    });
    expect(prompt).toContain("Fairlx Agent harness");
    expect(prompt).toContain("Triage bugs");
    expect(prompt).toContain("Release checklist");
    expect(prompt).toContain("fairlx-personal");
  });
});

describe("personal MCP", () => {
  it("reads skills and chats from the harness", () => {
    const h = harness();
    const skills = readPersonalContent({ kind: "skills", harness: h }) as Array<{ name: string }>;
    expect(skills.some((item) => item.name === "Frontend")).toBe(true);
    const chats = readPersonalContent({
      kind: "chats",
      harness: { ...h, chatMeta: { ...emptyChatMeta(), pinnedRunIds: ["run1"] } },
      runs: [run("Pinned chat")],
    }) as Array<{ id: string; pinned: boolean }>;
    expect(chats[0]?.pinned).toBe(true);
  });
});
