/**
 * Cloud → appwrite.fairlx.com migrator
 *
 * Uses Appwrite's official Migrations API (console admin session on the
 * destination) to copy users, databases/rows, files, teams, functions, and sites.
 * Then re-adds web platforms, optional Auth OAuth, Messaging SMTP/topic, and
 * points .env.local at the self-host project.
 *
 * Usage:
 *   npx tsx scripts/migrate-cloud-to-selfhost.ts inventory
 *   npx tsx scripts/migrate-cloud-to-selfhost.ts migrate
 *
 * Destination console login (required for migrate):
 *   SELFHOST_CONSOLE_EMAIL
 *   SELFHOST_CONSOLE_PASSWORD
 * Optional: SELFHOST_PROJECT, SELFHOST_ORG_ID, SMTP_*, AUTH_GITHUB_*, AUTH_GOOGLE_*
 */
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.selfhost.local", override: false });

const CLOUD_ENDPOINT = required("NEXT_PUBLIC_APPWRITE_ENDPOINT");
const CLOUD_PROJECT = required("NEXT_PUBLIC_APPWRITE_PROJECT");
const CLOUD_KEY = required("NEXT_APPWRITE_KEY");

const SELFHOST_ENDPOINT = (
  process.env.SELFHOST_ENDPOINT || "https://appwrite.fairlx.com/v1"
).replace(/\/$/, "");
const SELFHOST_CONSOLE_EMAIL = process.env.SELFHOST_CONSOLE_EMAIL || "";
const SELFHOST_CONSOLE_PASSWORD = process.env.SELFHOST_CONSOLE_PASSWORD || "";
const PROJECT_NAME = process.env.SELFHOST_PROJECT_NAME || "Fairlx";
const ORG_NAME = process.env.SELFHOST_ORG_NAME || "Fairlx";
const DEFAULT_PLATFORMS = (
  process.env.SELFHOST_PLATFORMS || "localhost,app.fairlx.com,fairlx.com"
)
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

const MIGRATION_RESOURCES = [
  "user",
  "team",
  "membership",
  "database",
  "collection",
  "attribute",
  "index",
  "document",
  "bucket",
  "file",
  "function",
  "environment-variable",
  "deployment",
  "table",
  "column",
  "row",
  "site",
];

const API_KEY_SCOPES = [
  "sessions.write",
  "users.read",
  "users.write",
  "teams.read",
  "teams.write",
  "databases.read",
  "databases.write",
  "collections.read",
  "collections.write",
  "attributes.read",
  "attributes.write",
  "indexes.read",
  "indexes.write",
  "documents.read",
  "documents.write",
  "files.read",
  "files.write",
  "buckets.read",
  "buckets.write",
  "functions.read",
  "functions.write",
  "execution.read",
  "execution.write",
  "locale.read",
  "avatars.read",
  "health.read",
  "providers.read",
  "providers.write",
  "messages.read",
  "messages.write",
  "topics.read",
  "topics.write",
  "subscribers.read",
  "subscribers.write",
  "targets.read",
  "targets.write",
  "migrations.read",
  "migrations.write",
  "sites.read",
  "sites.write",
  "tables.read",
  "tables.write",
  "columns.read",
  "columns.write",
  "rows.read",
  "rows.write",
];

