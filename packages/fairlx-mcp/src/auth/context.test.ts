import { describe, expect, it } from "vitest";
import type { McpTokenRecord } from "../runtime/types";
import { jwtToAuthContext, tokenToAuthContext } from "./context";
import { ALL_SCOPES } from "./scopes";

const token: McpTokenRecord = {
  $id: "tok_1",
  workspaceId: "ws_1",
  createdBy: "user_1",
};

describe("tokenToAuthContext", () => {
  it("inherits ALL_SCOPES when the token has empty scopes", () => {
    expect(tokenToAuthContext(token).scopes).toEqual([...ALL_SCOPES]);
  });

  it("inherits role scopes for unscoped project tokens", () => {
    const auth = tokenToAuthContext(token, { roleScopes: ["tasks:read", "tasks:write"] });
    expect(auth.scopes).toEqual(["tasks:read", "tasks:write"]);
  });

  it("applies explicit scopes as a ceiling on the inherited role", () => {
    const auth = tokenToAuthContext(
      { ...token, scopes: ["tasks:read"] },
      { roleScopes: ["tasks:read", "tasks:write", "tasks:delete"] }
    );
    expect(auth.scopes).toEqual(["tasks:read"]);
  });
});

describe("jwtToAuthContext", () => {
    it("inherits ALL_SCOPES including admin:manage", () => {
    const auth = jwtToAuthContext("user_jwt");
    expect(auth.scopes).toEqual([...ALL_SCOPES]);
    expect(auth.scopes).toContain("admin:manage");
    expect(auth.scopes).toContain("tasks:delete");
  });

  it("can bind a workspace and role scopes for the in-app agent", () => {
    const auth = jwtToAuthContext("user_jwt", {
      workspaceId: "ws_1",
      scopes: ["tasks:read", "members:read"],
    });
    expect(auth.workspaceId).toBe("ws_1");
    expect(auth.scopes).toEqual(["tasks:read", "members:read"]);
  });
});
