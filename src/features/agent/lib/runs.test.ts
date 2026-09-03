import { describe, expect, it, vi } from "vitest";
import type { Databases } from "node-appwrite";
import { createRun, updateRun } from "./runs";

describe("createRun attribute fallback", () => {
  it("retries without unknown attributes when Appwrite throws an unknown attribute error", async () => {
    const mockCreateDocument = vi
      .fn()
      // First attempt fails with AppwriteException unknown attribute: extraJson
      .mockRejectedValueOnce(
        new Error('Invalid document structure: Unknown attribute: "extraJson"')
      )
      // Second attempt succeeds
      .mockResolvedValueOnce({
        $id: "run-123",
        $createdAt: "2026-09-03T00:00:00.000Z",
        $updatedAt: "2026-09-03T00:00:00.000Z",
        userId: "user-1",
        title: "Test Run",
        prompt: "Hello world",
        status: "running",
        mode: "agent",
        messagesJson: "[]",
        eventsJson: "[]",
      });

    const mockDatabases = {
      createDocument: mockCreateDocument,
    } as unknown as Databases;

    const run = await createRun(mockDatabases, {
      userId: "user-1",
      prompt: "Hello world",
      mode: "agent",
    });

    expect(mockCreateDocument).toHaveBeenCalledTimes(2);
    // First call included extraJson
    expect(mockCreateDocument.mock.calls[0][3]).toHaveProperty("extraJson");
    // Second call stripped extraJson
    expect(mockCreateDocument.mock.calls[1][3]).not.toHaveProperty("extraJson");
    expect(run.id).toBe("run-123");
    expect(run.title).toBe("Test Run");
  });

  it("re-throws unexpected errors", async () => {
    const mockCreateDocument = vi
      .fn()
      .mockRejectedValueOnce(new Error("Database connection refused"));

    const mockDatabases = {
      createDocument: mockCreateDocument,
    } as unknown as Databases;

    await expect(
      createRun(mockDatabases, {
        userId: "user-1",
        prompt: "Hello world",
        mode: "agent",
      })
    ).rejects.toThrow("Database connection refused");
  });
});

describe("updateRun attribute fallback", () => {
  it("retries without unknown attributes when Appwrite update throws an unknown attribute error", async () => {
    const mockUpdateDocument = vi
      .fn()
      .mockRejectedValueOnce(
        new Error('Invalid document structure: Unknown attribute: "error"')
      )
      .mockResolvedValueOnce({
        $id: "run-123",
        $createdAt: "2026-09-03T00:00:00.000Z",
        $updatedAt: "2026-09-03T00:00:00.000Z",
        userId: "user-1",
        title: "Updated Run",
        prompt: "Hello world",
        status: "failed",
        mode: "agent",
        messagesJson: "[]",
        eventsJson: "[]",
      });

    const mockDatabases = {
      updateDocument: mockUpdateDocument,
    } as unknown as Databases;

    const run = await updateRun(mockDatabases, "run-123", {
      status: "failed",
      error: "Something went wrong",
    });

    expect(mockUpdateDocument).toHaveBeenCalledTimes(2);
    expect(mockUpdateDocument.mock.calls[0][3]).toHaveProperty("error");
    expect(mockUpdateDocument.mock.calls[1][3]).not.toHaveProperty("error");
    expect(run.status).toBe("failed");
  });
});