type Json = Record<string, unknown>;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} in .env.local`);
  }
  return value;
}

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  const parts = header.split(/,(?=\s*[^;=]+=)/);
  for (const part of parts) {
    const [pair] = part.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    if (key === name) return pair.slice(eq + 1).trim();
  }
  return null;
}

async function request(
  endpoint: string,
  init: {
    method?: string;
    path: string;
    project: string;
    key?: string;
    session?: string;
    body?: unknown;
    query?: Record<string, string | string[]>;
  },
): Promise<{ status: number; data: Json; headers: Headers }> {
  const url = new URL(endpoint.replace(/\/$/, "") + init.path);
  if (init.query) {
    for (const [key, value] of Object.entries(init.query)) {
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, item);
      } else {
        url.searchParams.set(key, value);
      }
    }
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-appwrite-project": init.project,
  };
  if (init.key) headers["x-appwrite-key"] = init.key;
  if (init.session) headers["x-appwrite-session"] = init.session;

  const response = await fetch(url, {
    method: init.method || (init.body ? "POST" : "GET"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const text = await response.text();
  let data: Json = {};
  if (text) {
    try {
      data = JSON.parse(text) as Json;
    } catch {
      data = { raw: text };
    }
  }
  return { status: response.status, data, headers: response.headers };
}

function assertOk(label: string, status: number, data: Json): void {
  if (status >= 400) {
    const message =
      (data.message as string) ||
      (data.raw as string) ||
      JSON.stringify(data).slice(0, 500);
    throw new Error(`${label} failed (${status}): ${message}`);
  }
}

async function cloudGet(path: string, query?: Record<string, string>): Promise<Json> {
  const { status, data } = await request(CLOUD_ENDPOINT, {
    path,
    project: CLOUD_PROJECT,
    key: CLOUD_KEY,
    query,
  });
  assertOk(`Cloud GET ${path}`, status, data);
  return data;
}

async function cloudGetSafe(path: string): Promise<Json> {
  try {
    return await cloudGet(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Cloud GET ${path}: ${message}`);
    return { error: message };
  }
}

async function inventoryCloud(): Promise<void> {
  console.log("=== Cloud source inventory ===");
  console.log(`endpoint: ${CLOUD_ENDPOINT}`);
  console.log(`project:  ${CLOUD_PROJECT}`);

  const users = await cloudGetSafe("/users");
  const teams = await cloudGetSafe("/teams");
  const databases = await cloudGetSafe("/databases");
  const buckets = await cloudGetSafe("/storage/buckets");
  let functions: Json = { functions: [], total: 0 };
  try {
    functions = await cloudGet("/functions");
  } catch {
    functions = { functions: [], total: 0 };
  }
  let providers: Json = { providers: [] };
  try {
    providers = await cloudGet("/messaging/providers");
  } catch {
    providers = { providers: [] };
  }
  let topics: Json = { topics: [] };
  try {
    topics = await cloudGet("/messaging/topics");
  } catch {
    topics = { topics: [] };
  }

  console.log(`users:     ${users.total ?? "?"}`);
  console.log(`teams:     ${teams.total ?? "?"}`);
  console.log(
    "databases:",
    ((databases.databases as Json[]) || []).map((d) => d.$id).join(", ") || "(none)",
  );
  console.log(
    "buckets:",
    ((buckets.buckets as Json[]) || [])
      .map((b) => `${b.$id} (max ${b.maximumFileSize} bytes)`)
      .join(", ") || "(none)",
  );
  console.log(`functions: ${functions.total ?? ((functions.functions as Json[]) || []).length}`);
  console.log(
    "messaging providers:",
    ((providers.providers as Json[]) || []).map((p) => `${p.$id}:${p.name}:${p.type}`).join(", ") ||
      "(none)",
  );
  console.log(
    "messaging topics:",
    ((topics.topics as Json[]) || []).map((t) => `${t.$id}:${t.name}`).join(", ") || "(none)",
  );
  console.log(
    "Fairlx collection IDs stay in .env.local if the wizard preserves them (expected).",
  );
}

