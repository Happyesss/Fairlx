import { describe, expect, it } from "vitest";
import { PERMISSIONS, type McpRuntime, type McpTokenRecord } from "../runtime/types";
import { authenticateBearer, isFairlxSecretToken, looksLikeJwt } from "./dual-auth";
import { ALL_SCOPES } from "./scopes";

const MEMBER_PERMISSIONS = [
  PERMISSIONS.VIEW_PROJECT,
  PERMISSIONS.VIEW_TASKS,
  PERMISSIONS.VIEW_SPRINTS,
  PERMISSIONS.VIEW_DOCS,
  PERMISSIONS.VIEW_MEMBERS,
  PERMISSIONS.CREATE_TASKS,
  PERMISSIONS.EDIT_TASKS,
];

function tokenRecord(overrides: Partial<McpTokenRecord> = {}): McpTokenRecord {
  return {
    $id: "tok_1",
    workspaceId: "ws_1",
    createdBy: "user_1",
    ...overrides,
  };
}

function mockRuntime(opts: {
  record?: McpTokenRecord | null;
  access?: { hasAccess: boolean; isOwner: boolean; isAdmin: boolean; permissions: string[] };
  jwtUserId?: string;
}): McpRuntime {
  return {
    hashMcpToken: (plaintext: string) => plaintext,
    lookupTokenByHash: async () => opts.record ?? null,
    resolveUserProjectAccess: async () =>
      opts.access ?? { hasAccess: false, isOwner: false, isAdmin: false, permissions: [] },
    verifyJwt: async () => (opts.jwtUserId ? { userId: opts.jwtUserId } : null),
  } as unknown as McpRuntime;
}

describe("isFairlxSecretToken", () => {
  it("accepts legacy flx_ prefixes", () => {
    expect(isFairlxSecretToken("flx_abc")).toBe(true);
  });

  it("accepts flx_live_sec_ prefixes", () => {
    expect(isFairlxSecretToken("flx_live_sec_deadbeef")).toBe(true);
  });

  it("rejects JWTs", () => {
    expect(isFairlxSecretToken("eyJhbGciOiJIUzI1NiJ9.payload.sig")).toBe(false);
    expect(looksLikeJwt("eyJhbGciOiJIUzI1NiJ9.payload.sig")).toBe(true);
  });
});

describe("authenticateBearer role inheritance", () => {
  it("gives unscoped workspace tokens ALL_SCOPES", async () => {
    const auth = await authenticateBearer(
      mockRuntime({ record: tokenRecord() }),
      "Bearer flx_live_sec_workspace"
    );
    expect(auth.scopes).toEqual([...ALL_SCOPES]);
    expect(auth.projectPermissions).toBeUndefined();
  });

  it("hydrates project-scoped member tokens with write but not delete", async () => {
    const auth = await authenticateBearer(
      mockRuntime({
        record: tokenRecord({ projectId: "proj_1" }),
        access: {
          hasAccess: true,
          isOwner: false,
          isAdmin: false,
          permissions: MEMBER_PERMISSIONS,
        },
      }),
      "Bearer flx_live_sec_project"
    );
    expect(auth.scopes).toContain("tasks:write");
    expect(auth.scopes).not.toContain("tasks:delete");
    expect(auth.projectPermissions).toEqual(MEMBER_PERMISSIONS);
  });

  it("keeps explicit scopes as a ceiling on the inherited role", async () => {
    const auth = await authenticateBearer(
      mockRuntime({
        record: tokenRecord({ projectId: "proj_1", scopes: ["tasks:read"] }),
        access: {
          hasAccess: true,
          isOwner: false,
          isAdmin: false,
          permissions: MEMBER_PERMISSIONS,
        },
      }),
      "Bearer flx_live_sec_limited"
    );
    expect(auth.scopes).toEqual(["tasks:read"]);
  });

  it("does not zero scopes when a project-scoped user lost access", async () => {
    const auth = await authenticateBearer(
      mockRuntime({
        record: tokenRecord({ projectId: "proj_1" }),
        access: { hasAccess: false, isOwner: false, isAdmin: false, permissions: [] },
      }),
      "Bearer flx_live_sec_lost"
    );
    expect(auth.scopes).toEqual([...ALL_SCOPES]);
  });

  it("gives JWTs ALL_SCOPES including admin:manage", async () => {
    const auth = await authenticateBearer(
      mockRuntime({ jwtUserId: "user_jwt" }),
      "Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig"
    );
    expect(auth.scopes).toEqual([...ALL_SCOPES]);
    expect(auth.scopes).toContain("admin:manage");
  });
});
