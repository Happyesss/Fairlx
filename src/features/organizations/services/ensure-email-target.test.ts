import { describe, expect, it, vi } from "vitest";

import { ensureUserEmailTarget } from "./ensure-email-target";

describe("ensureUserEmailTarget", () => {
  it("reuses an existing email target", async () => {
    const users = {
      listTargets: vi.fn(async () => ({
        targets: [{ $id: "tgt_1", providerType: "email", identifier: "fogef@example.com" }],
      })),
      createTarget: vi.fn(),
    };

    await expect(
      ensureUserEmailTarget(users, "user_1", "fogef@example.com", { newId: () => "target_1" }),
    ).resolves.toBe("tgt_1");
    expect(users.createTarget).not.toHaveBeenCalled();
  });

  it("creates an email target when the user has none", async () => {
    const users = {
      listTargets: vi.fn(async () => ({ targets: [] })),
      createTarget: vi.fn(async () => ({ $id: "tgt_new" })),
    };

    await expect(
      ensureUserEmailTarget(users, "user_1", "fogef@example.com", {
        providerId: "smtp_fairlx",
        newId: () => "target_1",
      }),
    ).resolves.toBe("tgt_new");
    expect(users.createTarget).toHaveBeenCalledWith(
      "user_1",
      "target_1",
      "email",
      "fogef@example.com",
      "smtp_fairlx",
      "fogef@example.com",
    );
  });

  it("retries without a provider id when createTarget rejects the SMTP provider", async () => {
    const users = {
      listTargets: vi.fn(async () => ({ targets: [] })),
      createTarget: vi
        .fn()
        .mockRejectedValueOnce(new Error("Invalid providerId"))
        .mockResolvedValueOnce({ $id: "tgt_retry" }),
    };

    await expect(
      ensureUserEmailTarget(users, "user_1", "fogef@example.com", {
        providerId: "smtp_fairlx",
        newId: () => "target_1",
      }),
    ).resolves.toBe("tgt_retry");
    expect(users.createTarget).toHaveBeenNthCalledWith(
      2,
      "user_1",
      "target_1",
      "email",
      "fogef@example.com",
      undefined,
      "fogef@example.com",
    );
  });
});
