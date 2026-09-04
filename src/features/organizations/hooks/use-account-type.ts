"use client";

import { useCurrent } from "@/features/auth/api/use-current";
import { useAccountLifecycle } from "@/components/account-lifecycle-provider";
import { AccountType } from "../types";

/**
 * Account type for UI.
 *
 * Membership / lifecycle wins over prefs.accountType. Prefs can stay
 * PERSONAL after the user already owns or joined an organization.
 */
export const useAccountType = () => {
    const { data: user, isLoading: isUserLoading } = useCurrent();
    const { lifecycleState, isLoaded } = useAccountLifecycle();

    const prefs = user?.prefs || {};
    const accountType = (lifecycleState.accountType as AccountType | null)
        || (prefs.accountType as AccountType | undefined)
        || AccountType.PERSONAL;
    const primaryOrganizationId =
        lifecycleState.activeOrgId
        || (prefs.primaryOrganizationId as string | undefined)
        || undefined;
    const signupCompletedAt = prefs.signupCompletedAt as string | undefined;
    const isLoading = isUserLoading || !isLoaded;
    const isOrg = Boolean(
        lifecycleState.hasOrg || accountType === AccountType.ORG,
    );

    return {
        accountType,
        isPersonal: !isOrg,
        isOrg,
        primaryOrganizationId,
        signupCompleted: !!signupCompletedAt,
        isLoading,
    };
};
