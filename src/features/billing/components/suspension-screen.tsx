"use client";

import { AlertCircle, Wallet, Mail, Phone, ExternalLink, Eye, Download } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SuspensionScreenProps {
    organizationId?: string;
    organizationName?: string;
    invoiceAmount?: number;
    currency?: string;
    invoiceId?: string;
    gracePeriodExpiredAt?: string;
    suspendedAt?: string;
}

/**
 * Suspension Screen
 * 
 * Full-screen overlay displayed when account is suspended.
 * Shows clear recovery instructions and explains read-only behavior.
 * 
 * CRITICAL: This blocks all other UI and forces user to billing page.
 */
export function SuspensionScreen({
    organizationId,
    organizationName,
    invoiceAmount,
    currency = "USD",
    invoiceId,
    gracePeriodExpiredAt,
    suspendedAt,
}: SuspensionScreenProps) {
    const billingUrl = organizationId
        ? `/organization/settings/billing`
        : "/settings/billing";

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short",
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
            <div className="w-full max-w-2xl px-4">
                <Card className="border-red-200 dark:border-red-900 shadow-2xl">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 p-4">
                            <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
                        </div>
                        <CardTitle className="text-2xl text-red-700 dark:text-red-400">
                            Account Suspended
                        </CardTitle>
                        <CardDescription className="text-lg">
                            {organizationName ? (
                                <>Your organization <strong>{organizationName}</strong> has been suspended</>
                            ) : (
                                <>Your account has been suspended</>
                            )} due to an unpaid invoice.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Invoice Details */}
                        {invoiceAmount !== undefined && (
                            <div className="rounded-lg border bg-muted/50 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                                        <p className="text-2xl font-bold">{formatAmount(invoiceAmount)}</p>
                                        {invoiceId && (
                                            <p className="text-xs text-muted-foreground">Invoice: {invoiceId}</p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        {suspendedAt ? (
                                            <>
                                                <p className="text-sm text-muted-foreground">Suspended on</p>
                                                <p className="text-sm font-medium">{formatDate(suspendedAt)}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDateTime(suspendedAt)}
                                                </p>
                                            </>
                                        ) : gracePeriodExpiredAt && (
                                            <>
                                                <p className="text-sm text-muted-foreground">Grace period ended</p>
                                                <p className="text-sm font-medium">{formatDate(gracePeriodExpiredAt)}</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Read-Only Mode Explanation */}
                        <div className="space-y-3">
                            <h3 className="font-semibold">Read-Only Mode Active</h3>
                            <p className="text-sm text-muted-foreground">
                                Your account is in read-only mode. You can view all existing data,
                                but write operations are temporarily blocked until payment is received.
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                                        Blocked Actions
                                    </p>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                        <li className="flex items-center gap-2">
                                            <span className="text-red-500">✗</span>
                                            Create or update items
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="text-red-500">✗</span>
                                            Upload files
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="text-red-500">✗</span>
                                            Invite members
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="text-red-500">✗</span>
                                            API write access
                                        </li>
                                    </ul>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                                        Still Available
                                    </p>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                        <li className="flex items-center gap-2">
                                            <Eye className="h-3 w-3 text-green-500" />
                                            View all data
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Download className="h-3 w-3 text-green-500" />
                                            Export data
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Wallet className="h-3 w-3 text-green-500" />
                                            Add credits
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Mail className="h-3 w-3 text-green-500" />
                                            Contact support
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Data Safety Notice */}
                        <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-4">
                            <p className="text-sm text-green-700 dark:text-green-400">
                                <strong>Your data is safe.</strong> All your projects, tasks, and files are preserved.
                                Once you add credits to your wallet and pay the outstanding balance, full access will be restored immediately.
                            </p>
                        </div>

                        {/* Recovery Actions */}
                        <div className="flex flex-col gap-3">
                            <Button asChild size="lg" className="w-full">
                                <Link href={billingUrl}>
                                    <Wallet className="mr-2 h-5 w-5" />
                                    Add Credits to Wallet
                                </Link>
                            </Button>

                            <div className="flex gap-3">
                                <Button asChild variant="outline" size="sm" className="flex-1">
                                    <a href="mailto:support@fairlx.com">
                                        <Mail className="mr-2 h-4 w-4" />
                                        Contact Support
                                    </a>
                                </Button>
                                <Button asChild variant="outline" size="sm" className="flex-1">
                                    <a href="tel:+1-800-FAIRLX">
                                        <Phone className="mr-2 h-4 w-4" />
                                        Call Us
                                    </a>
                                </Button>
                            </div>
                        </div>

                        {/* View Invoices Link */}
                        <div className="text-center">
                            <Button asChild variant="ghost" size="sm">
                                <Link href={`${billingUrl}?tab=invoices`}>
                                    <ExternalLink className="mr-2 h-3 w-3" />
                                    View All Invoices
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

