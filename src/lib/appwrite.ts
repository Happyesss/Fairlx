import "server-only";

import { Client, Account, Users, Databases, Storage } from "node-appwrite";
import { cookies } from "next/headers";
import { getEnvVar, isAppwriteConfigured } from "@/lib/env-check";

import { AUTH_COOKIE } from "@/features/auth/constants";

export async function createSessionClient() {
  if (!isAppwriteConfigured()) {
    throw new Error("Appwrite configuration is incomplete");
  }

  const client = new Client()
    .setEndpoint(getEnvVar('NEXT_PUBLIC_APPWRITE_ENDPOINT'))
    .setProject(getEnvVar('NEXT_PUBLIC_APPWRITE_PROJECT'));

  const session = (await cookies()).get(AUTH_COOKIE);

  if (!session || !session.value) {
    throw new Error("Unauthorized");
  }

  client.setSession(session.value);

  return {
    get account() {
      return new Account(client);
    },
    get databases() {
      return new Databases(client);
    },
    get storage() {
      return new Storage(client);
    },
  };
}

export async function createAdminClient() {
  if (!isAppwriteConfigured()) {
    throw new Error("Appwrite configuration is incomplete");
  }

  const client = new Client()
    .setEndpoint(getEnvVar('NEXT_PUBLIC_APPWRITE_ENDPOINT'))
    .setProject(getEnvVar('NEXT_PUBLIC_APPWRITE_PROJECT'))
    .setKey(getEnvVar('NEXT_APPWRITE_KEY'));

  return {
    get account() {
      return new Account(client);
    },
    get users() {
      return new Users(client);
    },
    get databases() {
      return new Databases(client);
    },
    get storage() {
      return new Storage(client);
    },
  };
}