async function loginConsole(): Promise<string> {
  if (!SELFHOST_CONSOLE_EMAIL || !SELFHOST_CONSOLE_PASSWORD) {
    throw new Error(
      [
        "Self-host console login is required (Migrations is an admin API).",
        "Create .env.selfhost.local with:",
        "  SELFHOST_CONSOLE_EMAIL=you@fairlx.com",
        "  SELFHOST_CONSOLE_PASSWORD=...",
        "Optional:",
        "  SELFHOST_PROJECT=fairlx",
        "  SELFHOST_ENDPOINT=https://appwrite.fairlx.com/v1",
        "  SMTP_HOST / SMTP_PORT / SMTP_USERNAME / SMTP_PASSWORD / SMTP_FROM",
        "  AUTH_GITHUB_CLIENT_ID / AUTH_GITHUB_CLIENT_SECRET",
        "  AUTH_GOOGLE_CLIENT_ID / AUTH_GOOGLE_CLIENT_SECRET",
      ].join("\n"),
    );
  }

  const { status, data, headers } = await request(SELFHOST_ENDPOINT, {
    method: "POST",
    path: "/account/sessions/email",
    project: "console",
    body: {
      email: SELFHOST_CONSOLE_EMAIL,
      password: SELFHOST_CONSOLE_PASSWORD,
    },
  });
  assertOk("Console login", status, data);

  const secret =
    (data.secret as string) ||
    cookieValue(headers.get("set-cookie"), "a_session_console") ||
    cookieValue(headers.get("Set-Cookie"), "a_session_console");
  if (!secret) {
    throw new Error("Console login succeeded but no session secret was returned");
  }
  console.log(`Logged into self-host console as ${SELFHOST_CONSOLE_EMAIL}`);
  return secret;
}

async function consoleApi(
  session: string,
  init: {
    method?: string;
    path: string;
    project?: string;
    body?: unknown;
    query?: Record<string, string | string[]>;
  },
) {
  return request(SELFHOST_ENDPOINT, {
    ...init,
    project: init.project || "console",
    session,
  });
}

async function ensureOrganization(session: string): Promise<string> {
  if (process.env.SELFHOST_ORG_ID) return process.env.SELFHOST_ORG_ID;

  const list = await consoleApi(session, { path: "/teams" });
  if (list.status < 400) {
    const teams = (list.data.teams as Json[]) || [];
    const existing = teams.find((t) => t.name === ORG_NAME) || teams[0];
    if (existing?.$id) {
      console.log(`Using organization/team ${existing.$id} (${existing.name})`);
      return existing.$id as string;
    }
  }

  const org = await consoleApi(session, {
    method: "POST",
    path: "/teams",
    body: { teamId: "unique()", name: ORG_NAME },
  });
  if (org.status >= 400) {
    const alt = await consoleApi(session, {
      method: "POST",
      path: "/organizations",
      body: { organizationId: "unique()", name: ORG_NAME },
    });
    assertOk("Create organization", alt.status, alt.data);
    console.log(`Created organization ${alt.data.$id}`);
    return alt.data.$id as string;
  }
  console.log(`Created organization/team ${org.data.$id}`);
  return org.data.$id as string;
}

async function ensureProject(session: string, teamId: string): Promise<string> {
  const requested = process.env.SELFHOST_PROJECT || "fairlx";
  const existing = await consoleApi(session, { path: `/projects/${requested}` });
  if (existing.status < 400 && existing.data.$id) {
    console.log(`Using existing project ${existing.data.$id}`);
    return existing.data.$id as string;
  }

  const created = await consoleApi(session, {
    method: "POST",
    path: "/projects",
    body: {
      projectId: requested,
      name: PROJECT_NAME,
      teamId,
    },
  });
  if (created.status >= 400 && requested !== "unique()") {
    const retry = await consoleApi(session, {
      method: "POST",
      path: "/projects",
      body: {
        projectId: "unique()",
        name: PROJECT_NAME,
        teamId,
      },
    });
    assertOk("Create project", retry.status, retry.data);
    console.log(`Created project ${retry.data.$id}`);
    return retry.data.$id as string;
  }
  assertOk("Create project", created.status, created.data);
  console.log(`Created project ${created.data.$id}`);
  return created.data.$id as string;
}

