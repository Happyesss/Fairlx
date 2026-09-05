import { getAppBaseUrl } from "@/features/integrations/lib/helpers";

import type { AgentPluginConnection, AgentPluginSecrets } from "../types";
import { decryptSecret, encryptSecret } from "../lib/secrets";

export type MailOauthProvider = "outlook" | "gmail";

type TokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  from?: string;
};

const MICROSOFT_AUTH = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MICROSOFT_TOKEN = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MICROSOFT_SCOPES = "offline_access openid email User.Read Mail.Send";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email";

export function isMailOauthCatalog(id: string): id is MailOauthProvider {
  return id === "outlook" || id === "gmail";
}

export function microsoftClientId() {
  return (
    process.env.AGENT_MICROSOFT_CLIENT_ID?.trim() ||
    process.env.MICROSOFT_CLIENT_ID?.trim() ||
    process.env.AZURE_AD_CLIENT_ID?.trim() ||
    ""
  );
}

export function microsoftClientSecret() {
  return (
    process.env.AGENT_MICROSOFT_CLIENT_SECRET?.trim() ||
    process.env.MICROSOFT_CLIENT_SECRET?.trim() ||
    process.env.AZURE_AD_CLIENT_SECRET?.trim() ||
    ""
  );
}

export function googleClientId() {
  return process.env.AGENT_GOOGLE_CLIENT_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim() || "";
}

export function googleClientSecret() {
  return process.env.AGENT_GOOGLE_CLIENT_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
}

export function isPlatformMailOauthConfigured(catalogId: MailOauthProvider): boolean {
  if (catalogId === "outlook") return Boolean(microsoftClientId() && microsoftClientSecret());
  return Boolean(googleClientId() && googleClientSecret());
}

export function mailOauthStatus() {
  return {
    outlook: isPlatformMailOauthConfigured("outlook"),
    gmail: isPlatformMailOauthConfigured("gmail"),
  };
}

export function pluginOauthCallbackUrl() {
  return `${getAppBaseUrl()}/api/agent/plugins/oauth/callback`;
}

export type OauthState = {
  userId: string;
  catalogId: MailOauthProvider;
  runId?: string;
  from?: string;
  nonce: string;
};

