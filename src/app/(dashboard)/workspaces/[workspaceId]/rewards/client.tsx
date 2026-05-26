"use client";

import { useRouter, useParams } from "next/navigation";
import { Gift, Star, ExternalLink, Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RedeemCouponCard } from "@/features/github-rewards/components/RedeemCouponCard";

import { useAccountType } from "@/features/organizations/hooks/use-account-type";

export const RewardsPageClient = () => {
    const router = useRouter();
    const params = useParams();
    const workspaceId = params.workspaceId as string;
    const { isOrg } = useAccountType();

    if (isOrg) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8">
                <div className="p-4 rounded-full bg-orange-100 dark:bg-orange-950/20">
                    <Gift className="size-12 text-orange-600" />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-xl font-semibold">Organization Rewards</h2>
                    <p className="text-muted-foreground text-sm max-w-md">
                        For organization accounts, rewards are managed at the organization level.
                        Redeem coupons to credit your organization&apos;s shared wallet.
                    </p>
                </div>
                <Button
                    size="lg"
                    className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={() => router.push("/organization#rewards")}
                >
                    <Building2 className="size-4" />
                    Go to Organization Rewards
                </Button>
                <p className="text-xs text-muted-foreground">
                    You can also find this under <b>Organization Settings &gt; Rewards</b>
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 max-w-3xl">
            {/* Header ... */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-bold">Rewards</h1>
                    <p className="text-muted-foreground">
                        Redeem reward coupons and earn free credits
                    </p>
                </div>
                <Badge variant="secondary" className="gap-1.5">
                    <Gift className="h-3 w-3" />
                    Rewards
                </Badge>
            </div>
            <Separator />

            {/* Redeem Coupon Card */}
            <RedeemCouponCard
                workspaceId={workspaceId}
                organizationId={undefined} // Personal account uses personal wallet (no orgId)
            />

            {/* How to Get a Coupon ... rest of the content */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-500" />
                        How to Get a Coupon
                    </CardTitle>
                    <CardDescription>
                        Earn free credits by supporting Fairlx on GitHub
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                                1
                            </div>
                            <div>
                                <p className="text-sm font-medium">Visit the Star Reward page</p>
                                <p className="text-xs text-muted-foreground">
                                    Go to our landing page and start the reward flow
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                                2
                            </div>
                            <div>
                                <p className="text-sm font-medium">Connect GitHub & star the repo</p>
                                <p className="text-xs text-muted-foreground">
                                    Authenticate with GitHub and star our repository
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                                3
                            </div>
                            <div>
                                <p className="text-sm font-medium">Get your coupon & redeem here</p>
                                <p className="text-xs text-muted-foreground">
                                    Receive a FAIRLX-XXXXXXXX code and paste it above
                                </p>
                            </div>
                        </div>

                        <a
                            href="https://fairlx.com/star-reward"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Button variant="outline" className="w-full mt-2 gap-2">
                                <Star className="h-4 w-4" />
                                Get Your Coupon
                                <ExternalLink className="h-3 w-3" />
                            </Button>
                        </a>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
