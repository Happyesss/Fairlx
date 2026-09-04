import "server-only";

import { redirect } from "next/navigation";
import type { Models } from "node-appwrite";

import { resolveUserLifecycleState } from "@/lib/identity-lifecycle";
import { createSessionClient } from "@/lib/appwrite";

/**
 * Organization membership is the source of truth — not prefs.accountType.
 * Prefs can stay PERSONAL after the user already owns or joined an org.
 */
export async function requireOrganizationMembership(
    user: Models.User<Models.Preferences>,
) {
    const { databases } = await createSessionClient();
    const lifecycle = await resolveUserLifecycleState(databases, user);
    if (!lifecycle.orgId) {
        redirect("/");
    }
    return lifecycle;
}
