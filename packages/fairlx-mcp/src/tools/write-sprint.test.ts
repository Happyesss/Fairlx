import { describe, expect, it, vi } from "vitest";
import { jwtToAuthContext } from "../auth/context";
import { PERMISSIONS, type McpRuntime } from "../runtime/types";
import { callTool } from "./index";

function sprintRuntime(existingSprints: Record<string, unknown>[] = []) {
  const sprints = existingSprints.map((doc) => ({ ...doc }));
  const created: Record<string, unknown>[] = [];
  const runtime = {
    collections: { sprints: "sprints", projects: "projects" },
    store: {
      list: async (_collection: string, queries: Array<{ type: string; field?: string; value?: unknown }>) => {
        let filtered = sprints;
        for (const query of queries) {
          if (query.type === "equal" && query.field) {
            filtered = filtered.filter((doc) => doc[query.field as string] === query.value);
          }
        }
        return { documents: filtered, total: filtered.length };
      },
      get: async (collection: string, id: string) => {
        if (collection === "projects" && id === "proj_1") {
          return { $id: "proj_1", workspaceId: "ws_1", name: "School Stacker" };
        }
        throw new Error("missing");
      },
      create: async (_collection: string, data: Record<string, unknown>) => {
        const doc = { $id: `sp_${sprints.length + created.length + 1}`, ...data };
        created.push(doc);
        sprints.push(doc);
        return doc;
      },
      update: async () => {
        throw new Error("unused");
      },
      delete: async () => {
        throw new Error("unused");
      },
    },
    resolveUserProjectAccess: async () => ({ hasAccess: true, isOwner: true, isAdmin: true }),
    hasProjectPermission: (_access: unknown, permission: string) =>
      permission === PERMISSIONS.CREATE_SPRINTS || permission === PERMISSIONS.START_SPRINT,
    logAudit: vi.fn(),
  } as unknown as McpRuntime;
  return { runtime, created };
}

const auth = jwtToAuthContext("admin_1", {
  workspaceId: "ws_1",
  scopes: ["sprints:manage"],
});

describe("fairlx_sprint_create", () => {
  it("starts the first sprint on a project automatically", async () => {
    const { runtime, created } = sprintRuntime();
    const result = await callTool(
      "fairlx_sprint_create",
      { projectId: "proj_1", name: "Sprint 1 — Foundation", goal: "Set up the foundation" },
      runtime,
      auth,
    );
    const payload = JSON.parse(result.content[0]?.text ?? "{}");
    expect(payload.started).toBe(true);
    expect(payload.sprint.status).toBe("ACTIVE");
    expect(created[0]?.status).toBe("ACTIVE");
  });

  it("keeps later sprints planned when one already exists", async () => {
    const { runtime, created } = sprintRuntime([
      { $id: "sp_old", projectId: "proj_1", name: "Sprint 1", status: "ACTIVE" },
    ]);
    const result = await callTool(
      "fairlx_sprint_create",
      { projectId: "proj_1", name: "Sprint 2" },
      runtime,
      auth,
    );
    const payload = JSON.parse(result.content[0]?.text ?? "{}");
    expect(payload.started).toBe(false);
    expect(payload.sprint.status).toBe("PLANNED");
    expect(created[0]?.status).toBe("PLANNED");
  });
});
