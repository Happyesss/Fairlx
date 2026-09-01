import { describe, expect, it } from "vitest";
import { compactMember, compactWorkItem, hydrateMembers, isWorkItemKeyCursor, paginationMeta, toolResult, wrapUntrusted } from "./output";

describe("output envelope", () => {
  it("wraps payloads as text content", () => {
    const result = toolResult({ ok: true });
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]?.text).toContain('"ok": true');
    expect(result.isError).toBeUndefined();
  });

  it("wraps untrusted content in fairlx tags", () => {
    const wrapped = wrapUntrusted("title", "user text");
    expect(wrapped).toContain("<fairlx_untrusted_content");
    expect(wrapped).toContain('label="title"');
    expect(wrapped).toContain("user text");
  });
});

describe("paginationMeta", () => {
  it("exposes nextCursor only when another page exists", () => {
    const docs = Array.from({ length: 50 }, (_, index) => ({ $id: `doc_${index}` }));
    const page = paginationMeta(docs, 55, 50);
    expect(page).toEqual({
      hasMore: true,
      nextCursor: "doc_49",
      returned: 50,
      total: 55,
    });
    expect(paginationMeta(docs.slice(0, 11), 11, 50).hasMore).toBe(false);
    expect(paginationMeta(docs.slice(0, 11), 11, 50).nextCursor).toBeNull();
  });
});

describe("isWorkItemKeyCursor", () => {
  it("rejects work-item keys and accepts document ids", () => {
    expect(isWorkItemKeyCursor("PROJ-2")).toBe(true);
    expect(isWorkItemKeyCursor("WEB-12")).toBe(true);
    expect(isWorkItemKeyCursor("6a79fedd0023d3c1f3e9")).toBe(false);
  });
});

describe("compactWorkItem", () => {
  it("treats empty assigneeIds as unassigned when names are not hydrated", () => {
    expect(compactWorkItem({ key: "A-1", title: "None", assigneeIds: [] })).toMatchObject({
      key: "A-1",
      assignees: [],
      unassigned: true,
    });
  });

  it("treats unresolved hydrated names as unassigned like the board", () => {
    expect(
      compactWorkItem({ key: "A-2", title: "Stale", assigneeIds: ["gone"] }, []),
    ).toMatchObject({
      key: "A-2",
      assignees: [],
      unassigned: true,
    });
  });

  it("keeps hydrated assignee profile images", () => {
    expect(
      compactWorkItem(
        { key: "A-3", title: "With photo", assigneeIds: ["m1"] },
        [{ name: "Ada Lovelace", imageUrl: "https://cdn.example/ada.png" }],
      ),
    ).toMatchObject({
      key: "A-3",
      assignees: [{ name: "Ada Lovelace", imageUrl: "https://cdn.example/ada.png" }],
      unassigned: false,
    });
  });
});

describe("compactMember", () => {
  it("uses Appwrite user profiles for name and email like the Members page", () => {
    expect(
      compactMember(
        { userId: "u1", role: "OWNER", status: "ACTIVE", name: null, email: null },
        { id: "u1", name: "Surendra Mattaparthi", email: "surendram.dev@gmail.com" },
      ),
    ).toEqual({
      name: "Surendra Mattaparthi",
      email: "surendram.dev@gmail.com",
      role: "OWNER",
      status: "ACTIVE",
      imageUrl: null,
    });
  });

  it("keeps profile images from user prefs", () => {
    expect(
      compactMember(
        { userId: "u1", role: "ADMIN", status: "ACTIVE" },
        {
          id: "u1",
          name: "Ada",
          email: "ada@fairlx.dev",
          profileImageUrl: "https://cdn.example/ada.png",
        },
      ),
    ).toMatchObject({
      name: "Ada",
      imageUrl: "https://cdn.example/ada.png",
    });
  });

  it("falls back to email when the profile has no name", () => {
    expect(compactMember({ role: "MEMBER" }, { id: "u2", name: "", email: "ada@fairlx.dev" }).name).toBe(
      "ada@fairlx.dev",
    );
  });
});

describe("hydrateMembers", () => {
  it("batch-fills names from lookupUsers instead of leaving them null", async () => {
    const members = await hydrateMembers(
      {
        lookupUsers: async () => [
          { id: "u1", name: "Ada", email: "ada@fairlx.dev" },
          { id: "u2", name: "Sam", email: "sam@fairlx.dev" },
        ],
      },
      [
        { userId: "u1", role: "ADMIN", status: "ACTIVE", name: null, email: null },
        { userId: "u2", role: "MEMBER", status: "ACTIVE" },
      ],
    );
    expect(members.map((member) => member.name)).toEqual(["Ada", "Sam"]);
    expect(members.map((member) => member.email)).toEqual(["ada@fairlx.dev", "sam@fairlx.dev"]);
  });
});
