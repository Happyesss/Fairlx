import { describe, expect, it } from "vitest";
import type { AuthContext } from "../auth/context";
import { FORBIDDEN_ERROR, McpError } from "../protocol/errors";
import { requireConfirmation } from "./confirmation";
import type { McpRuntime } from "./types";

describe("requireConfirmation", () => {
  it("fails closed for tier 4 when redis is unavailable", async () => {
    const runtime = { redis: null } as unknown as McpRuntime;
    const auth = { actorUserId: "user_1" } as AuthContext;

    await expect(
      requireConfirmation({
        runtime,
        auth,
        tool: "fairlx_work_item_delete",
        args: { confirm: true },
        tier: 4,
      })
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof McpError &&
        error.code === FORBIDDEN_ERROR &&
        error.httpStatus === 403
    );
  });
});
