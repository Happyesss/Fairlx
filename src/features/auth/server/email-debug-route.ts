import "server-only";
import { Hono } from "hono";
import { ID, Models } from "node-appwrite";
import { createAdminClient } from "@/lib/appwrite";

export const emailDebugApp = new Hono()
  .post("/", async (c) => {

    // Auth Check
    const authHeader = c.req.header("Authorization");
    const isDevelopment = process.env.NODE_ENV === "development";

    const verifySecret = (header: string | undefined): boolean => {
      const secretValue = process.env.CRON_SECRET;
      if (!secretValue) {
        return isDevelopment;
      }
      if (!header) return false;
      const secret = header.startsWith("Bearer ") ? header.substring(7) : header;
      return secret === secretValue;
    };

    if (!verifySecret(authHeader)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const timestamp = new Date().toISOString();
    
    interface EnvVarCheck {
      key: string;
      set: boolean;
      unused_in_code?: boolean;
    }

    interface MessagingProviderInfo {
      id: string;
      name: string;
      provider: string;
      enabled: boolean;
      isDefault: boolean;
    }

    interface UserTargetInfo {
      id: string;
      providerType: string;
      identifier: string;
      name: string;
      isEmailIdentifier?: boolean;
    }

    interface DiagnosticReport {
      envVars?: EnvVarCheck[];
      adminClient: { ok: boolean; error?: string };
      messagingProviders: { 
        ok?: boolean; 
        skipped?: boolean; 
        reason?: string; 
        error?: string;
        providers?: MessagingProviderInfo[];
      };
      userTarget: { 
        skipped?: boolean; 
        ok?: boolean; 
        error?: string;
        hasEmailTarget?: boolean;
        targets?: UserTargetInfo[];
      };
      sendTest: {
        skipped?: boolean;
        sent?: boolean;
        messageId?: string;
        error?: string;
        errorType?: string;
        errorCode?: number;
      };
    }

    const checks: DiagnosticReport = {
      adminClient: { ok: false },
      messagingProviders: {},
      userTarget: {},
      sendTest: {},
    };

    // CHECK 1 — ENV VARS
    const envVarNames = [
      "NEXT_PUBLIC_APPWRITE_ENDPOINT",
      "NEXT_PUBLIC_APPWRITE_PROJECT",
      "NEXT_APPWRITE_KEY",
      "NEXT_PUBLIC_APPWRITE_SMTP_PROVIDER_ID",
      "NEXT_PUBLIC_APPWRITE_EMAIL_TOPIC_ID",
    ];

    const unusedInCode = [
      "NEXT_PUBLIC_APPWRITE_EMAIL_TOPIC_ID",
    ];

    checks.envVars = envVarNames.map((name) => ({
      key: name,
      set: !!process.env[name] && process.env[name] !== "",
      ...(unusedInCode.includes(name) ? { unused_in_code: true } : {}),
    }));

    const isMissingEnv = (checks.envVars || []).some((v) => !v.set);

    // CHECK 2 — APPWRITE ADMIN CLIENT
    let admin: Awaited<ReturnType<typeof createAdminClient>> | null = null;
    try {
      admin = await createAdminClient();
      await admin.databases.list();
      checks.adminClient = { ok: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      checks.adminClient = { ok: false, error: message };
    }

    // CHECK 3 — MESSAGING PROVIDERS
    if (checks.adminClient.ok && admin) {
      try {
        const providersResponse = await admin.messaging.listProviders();
        if (providersResponse.total === 0) {
          checks.messagingProviders = { ok: false, reason: "no_providers_configured" };
        } else {
          checks.messagingProviders = {
            ok: true,
            providers: (providersResponse.providers as unknown as (Models.Provider & { [key: string]: unknown })[]).map((p) => ({
              id: String(p.$id),
              name: String(p.name),
              provider: String(p.provider),
              enabled: Boolean(p.enabled),
              isDefault: Boolean(p.default),
            })),
          };
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        checks.messagingProviders = { ok: false, error: message };
      }
    } else {
      checks.messagingProviders = { skipped: true };
    }

    // CHECK 4 — USER TARGET CHECK
    const userId = c.req.query("userId");
    if (userId && checks.adminClient.ok && admin) {
      try {
        const targetsResponse = await admin.users.listTargets(userId);
        const targets: UserTargetInfo[] = (targetsResponse.targets as unknown as (Models.Target & { [key: string]: unknown })[]).map((t) => {
          const identifier = String(t.identifier);
          const providerType = String(t.providerType);
          const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
          return {
            id: String(t.$id),
            providerType: providerType,
            identifier: identifier,
            name: String(t.name),
            ...(isEmail && providerType === "email" ? { isEmailIdentifier: true } : {}),
          };
        });

        const hasEmailTarget = targets.some((t) => t.providerType === "email");
        if (hasEmailTarget) {
          checks.userTarget = { targets };
        } else {
           checks.userTarget = { hasEmailTarget: false };
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        checks.userTarget = { ok: false, error: message };
      }
    } else {
      checks.userTarget = { skipped: true };
    }

    // CHECK 5 — SEND TEST EMAIL
    const testEmail = c.req.query("testEmail");
    const testUserId = c.req.query("testUserId");
    if (testEmail && testUserId && checks.adminClient.ok && admin) {
      try {
        const message = await admin.messaging.createEmail(
          ID.unique(),
          "Fairlx Email Diagnostic Test",
          "<p>This is a test email from the Fairlx diagnostic endpoint.</p>",
          [], // topics
          [testUserId], // users
          [], // targets
          [], // cc
          [], // bcc
          [], // attachments
          false, // draft
          true // html
        );
        checks.sendTest = { sent: true, messageId: message.$id };
      } catch (error: unknown) {
        const err = error as { message?: string; type?: string; code?: number };
        checks.sendTest = {
          sent: false,
          error: err.message || "Unknown error",
          errorType: err.type,
          errorCode: err.code,
        };
      }
    } else {
      checks.sendTest = { skipped: true };
    }

    // Diagnosis & Recommendation Logic
    let diagnosis = "UNKNOWN";
    let recommendation = "An unknown error occurred during diagnostics.";

    if (isMissingEnv) {
      diagnosis = "ENV_MISSING";
      recommendation = "One or more required environment variables are missing. Check your .env file.";
    } else if (!checks.adminClient.ok) {
      diagnosis = "CREDENTIALS_INVALID";
      recommendation = "The Appwrite admin client failed. Verify NEXT_APPWRITE_KEY, NEXT_PUBLIC_APPWRITE_PROJECT, and NEXT_PUBLIC_APPWRITE_ENDPOINT.";
    } else if (checks.messagingProviders?.reason === "no_providers_configured") {
      diagnosis = "SMTP_NOT_CONFIGURED";
      recommendation = "No messaging providers are configured in Appwrite. Go to Messaging > Providers and add an SMTP or SendGrid provider.";
    } else if (
      checks.messagingProviders?.ok &&
      checks.messagingProviders.providers &&
      checks.messagingProviders.providers.length > 0 &&
      checks.messagingProviders.providers.every((p) => !p.enabled)
    ) {
      diagnosis = "PROVIDER_DISABLED";
      recommendation = "All configured messaging providers are disabled. Please enable at least one in the Appwrite Console.";
    } else if (userId && checks.userTarget?.hasEmailTarget === false) {
      diagnosis = "USER_TARGET_MISSING";
      recommendation = "The user has no email target configured. Ensure the user has an email address and it is verified.";
    } else if (checks.adminClient.ok && checks.messagingProviders?.ok) {
      diagnosis = "LIKELY_OK";
      recommendation = "All foundational checks passed. If emails still fail, verify the provider credentials (SMTP user/pass) inside Appwrite.";
    }

    return c.json({
      timestamp,
      checks,
      diagnosis,
      recommendation,
    });
  });

