"use client";

import React from "react";
import Link from "next/link";
import { useGetAccountLifecycle } from "@/features/auth/api/use-account-lifecycle";
import { TrialExpiredBanner } from "./_components/trial-expired-banner";
import { SuspendedBanner } from "./_components/suspended-banner";
import { AlertCircle } from "lucide-react";

export default function OrganizationBillingPage() {
    const { lifecycleRouting: lifecycle, isLoading } = useGetAccountLifecycle();

    if (isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    const isSuspended = lifecycle?.state === "SUSPENDED";
    const isTrialExpired = lifecycle?.isTrialExpired === true;

    return (
        <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-8">
            <div className="border-b pb-6">
                <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    Organization Access Locked
                </h1>
                <p className="mt-2 text-muted-foreground">
                    Your organization&apos;s access has been restricted. Please resolve the billing issue to restore access.
                </p>
            </div>

            <div className="mt-8">
                {isSuspended ? (
                    isTrialExpired ? (
                        <TrialExpiredBanner />
                    ) : (
                        <SuspendedBanner />
                    )
                ) : (
                    <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground shadow-sm">
                        Your organization is active and in good standing. 
                        <br />
                        <Link href="/organization/settings/billing" className="mt-4 inline-block text-primary hover:underline">
                            Go to Billing Settings
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