async function ensureApiKey(session: string, projectId: string): Promise<string> {
  if (process.env.SELFHOST_KEY) return process.env.SELFHOST_KEY;

  const created = await consoleApi(session, {
    method: "POST",
    path: `/projects/${projectId}/keys`,
    body: {
      name: "Fairlx server (cloud migration)",
      scopes: API_KEY_SCOPES,
    },
  });
  assertOk("Create API key", created.status, created.data);
  const secret = created.data.secret as string;
  if (!secret) throw new Error("API key created but secret was empty");
  console.log(`Created API key ${created.data.$id}`);
  return secret;
}

async function addPlatforms(session: string, projectId: string): Promise<void> {
  const listed = await consoleApi(session, {
    path: `/projects/${projectId}/platforms`,
  });
  const existing = new Set(
    ((listed.data.platforms as Json[]) || []).map((p) => String(p.hostname || "")),
  );

  for (const hostname of DEFAULT_PLATFORMS) {
    if (existing.has(hostname)) {
      console.log(`Platform already present: ${hostname}`);
      continue;
    }
    const created = await consoleApi(session, {
      method: "POST",
      path: `/projects/${projectId}/platforms`,
      body: {
        type: "web",
        name: `Fairlx ${hostname}`,
        hostname,
      },
    });
    if (created.status >= 400) {
      console.warn(`Could not add platform ${hostname}: ${created.data.message || created.status}`);
    } else {
      console.log(`Added web platform ${hostname}`);
    }
  }
}

async function configureOAuth(session: string, projectId: string): Promise<void> {
  const providers: Array<{
    provider: string;
    appId?: string;
    secret?: string;
  }> = [
    {
      provider: "github",
      appId: process.env.AUTH_GITHUB_CLIENT_ID,
      secret: process.env.AUTH_GITHUB_CLIENT_SECRET,
    },
    {
      provider: "google",
      appId: process.env.AUTH_GOOGLE_CLIENT_ID,
      secret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
    },
  ];

  for (const item of providers) {
    if (!item.appId || !item.secret) {
      console.log(
        `Skip Auth ${item.provider}: set AUTH_${item.provider.toUpperCase()}_CLIENT_ID/SECRET to enable`,
      );
      console.log(
        `  Callback: ${SELFHOST_ENDPOINT}/account/sessions/oauth2/callback/${item.provider}/${projectId}`,
      );
      continue;
    }
    const updated = await consoleApi(session, {
      method: "PATCH",
      path: `/projects/${projectId}/oauth2`,
      body: {
        provider: item.provider,
        appId: item.appId,
        secret: item.secret,
        enabled: true,
      },
    });
    if (updated.status >= 400) {
      const alt = await consoleApi(session, {
        method: "PUT",
        path: `/projects/${projectId}/oauth2`,
        body: {
          provider: item.provider,
          appId: item.appId,
          secret: item.secret,
          enabled: true,
        },
      });
      if (alt.status >= 400) {
        console.warn(`Could not enable ${item.provider} OAuth: ${alt.data.message || alt.status}`);
        continue;
      }
    }
    console.log(`Enabled Auth OAuth provider ${item.provider}`);
    console.log(
      `  Callback: ${SELFHOST_ENDPOINT}/account/sessions/oauth2/callback/${item.provider}/${projectId}`,
    );
  }
}

