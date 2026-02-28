import "server-only";

import {
  Account,
  Client,
  Databases,
  Models,
  Storage,
  Messaging,
  type Account as AccountType,
  type Databases as DatabasesType,
  type Storage as StorageType,
  type Users as UsersType,
  type Messaging as MessagingType,
} from "node-appwrite";

import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { Context } from "hono";

import { AUTH_COOKIE } from "@/features/auth/constants";

type AdditionalContext = {
  Variables: {
    account: AccountType;
    databases: DatabasesType;
    storage: StorageType;
    users: UsersType;
    messaging: MessagingType;
    user: Models.User<Models.Preferences>;
  };
};

export const sessionMiddleware = createMiddleware<AdditionalContext>(
  async (c, next) => {
    try {
      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!);

      const session = getCookie(c, AUTH_COOKIE);

      if (!session) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      client.setSession(session);

      const account = new Account(client);
      const databases = new Databases(client);
      const storage = new Storage(client);
      const messaging = new Messaging(client);

      const user = await account.get();

      c.set("account", account);
      c.set("databases", databases);
      c.set("storage", storage);
      c.set("messaging", messaging);
      c.set("user", user);

      await next();
    } catch (error: unknown) {
      // Only return 401 for authentication errors
      // Check error code only - avoid false positives from message text matching
      const isAuthError = (error as { code?: number })?.code === 401;
      if (isAuthError) {
        return c.json({ error: "Session expired or invalid" }, 401);
      }

      // Re-throw other errors (like database or Razorpay errors) so they can be handled by the route or global error handler
      throw error;
    }
  }
);

/**
 * Get the current session user from the middleware context.
 * This avoids duplicating client setup logic from sessionMiddleware.
 * 
 * @param c - Hono context (must have passed through sessionMiddleware)
 * @returns The user object if authenticated, or null
 */
export function getSessionUser(c: Context): Models.User<Models.Preferences> | null {
  try {
    // Derive user from middleware context instead of recreating client
    return c.get("user") ?? null;
  } catch {
    return null;
  }
}
