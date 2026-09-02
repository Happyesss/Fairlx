import { createHash, randomBytes } from "node:crypto";

import { CONFIRMATION_TTL_MS, MAX_CONSECUTIVE_FAILURES, MAX_DUPLICATE_SKIPS } from "./config";
import { isDeleteTool, isHighRiskTool, isWriteTool } from "./roles";
import { stableJson } from "./ids";
import type { GatewayDecision, GatewayVerdict, ToolCall, WorkspaceRole } from "./types";

export interface ChallengeStore {
  set(token: string, value: string, ttlSeconds: number): Promise<void>;
  get(token: string): Promise<string | null>;
  del(token: string): Promise<void>;
}

export class MemoryChallengeStore implements ChallengeStore {
  private readonly data = new Map<string, { value: string; expiresAt: number }>();

  constructor(private readonly clock: () => number = Date.now) {}

  async set(token: string, value: string, ttlSeconds: number): Promise<void> {
    this.data.set(token, { value, expiresAt: this.clock() + ttlSeconds * 1000 });
  }

  async get(token: string): Promise<string | null> {
    const row = this.data.get(token);
    if (!row) return null;
    if (row.expiresAt <= this.clock()) {
      this.data.delete(token);
      return null;
    }
    return row.value;
  }

  async del(token: string): Promise<void> {
    this.data.delete(token);
  }
}

export function hashArgs(args: Record<string, unknown>): string {
  const clone = { ...args };
  delete clone.confirm;
  delete clone.challengeToken;
  return createHash("sha256").update(stableJson(clone)).digest("hex");
}

export function issueChallengeToken(): string {
  return `ctk_${randomBytes(16).toString("hex")}`;
}

export function roleMayExecute(workspaceRole: WorkspaceRole | undefined, tool: string): boolean {
  const role = workspaceRole ?? "MEMBER";
  if (role === "VIEWER") return !isWriteTool(tool) && !isDeleteTool(tool);
  if (role === "MEMBER") return !isDeleteTool(tool) && !/billing|workspace_delete|project_delete/i.test(tool);
  return true;
}

export function riskTierFor(tool: string, args?: Record<string, unknown>): 1 | 3 | 4 | 6 {
  if (isHighRiskTool(tool, args)) return 6;
  if (isDeleteTool(tool)) return 4;
  if (isWriteTool(tool)) return 3;
  return 1;
}

export function classifyAction(action: string, tool?: string, args?: Record<string, unknown>): GatewayVerdict {
  const blob = `${action} ${tool || ""}`.toLowerCase();
  if (isHighRiskTool(tool || action, args) || /delete|purge|push to main|production merge|billing/.test(blob)) {
    return "confirm";
  }
  if (/fail|reject|broken|regression/.test(blob)) return "reject";
  return "auto_apply";
}

export class VerificationGateway {
  constructor(
    private readonly challenges: ChallengeStore,
    private readonly ttlMs: number = CONFIRMATION_TTL_MS,
  ) {}

  async evaluate(input: {
    action: string;
    tool?: string;
    args?: Record<string, unknown>;
    actorUserId: string;
    workspaceRole?: WorkspaceRole;
    qaPassed?: boolean;
    qaSkipped?: boolean;
  }): Promise<GatewayDecision> {
    const tool = input.tool || input.action;
    if (!roleMayExecute(input.workspaceRole, tool)) {
      return {
        verdict: "reject",
        reason: "Workspace role cannot perform this action.",
        action: input.action,
        riskTier: 6,
      };
    }
    if (input.qaPassed === false && !input.qaSkipped) {
      return {
        verdict: "reject",
        reason: "QA proof failed. Personal Agent will not auto-apply.",
        action: input.action,
        riskTier: 3,
      };
    }

    const tier = riskTierFor(tool, input.args);
    if (tier >= 4) {
      const token = issueChallengeToken();
      await this.challenges.set(
        token,
        JSON.stringify({
          tool,
          argsHash: hashArgs(input.args ?? {}),
          actorUserId: input.actorUserId,
        }),
        Math.ceil(this.ttlMs / 1000),
      );
      return {
        verdict: "confirm",
        reason: "High-risk action requires a 1-click confirmation.",
        action: input.action,
        riskTier: tier,
        challengeToken: token,
        ttlSeconds: Math.ceil(this.ttlMs / 1000),
      };
    }

    const verdict = classifyAction(input.action, tool, input.args);
    return {
      verdict,
      reason:
        verdict === "auto_apply"
          ? "Safe action (docs, tasks, or low-risk PR). Auto-applied."
          : verdict === "reject"
            ? "Reviewer rejected the change."
            : "Confirmation required.",
      action: input.action,
      riskTier: tier,
    };
  }

  async consumeChallenge(token: string, tool: string, args: Record<string, unknown>, actorUserId: string): Promise<boolean> {
    const raw = await this.challenges.get(token);
    if (!raw) return false;
    let stored: { tool: string; argsHash: string; actorUserId: string };
    try {
      stored = JSON.parse(raw) as typeof stored;
    } catch {
      return false;
    }
    if (stored.tool !== tool || stored.actorUserId !== actorUserId || stored.argsHash !== hashArgs(args)) {
      return false;
    }
    await this.challenges.del(token);
    return true;
  }
}

export class LoopGuard {
  private consecutiveFailures = 0;
  private duplicateSkips = 0;
  private readonly seen = new Map<string, string>();

  constructor(
    private readonly maxFailures = MAX_CONSECUTIVE_FAILURES,
    private readonly maxDuplicates = MAX_DUPLICATE_SKIPS,
  ) {}

  fingerprint(name: string, args: unknown): string {
    return `${name}:${stableJson(args)}`;
  }

  remember(name: string, args: unknown, content: string): void {
    this.seen.set(this.fingerprint(name, args), content);
    this.consecutiveFailures = /"ok":false|"error":/i.test(content) ? this.consecutiveFailures + 1 : 0;
  }

  skipDuplicate(name: string, args: unknown): string | null {
    const previous = this.seen.get(this.fingerprint(name, args));
    if (previous === undefined) return null;
    this.duplicateSkips += 1;
    return JSON.stringify({
      repeated: true,
      message: "This exact tool call was already made. Use the previous result.",
      previous,
    });
  }

  get shouldStop(): boolean {
    return this.consecutiveFailures >= this.maxFailures || this.duplicateSkips >= this.maxDuplicates;
  }

  get stats() {
    return { consecutiveFailures: this.consecutiveFailures, duplicateSkips: this.duplicateSkips };
  }
}

export function toolCallFingerprint(call: ToolCall): string {
  return `${call.name}:${stableJson(call.arguments)}`;
}