async function configureMessaging(projectId: string, key: string): Promise<{
  providerId: string;
  topicId: string;
}> {
  const existingProviderId = process.env.NEXT_PUBLIC_APPWRITE_SMTP_PROVIDER_ID || "";
  const existingTopicId = process.env.NEXT_PUBLIC_APPWRITE_EMAIL_TOPIC_ID || "";
  const smtpHost = process.env.SMTP_HOST || process.env._APP_SMTP_HOST || "";

  if (!smtpHost) {
    console.log(
      "Skip Messaging SMTP: set SMTP_HOST/SMTP_PORT/SMTP_USERNAME/SMTP_PASSWORD/SMTP_FROM (instance SMTP is separate).",
    );
    return { providerId: existingProviderId, topicId: existingTopicId };
  }

  const providerId = existingProviderId || "smtp_fairlx";
  const created = await request(SELFHOST_ENDPOINT, {
    method: "POST",
    path: "/messaging/providers/smtp",
    project: projectId,
    key,
    body: {
      providerId,
      name: "Fairlx SMTP",
      host: smtpHost,
      port: Number(process.env.SMTP_PORT || 587),
      username: process.env.SMTP_USERNAME || "",
      password: process.env.SMTP_PASSWORD || "",
      encryption: process.env.SMTP_ENCRYPTION || "tls",
      autoTLS: true,
      mailer: "smtp",
      fromName: process.env.SMTP_FROM_NAME || "Fairlx",
      fromEmail: process.env.SMTP_FROM || process.env.EMAIL_FROM || "contact@fairlx.com",
      enabled: true,
    },
  });
  if (created.status >= 400 && created.status !== 409) {
    console.warn(`SMTP provider: ${created.data.message || created.status}`);
  } else {
    console.log(`Messaging SMTP provider ${providerId}`);
  }

  const topicId = existingTopicId || "email_notifications";
  const topic = await request(SELFHOST_ENDPOINT, {
    method: "POST",
    path: "/messaging/topics",
    project: projectId,
    key,
    body: {
      topicId,
      name: "Email notifications",
      subscribe: ["any"],
    },
  });
  if (topic.status >= 400 && topic.status !== 409) {
    console.warn(`Email topic: ${topic.data.message || topic.status}`);
  } else {
    console.log(`Messaging topic ${topicId}`);
  }

  return { providerId, topicId };
}

async function filterResources(session: string, projectId: string): Promise<string[]> {
  const { status, data } = await consoleApi(session, {
    path: "/migrations/appwrite/report",
    project: projectId,
    query: {
      resources: MIGRATION_RESOURCES,
      endpoint: CLOUD_ENDPOINT,
      projectID: CLOUD_PROJECT,
      key: CLOUD_KEY,
    },
  });

  if (status >= 400) {
    const message = String(data.message || "");
    const allowed = MIGRATION_RESOURCES.filter((resource) => {
      return !message.includes(`'${resource}'`) && !message.includes(`"${resource}"`);
    });
    if (allowed.length && allowed.length < MIGRATION_RESOURCES.length) {
      console.log(`Retrying report without unsupported resources (${message.slice(0, 180)})`);
      const retry = await consoleApi(session, {
        path: "/migrations/appwrite/report",
        project: projectId,
        query: {
          resources: allowed,
          endpoint: CLOUD_ENDPOINT,
          projectID: CLOUD_PROJECT,
          key: CLOUD_KEY,
        },
      });
      assertOk("Migration report", retry.status, retry.data);
      console.log("Source report:", JSON.stringify(retry.data, null, 2).slice(0, 2000));
      return allowed;
    }
    assertOk("Migration report", status, data);
  }

  console.log("Source report:", JSON.stringify(data, null, 2).slice(0, 2000));
  return MIGRATION_RESOURCES;
}

async function startMigration(
  session: string,
  projectId: string,
  resources: string[],
): Promise<string> {
  const { status, data } = await consoleApi(session, {
    method: "POST",
    path: "/migrations/appwrite",
    project: projectId,
    body: {
      resources,
      endpoint: CLOUD_ENDPOINT,
      projectId: CLOUD_PROJECT,
      apiKey: CLOUD_KEY,
    },
  });
  assertOk("Start migration", status, data);
  const id = data.$id as string;
  console.log(`Migration started: ${id} status=${data.status} stage=${data.stage}`);
  return id;
}

async function waitForMigration(
  session: string,
  projectId: string,
  migrationId: string,
): Promise<Json> {
  for (;;) {
    const { status, data } = await consoleApi(session, {
      path: `/migrations/${migrationId}`,
      project: projectId,
    });
    assertOk("Poll migration", status, data);
    const state = `${data.status}/${data.stage}`;
    const errors = data.errors;
    console.log(`Migration ${migrationId}: ${state}`);
    if (errors && JSON.stringify(errors) !== "[]") {
      console.log("errors:", JSON.stringify(errors).slice(0, 1500));
    }
    if (data.status === "completed" || data.status === "failed") {
      return data;
    }
    await new Promise((r) => setTimeout(r, 8000));
  }
}

