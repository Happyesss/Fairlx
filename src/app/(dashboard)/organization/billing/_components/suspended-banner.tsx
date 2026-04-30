import React from "react";
import { AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

export const SuspendedBanner = () => {
    return (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 shadow-sm">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                    <div className="rounded-full bg-destructive/20 p-3 text-destructive">
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div className="space-y-1.5">
                        <h2 className="text-xl font-semibold text-foreground">
                            Organization Suspended
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Your organization has been suspended due to an insufficient wallet balance or failed payments. To restore access to your workspaces, please top up your wallet.
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 flex-col gap-3 md:items-end">
                    <Button 
                        size="lg" 
                        variant="destructive"
                        className="w-full md:w-auto"
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
