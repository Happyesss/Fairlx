"use client";

import { useState } from "react";
import { Gift, Loader2, CheckCircle2, AlertCircle, Sparkles, Copy, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRedeemGithubReward } from "../api/useRedeemGithubReward";

type RedemptionState = "idle" | "loading" | "success" | "error";

interface RedemptionResult {
    creditedAmount: number;
    newWalletBalance: number;
    transactionId: string;
}

interface RedeemCouponCardProps {
    workspaceId: string;
    organizationId?: string;
}

export const RedeemCouponCard = ({ workspaceId, organizationId }: RedeemCouponCardProps) => {
    const [code, setCode] = useState("");
    const [state, setState] = useState<RedemptionState>("idle");
    const [result, setResult] = useState<RedemptionResult | null>(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [copied, setCopied] = useState(false);
    const { mutate, isPending } = useRedeemGithubReward();

    const handleRedeem = () => {
        const trimmed = code.trim().toUpperCase();
        if (!trimmed) return;

        setState("loading");
        setErrorMessage("");

        mutate(
            { json: { code: trimmed, workspaceId, organizationId } },
            {
                onSuccess: (data) => {
                    if ("creditedAmount" in data) {
                        setState("success");
                        setResult({
                            creditedAmount: data.creditedAmount,
                            newWalletBalance: data.newWalletBalance,
                            transactionId: data.transactionId,
                        });
                    }
                },
                onError: (error) => {
                    setState("error");
                    setErrorMessage(
                        error instanceof Error
                            ? error.message
                            : "Failed to redeem coupon. Please try again."
                    );
                },
            }
        );
    };

    const handleCopyTransactionId = () => {
        if (result?.transactionId) {
            navigator.clipboard.writeText(result.transactionId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleReset = () => {
        setCode("");
        setState("idle");
        setResult(null);
        setErrorMessage("");
    };

    return (
        <Card className="overflow-hidden">
            {/* Gradient header accent */}
            <div className="h-1 bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500" />

            <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400/20 to-orange-500/20">
                        <Gift className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">Redeem Reward Coupon</CardTitle>
                        <CardDescription>
                            Enter your GitHub Star Reward coupon code
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {/* Idle / Error State — Input Form */}
                {(state === "idle" || state === "error" || state === "loading") && (
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Input
                                id="coupon-code"
                                placeholder="FAIRLX-XXXXXXXX"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && code.trim()) handleRedeem();
                                }}
                                disabled={isPending}
                                className="font-mono text-sm tracking-wider uppercase"
                                maxLength={17}
                            />
                            <Button
                                onClick={handleRedeem}
                                disabled={!code.trim() || isPending}
                                className="shrink-0 gap-2"
                            >
                                {isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Redeeming...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-4 w-4" />
                                        Redeem
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Error message */}
                        {state === "error" && errorMessage && (
                            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700 dark:text-red-300">
                                    {errorMessage}
                                </p>
                            </div>
                        )}

                        {/* Hint */}
                        <p className="text-xs text-muted-foreground">
                            Get a coupon by starring our{" "}
                            <a
                                href="https://fairlx.com/star-reward"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                            >
                                GitHub repository
                            </a>
                            .
                        </p>
                    </div>
                )}

                {/* Success State */}
                {state === "success" && result && (
                    <div className="space-y-4">
                        <div className="flex flex-col items-center text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800 rounded-xl">
                            <div className="flex items-center justify-center w-12 h-12 bg-green-500 rounded-full mb-3">
                                <CheckCircle2 className="h-6 w-6 text-white" />
                            </div>
                            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-1">
                                Coupon Redeemed!
                            </h3>
                            <p className="text-sm text-green-600 dark:text-green-400 mb-4">
                                ${result.creditedAmount.toFixed(6)} has been credited to your wallet
                            </p>

                            <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                                <div className="text-center p-3 bg-white/60 dark:bg-gray-900/40 rounded-lg">
                                    <p className="text-xs text-muted-foreground mb-1">Credited</p>
                                    <p className="text-lg font-bold text-green-600">
                                        ${result.creditedAmount.toFixed(6)}
                                    </p>
                                </div>
                                <div className="text-center p-3 bg-white/60 dark:bg-gray-900/40 rounded-lg">
                                    <p className="text-xs text-muted-foreground mb-1">Balance</p>
                                    <p className="text-lg font-bold text-foreground">
                                        ${result.newWalletBalance.toFixed(6)}
                                    </p>
                                </div>
                            </div>

                            {/* Transaction ID */}
                            {result.transactionId && result.transactionId !== "already_processed" && (
                                <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                                    <span>Transaction: {result.transactionId.slice(0, 12)}...</span>
                                    <button
                                        onClick={handleCopyTransactionId}
                                        className="p-1 hover:bg-muted rounded transition-colors"
                                    >
                                        {copied ? (
                                            <Check className="h-3 w-3 text-green-500" />
                                        ) : (
                                            <Copy className="h-3 w-3" />
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>

                        <Button
                            variant="outline"
                            onClick={handleReset}
                            className="w-full"
                        >
                            Redeem Another Coupon
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