function upsertEnv(updates: Record<string, string>): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const lines = content.split("\n");
  const seen = new Set<string>();
  const next = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return line;
    const key = trimmed.slice(0, trimmed.indexOf("=")).trim();
    if (key in updates) {
      seen.add(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });
  const missing = Object.entries(updates).filter(([key]) => !seen.has(key));
  if (missing.length) {
    next.push("");
    next.push("# ─── Self-hosted Appwrite (cloud migration) ───");
    for (const [key, value] of missing) next.push(`${key}=${value}`);
  }
  fs.writeFileSync(envPath, next.join("\n"));
  console.log("Updated .env.local endpoint/project/key (collection IDs left unchanged)");
}

async function smokeTest(projectId: string, key: string): Promise<void> {
  const users = await request(SELFHOST_ENDPOINT, {
    path: "/users",
    project: projectId,
    key,
    query: {},
  });
  assertOk("Smoke users", users.status, users.data);
  const databases = await request(SELFHOST_ENDPOINT, {
    path: "/databases",
    project: projectId,
    key,
  });
  assertOk("Smoke databases", databases.status, databases.data);
  const buckets = await request(SELFHOST_ENDPOINT, {
    path: "/storage/buckets",
    project: projectId,
    key,
  });
  assertOk("Smoke buckets", buckets.status, buckets.data);
  console.log("=== Smoke test ===");
  console.log(`self-host users:     ${users.data.total}`);
  console.log(
    "self-host databases:",
    ((databases.data.databases as Json[]) || []).map((d) => d.$id).join(", ") || "(none)",
  );
  console.log(
    "self-host buckets:",
    ((buckets.data.buckets as Json[]) || []).map((b) => b.$id).join(", ") || "(none)",
  );
}

async function migrate(): Promise<void> {
  await inventoryCloud();
  const session = await loginConsole();
  const teamId = await ensureOrganization(session);
  const projectId = await ensureProject(session, teamId);
  const key = await ensureApiKey(session, projectId);
  await addPlatforms(session, projectId);
  const resources = await filterResources(session, projectId);
  const migrationId = await startMigration(session, projectId, resources);
  const result = await waitForMigration(session, projectId, migrationId);
  if (result.status === "failed") {
    throw new Error(`Migration ${migrationId} failed`);
  }
  await configureOAuth(session, projectId);
  const messaging = await configureMessaging(projectId, key);
  upsertEnv({
    NEXT_PUBLIC_APPWRITE_ENDPOINT: SELFHOST_ENDPOINT,
    NEXT_PUBLIC_APPWRITE_PROJECT: projectId,
    NEXT_APPWRITE_KEY: key,
    ...(messaging.providerId
      ? { NEXT_PUBLIC_APPWRITE_SMTP_PROVIDER_ID: messaging.providerId }
      : {}),
    ...(messaging.topicId ? { NEXT_PUBLIC_APPWRITE_EMAIL_TOPIC_ID: messaging.topicId } : {}),
  });
  await smokeTest(projectId, key);
  console.log("=== Done ===");
  console.log(`Console: ${SELFHOST_ENDPOINT.replace(/\/v1$/, "")}/console/project-${projectId}`);
  console.log("Users must sign in again. Email/password hashes come over; OAuth sessions do not.");
  console.log("Raise _APP_STORAGE_LIMIT on the instance if project-docs files are larger than 30MB.");
}

const command = process.argv[2] || "migrate";

async function main() {
  if (command === "inventory") {
    await inventoryCloud();
    return;
  }
  if (command === "migrate") {
    await migrate();
    return;
  }
  throw new Error(`Unknown command ${command}. Use inventory|migrate`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
