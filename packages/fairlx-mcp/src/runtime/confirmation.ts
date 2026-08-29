import { createHash, randomBytes } from "node:crypto";
import { forbiddenError } from "../protocol/errors";
import type { McpToolResult } from "../protocol/types";
import type { AuthContext } from "../auth/context";
import type { McpRuntime } from "./types";
import { toolResult } from "./output";

export const CONFIRMATION_TTL_SECONDS = 120;

export function hashArgs(args: Record<string, unknown>): string {
  const clone = { ...args };
  delete clone.confirm;
  delete clone.challengeToken;
  return createHash("sha256").update(JSON.stringify(clone)).digest("hex");
}

export function issueChallengeToken(): string {
  return `ctk_${randomBytes(16).toString("hex")}`;
}

export async function requireConfirmation(options: {
  runtime: McpRuntime;
  auth: AuthContext;
  tool: string;
  args: Record<string, unknown>;
  tier: 3 | 4 | 6;
}): Promise<McpToolResult | null> {
  const { runtime, auth, tool, args, tier } = options;
  const confirm = args.confirm === true;
  const challengeToken = typeof args.challengeToken === "string" ? args.challengeToken : undefined;

  if (tier === 3) {
    if (!confirm) {
      return toolResult({
        code: "CONFIRMATION_REQUIRED",
        message: `${tool} is a high-risk write. Retry with confirm: true.`,
        tool,
        confirmRequired: true,
      });
    }
    return null;
  }

  if (!runtime.redis) {
    throw forbiddenError("Confirmation store unavailable");
  }

  if (!challengeToken) {
    const token = issueChallengeToken();
    const payload = {
      tool,
      argsHash: hashArgs(args),
      actorUserId: auth.actorUserId,
      tokenId: auth.tokenId ?? null,
    };
    await runtime.redis.set(
      `mcp:confirm:${token}`,
      JSON.stringify(payload),
      CONFIRMATION_TTL_SECONDS
    );
    return toolResult({
      code: "CONFIRMATION_REQUIRED",
      message: `${tool} is destructive. Retry with confirm: true and the challengeToken within ${CONFIRMATION_TTL_SECONDS}s.`,
      tool,
      confirmRequired: true,
      challengeToken: token,
      ttlSeconds: CONFIRMATION_TTL_SECONDS,
    });
  }

  if (!confirm) {
    return toolResult({
      code: "CONFIRMATION_REQUIRED",
      message: `${tool} requires confirm: true and the issued challengeToken.`,
      tool,
      confirmRequired: true,
      challengeToken,
    });
  }

  const raw = await runtime.redis.get(`mcp:confirm:${challengeToken}`);
  if (!raw) {
    throw forbiddenError("Invalid or expired challengeToken");
  }

  let stored: { tool: string; argsHash: string; actorUserId: string; tokenId: string | null };
  try {
    stored = JSON.parse(raw) as typeof stored;
  } catch {
    throw forbiddenError("Invalid or expired challengeToken");
  }

  if (stored.tool !== tool) {
    throw forbiddenError("challengeToken does not match this tool");
  }
  if (stored.actorUserId !== auth.actorUserId) {
    throw forbiddenError("challengeToken does not match this actor");
  }
  if (stored.argsHash !== hashArgs(args)) {
    throw forbiddenError("challengeToken does not match these arguments");
  }

  await runtime.redis.del(`mcp:confirm:${challengeToken}`);
  return null;
}
