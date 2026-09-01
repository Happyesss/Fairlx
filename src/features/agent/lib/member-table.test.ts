import { describe, expect, it } from "vitest";

import { mergeMember, normalizeRole, splitMarkdownMemberTable } from "./member-table";

describe("splitMarkdownMemberTable", () => {
  it("parses name, email, and role tables", () => {
    const parsed = splitMarkdownMemberTable(`
There are 10 members:

| Name | Email | Role |
| --- | --- | --- |
| Surendra Mattaparthi | surendra@stemlen.com | OWNER |
| Ada Lovelace | ada@fairlx.dev | Member |
`);
    expect(parsed?.rows).toEqual([
      { name: "Surendra Mattaparthi", email: "surendra@stemlen.com", role: "OWNER" },
      { name: "Ada Lovelace", email: "ada@fairlx.dev", role: "MEMBER" },
    ]);
  });

  it("ignores work-item tables", () => {
    expect(
      splitMarkdownMemberTable(`
| Key | Title | Status | Assignee |
| --- | --- | --- | --- |
| PROJ-1 | Fix export | TODO | Unassigned |
`),
    ).toBeNull();
  });
});

describe("mergeMember", () => {
  it("fills profile images from the members list payload", () => {
    expect(
      mergeMember(
        { name: "Ada Lovelace", email: "ada@fairlx.dev", role: "Admin" },
        { name: "Ada Lovelace", email: "ada@fairlx.dev", role: "ADMIN", imageUrl: "https://cdn.example/ada.png" },
      ),
    ).toMatchObject({
      role: "ADMIN",
      imageUrl: "https://cdn.example/ada.png",
    });
  });
});

describe("normalizeRole", () => {
  it("maps human labels to workspace roles", () => {
    expect(normalizeRole("owner")).toBe("OWNER");
    expect(normalizeRole("Admin")).toBe("ADMIN");
    expect(normalizeRole("member")).toBe("MEMBER");
  });
});
