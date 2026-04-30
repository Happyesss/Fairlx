import React from "react";
import { CreditCard, AlertCircle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

export const TrialExpiredBanner = () => {
    return (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-6 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/20">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                    <div className="rounded-full bg-rose-100 p-3 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400">
                        <AlertCircle className="h-6 w-6" />
                    </div>
                    <div className="space-y-1.5">
                        <h2 className="text-xl font-semibold text-rose-900 dark:text-rose-200">
                            Your trial has expired
                        </h2>
                        <p className="text-sm text-rose-700 dark:text-rose-300">
                            Your welcome trial period has ended. To restore access to your organization&apos;s workspaces and features, you need to add a payment method and top up your wallet.
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-sm font-medium text-rose-800 dark:text-rose-200">
                            <Calendar className="h-4 w-4" />
                            <span>Expired on {format(new Date(), "MMM d, yyyy")}</span>
                        </div>
                    </div>
                </div>
                <div className="flex shrink-0 flex-col gap-3 md:items-end">
                    <Button 
                        size="lg" 
                        className="bg-rose-600 text-white hover:bg-rose-700 w-full md:w-auto"
                        onClick={() => window.location.href = "/organization/settings/billing"}
                    >
                        <CreditCard className="mr-2 h-4 w-4" />
                        Top up Wallet
                    </Button>
                </div>
            </div>
        </div>
    );
};
