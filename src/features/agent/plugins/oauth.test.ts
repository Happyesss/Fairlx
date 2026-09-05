import { afterEach, describe, expect, it, vi } from "vitest";

import { buildMailAuthorizeUrl, decodeOauthState, encodeOauthState, isMailOauthCatalog, mailOauthStatus } from "./oauth";

describe("mail oauth helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips OAuth state", () => {
    const encoded = encodeOauthState({
      userId: "u1",
      catalogId: "gmail",
      runId: "r1",
      from: "ada@x.com",
      nonce: "n1",
    });
    expect(decodeOauthState(encoded)).toEqual({
      userId: "u1",
      catalogId: "gmail",
      runId: "r1",
      from: "ada@x.com",
      nonce: "n1",
    });
  });

  it("builds Google and Microsoft authorize URLs with offline access", () => {
    const gmail = new URL(buildMailAuthorizeUrl({ catalogId: "gmail", clientId: "g-client", state: "st" }));
    expect(gmail.searchParams.get("access_type")).toBe("offline");
    expect(gmail.searchParams.get("prompt")).toBe("consent");
    const outlook = new URL(buildMailAuthorizeUrl({ catalogId: "outlook", clientId: "m-client", state: "st" }));
    expect(outlook.searchParams.get("scope")).toContain("Mail.Send");
    expect(outlook.searchParams.get("scope")).toContain("offline_access");
  });

  it("reports platform OAuth from env", () => {
    vi.stubEnv("AGENT_MICROSOFT_CLIENT_ID", "mid");
    vi.stubEnv("AGENT_MICROSOFT_CLIENT_SECRET", "msec");
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    vi.stubEnv("AGENT_GOOGLE_CLIENT_ID", "");
    vi.stubEnv("AGENT_GOOGLE_CLIENT_SECRET", "");
    expect(isMailOauthCatalog("outlook")).toBe(true);
    expect(mailOauthStatus().outlook).toBe(true);
    expect(mailOauthStatus().gmail).toBe(false);
  });
});