export function encodeOauthState(state: OauthState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

export function decodeOauthState(encoded: string): OauthState {
  const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<OauthState>;
  if (parsed.catalogId !== "outlook" && parsed.catalogId !== "gmail") {
    throw new Error("Invalid OAuth catalog.");
  }
  if (!parsed.userId) throw new Error("Invalid OAuth state.");
  return {
    userId: parsed.userId,
    catalogId: parsed.catalogId,
    runId: parsed.runId,
    from: parsed.from,
    nonce: parsed.nonce || "",
  };
}

export function resolveOauthClient(
  catalogId: MailOauthProvider,
  plugin?: AgentPluginConnection | null,
): { clientId: string; clientSecret: string; source: "platform" | "user" } {
  if (isPlatformMailOauthConfigured(catalogId)) {
    return {
      clientId: catalogId === "outlook" ? microsoftClientId() : googleClientId(),
      clientSecret: catalogId === "outlook" ? microsoftClientSecret() : googleClientSecret(),
      source: "platform",
    };
  }
  const extra = plugin?.secrets?.extra ?? {};
  const clientId = extra.clientId || "";
  const clientSecret = plugin?.secrets?.clientSecretEncrypted
    ? decryptSecret(plugin.secrets.clientSecretEncrypted)
    : extra.clientSecret || "";
  if (!clientId || !clientSecret) {
    throw new Error(
      catalogId === "outlook"
        ? "Add a Microsoft app client ID and secret, or set AGENT_MICROSOFT_CLIENT_ID in Fairlx."
        : "Add a Google OAuth client ID and secret, or set GOOGLE_CLIENT_ID in Fairlx.",
    );
  }
  return { clientId, clientSecret, source: "user" };
}

export function buildMailAuthorizeUrl(params: {
  catalogId: MailOauthProvider;
  clientId: string;
  state: string;
}): string {
  const redirect = pluginOauthCallbackUrl();
  if (params.catalogId === "outlook") {
    const url = new URL(MICROSOFT_AUTH);
    url.searchParams.set("client_id", params.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", MICROSOFT_SCOPES);
    url.searchParams.set("state", params.state);
    url.searchParams.set("prompt", "consent");
    return url.toString();
  }
  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("scope", GOOGLE_SCOPES);
  url.searchParams.set("state", params.state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  return url.toString();
}

async function tokenRequest(url: string, body: URLSearchParams): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = String(json.error_description || json.error || `OAuth token exchange failed (${response.status})`);
    throw new Error(error.slice(0, 400));
  }
  return json;
}

function expiresAtFrom(expiresIn: unknown): string {
  const seconds = typeof expiresIn === "number" ? expiresIn : Number(expiresIn) || 3600;
  return new Date(Date.now() + Math.max(60, seconds - 60) * 1000).toISOString();
}

export async function exchangeMailOauthCode(params: {
  catalogId: MailOauthProvider;
  code: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenSet> {
  const redirect = pluginOauthCallbackUrl();
  if (params.catalogId === "outlook") {
    const json = await tokenRequest(
      MICROSOFT_TOKEN,
      new URLSearchParams({
        client_id: params.clientId,
        client_secret: params.clientSecret,
        grant_type: "authorization_code",
        code: params.code,
        redirect_uri: redirect,
        scope: MICROSOFT_SCOPES,
      }),
    );
    const accessToken = String(json.access_token || "");
    if (!accessToken) throw new Error("Microsoft did not return an access token.");
    return {
      accessToken,
      refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
      expiresAt: expiresAtFrom(json.expires_in),
    };
  }
  const json = await tokenRequest(
    GOOGLE_TOKEN,
    new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: redirect,
    }),
  );
  const accessToken = String(json.access_token || "");
  if (!accessToken) throw new Error("Google did not return an access token.");
  return {
    accessToken,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    expiresAt: expiresAtFrom(json.expires_in),
  };
}

export async function refreshMailAccessToken(params: {
  catalogId: MailOauthProvider;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenSet> {
  const endpoint = params.catalogId === "outlook" ? MICROSOFT_TOKEN : GOOGLE_TOKEN;
  const json = await tokenRequest(
    endpoint,
    new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: "refresh_token",
      refresh_token: params.refreshToken,
    }),
  );
  const accessToken = String(json.access_token || "");
  if (!accessToken) throw new Error("Token refresh did not return an access token.");
  return {
    accessToken,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : params.refreshToken,
    expiresAt: expiresAtFrom(json.expires_in),
  };
}

export async function lookupMailFromAddress(params: {
  catalogId: MailOauthProvider;
  accessToken: string;
}): Promise<string | undefined> {
  try {
    if (params.catalogId === "outlook") {
      const response = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${params.accessToken}` },
      });
      if (!response.ok) return undefined;
      const json = (await response.json()) as { mail?: string; userPrincipalName?: string };
      return json.mail || json.userPrincipalName;
    }
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });
    if (!response.ok) return undefined;
    const json = (await response.json()) as { emailAddress?: string };
    return json.emailAddress;
  } catch {
    return undefined;
  }
}

function tokenStillValid(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  const at = Date.parse(expiresAt);
  return Number.isFinite(at) && at > Date.now() + 30_000;
}

export async function ensureFreshMailToken(
  plugin: AgentPluginConnection,
): Promise<{ token: string; secrets: AgentPluginSecrets; rotated: boolean }> {
  const secrets: AgentPluginSecrets = { ...(plugin.secrets ?? {}), extra: { ...(plugin.secrets?.extra ?? {}) } };
  const expiresAt = secrets.extra?.tokenExpiresAt;
  if (secrets.accessTokenEncrypted && tokenStillValid(expiresAt) && !secrets.refreshTokenEncrypted) {
    return { token: decryptSecret(secrets.accessTokenEncrypted), secrets, rotated: false };
  }
  if (secrets.accessTokenEncrypted && tokenStillValid(expiresAt)) {
    return { token: decryptSecret(secrets.accessTokenEncrypted), secrets, rotated: false };
  }

  if (secrets.refreshTokenEncrypted && isMailOauthCatalog(plugin.catalogId)) {
    const client = resolveOauthClient(plugin.catalogId, plugin);
    const refreshed = await refreshMailAccessToken({
      catalogId: plugin.catalogId,
      refreshToken: decryptSecret(secrets.refreshTokenEncrypted),
      clientId: client.clientId,
      clientSecret: client.clientSecret,
    });
    secrets.accessTokenEncrypted = encryptSecret(refreshed.accessToken);
    secrets.refreshTokenEncrypted = encryptSecret(refreshed.refreshToken || decryptSecret(secrets.refreshTokenEncrypted));
    secrets.extra = { ...secrets.extra, tokenExpiresAt: refreshed.expiresAt };
    return { token: refreshed.accessToken, secrets, rotated: true };
  }

  if (secrets.accessTokenEncrypted) {
    return { token: decryptSecret(secrets.accessTokenEncrypted), secrets, rotated: false };
  }
  throw new Error("Mail plugin is missing a refresh token. Connect Outlook or Gmail again.");
}

export function applyOauthTokensToSecrets(
  secrets: AgentPluginSecrets | undefined,
  tokens: TokenSet,
  from?: string,
): AgentPluginSecrets {
  const extra = { ...(secrets?.extra ?? {}) };
  extra.tokenExpiresAt = tokens.expiresAt;
  return {
    ...secrets,
    extra,
    from: from || secrets?.from,
    accessTokenEncrypted: encryptSecret(tokens.accessToken),
    refreshTokenEncrypted: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : secrets?.refreshTokenEncrypted,
  };
}
