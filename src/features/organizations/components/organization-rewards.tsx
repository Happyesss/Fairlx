"use client";

import { Gift, Star, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RedeemCouponCard } from "@/features/github-rewards/components/RedeemCouponCard";

interface OrganizationRewardsProps {
    organizationId: string;
}

const STEPS = [
    {
        title: "Visit the Star Reward page",
        description: "Go to our landing page and start the reward flow",
    },
    {
        title: "Connect GitHub & star the repo",
        description: "Authenticate with GitHub and star our repository",
    },
    {
        title: "Get your coupon & redeem here",
        description: "Receive a FAIRLX-XXXXXXXX code and paste it above",
    },
];

export const OrganizationRewards = ({ organizationId }: OrganizationRewardsProps) => {
    return (
        <div className="flex flex-col gap-8 w-full ">
            {/* Hero banner */}
            <div className="relative overflow-hidden rounded-xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-transparent p-6">
                <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-pink-500/10 blur-2xl" />
                <div className="relative flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/10">
                        <Gift className="h-5 w-5 text-pink-600" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-[18px] font-semibold">Organization Rewards</h2>
                            <Badge variant="secondary" className="gap-1 bg-pink-100 text-pink-700 border-pink-200 text-xs">
                                <Sparkles className="h-2.5 w-2.5" />
                                Earn Credits
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Redeem reward coupons to add free credits to your organization wallet.
                        </p>
                    </div>
                </div>
            </div>

            {/* Redeem Coupon Card */}
            <RedeemCouponCard
                workspaceId="organization-scope"
                organizationId={organizationId}
            />

            {/* How to earn */}
            <div>
                <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    How to earn coupons
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                    Earn free credits by supporting Fairlx on GitHub
                </p>

                <div className="divide-y divide-border">
                    {STEPS.map((step, i) => (
                        <div key={i} className="flex items-start gap-4 py-4">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                                {i + 1}
                            </div>
                            <div>
                                <p className="text-sm font-medium">{step.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <a
                    href="https://fairlx.com/star-reward"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <Button variant="outline" size="sm" className="mt-2 gap-2 text-xs">
                        <Star className="h-3.5 w-3.5 text-yellow-500" />
                        Get Your Coupon
                        <ExternalLink className="h-3 w-3" />
                    </Button>
                </a>
            </div>
        </div>
    );
};
