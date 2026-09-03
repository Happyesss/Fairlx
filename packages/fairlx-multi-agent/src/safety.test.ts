import { describe, expect, it } from "vitest";

import { MemoryChallengeStore, VerificationGateway, LoopGuard, roleMayExecute } from "./safety";

describe("verification gateway", () => {
  it("auto-applies safe work-item updates when QA passed", async () => {
    const gateway = new VerificationGateway(new MemoryChallengeStore());
    const decision = await gateway.evaluate({
      action: "update work item",
      tool: "fairlx_work_item_update",
      actorUserId: "u1",
      workspaceRole: "MEMBER",
      qaPassed: true,
    });
    expect(decision.verdict).toBe("auto_apply");
    expect(decision.challengeToken).toBeUndefined();
  });

  it("rejects failing QA", async () => {
    const gateway = new VerificationGateway(new MemoryChallengeStore());
    const decision = await gateway.evaluate({
      action: "merge branch",
      tool: "fairlx_work_item_update",
      actorUserId: "u1",
      qaPassed: false,
    });
    expect(decision.verdict).toBe("reject");
  });

  it("issues a 120s challenge token for deletions", async () => {
    const gateway = new VerificationGateway(new MemoryChallengeStore());
    const decision = await gateway.evaluate({
      action: "delete workspace",
      tool: "fairlx_workspace_delete",
      args: { workspaceId: "w1" },
      actorUserId: "u1",
      workspaceRole: "OWNER",
    });
    expect(decision.verdict).toBe("confirm");
    expect(decision.challengeToken).toMatch(/^ctk_/);
    expect(decision.ttlSeconds).toBe(120);
    const ok = await gateway.consumeChallenge(
      decision.challengeToken!,
      "fairlx_workspace_delete",
      { workspaceId: "w1" },
      "u1",
    );
    expect(ok).toBe(true);
    const again = await gateway.consumeChallenge(
      decision.challengeToken!,
      "fairlx_workspace_delete",
      { workspaceId: "w1" },
      "u1",
    );
    expect(again).toBe(false);
  });

  it("blocks members from admin deletes", async () => {
    expect(roleMayExecute("MEMBER", "fairlx_project_delete")).toBe(false);
    const gateway = new VerificationGateway(new MemoryChallengeStore());
    const decision = await gateway.evaluate({
      action: "delete project",
      tool: "fairlx_project_delete",
      actorUserId: "u1",
      workspaceRole: "MEMBER",
    });
    expect(decision.verdict).toBe("reject");
  });
});

describe("loop guard", () => {
  it("suppresses duplicate tool calls and stops after repeated failures", () => {
    const guard = new LoopGuard(3, 2);
    expect(guard.skipDuplicate("fairlx_work_item_list", { projectId: "p1" })).toBeNull();
    guard.remember("fairlx_work_item_list", { projectId: "p1" }, JSON.stringify({ error: "nope" }));
    expect(guard.skipDuplicate("fairlx_work_item_list", { projectId: "p1" })).toContain("repeated");
    guard.remember("x", { n: 1 }, JSON.stringify({ error: "a" }));
    guard.remember("x", { n: 2 }, JSON.stringify({ error: "b" }));
    guard.remember("x", { n: 3 }, JSON.stringify({ error: "c" }));
    expect(guard.shouldStop).toBe(true);
  });
});
