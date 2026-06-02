"use client";

import React, { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAccountLifecycle } from "@/components/account-lifecycle-provider";
import { PUBLIC_ROUTES } from "@/features/auth/constants";
import { ForcePasswordReset } from "@/features/auth/components/force-password-reset";
import { LegalAcceptanceModal } from "@/features/auth/components/legal-acceptance-modal";

interface LifecycleGuardProps {
    children: React.ReactNode;
}

/**
 * LifecycleGuard - Authoritative route guard for account lifecycle.
 * 
 * MIGRATED: Now consumes server-side routing rules via `lifecycleRouting`.
 * The UI no longer guesses permissions; it strictly enforces what the server says.
 */
export function LifecycleGuard({ children }: LifecycleGuardProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { lifecycleState, lifecycleRouting, isLoaded, refreshLifecycle } = useAccountLifecycle();
    const redirectingRef = useRef(false);
    const lastPathnameRef = useRef(pathname);

    // Reset redirecting flag when pathname actually changes
    useEffect(() => {
        if (pathname !== lastPathnameRef.current) {
            redirectingRef.current = false;
            lastPathnameRef.current = pathname;
        }
    }, [pathname]);

    // Determine route type
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));

    useEffect(() => {
        // Skip if not loaded yet or already redirecting
        if (!isLoaded || redirectingRef.current) return;

        // Skip guards for public routes
        if (isPublicRoute) {
            // Special case: If user is authenticated and on sign-in/sign-up,
            // redirect them to their allowed home
            if (lifecycleState.isAuthenticated) {
                if (lifecycleRouting.redirectTo && lifecycleRouting.redirectTo !== pathname) {
                    redirectingRef.current = true;
                    router.push(lifecycleRouting.redirectTo);
                    return;
                }
            }
            return;
        }

        // Guard: If loaded and not authenticated, always redirect to sign-in
        if (!lifecycleState.isAuthenticated) {
            const returnUrl = encodeURIComponent(pathname);
            redirectingRef.current = true;
            router.push(`/sign-in?returnUrl=${returnUrl}`);
            return;
        }

        // 1. Force Redirect (Server Authority)
        // If server explicitly says "Go here" AND we aren't already there.
        // EXCEPTION: Allow access to any path in allowedPaths even if redirectTo is set.
        if (lifecycleRouting.redirectTo) {
            const targetPath = lifecycleRouting.redirectTo;
            const isAtTarget = pathname === targetPath || pathname.startsWith(targetPath + "/");
            
            // Check if current path is explicitly allowed despite the redirect target
            const isAllowed = lifecycleRouting.allowedPaths.some(allowed => {
                if (allowed === "*") return true;
                if (allowed.endsWith("/*")) {
                    const prefix = allowed.slice(0, -2);
                    return pathname.startsWith(prefix);
                }
                return pathname === allowed || pathname.startsWith(allowed + "/");
            });

            if (!isAtTarget && !isAllowed) {
                redirectingRef.current = true;
                router.push(targetPath);
                return;
            }
            // We're at the target or an allowed page - no further checks needed
            return;
        }

        // 2. Blocked Paths (Server Authority)
        // Check if current path is strictly blocked by server state
        const isBlocked = lifecycleRouting.blockedPaths.some(blocked => {
            if (blocked === "*") return true;
            if (blocked.endsWith("/*")) {
                const prefix = blocked.slice(0, -2);
                return pathname.startsWith(prefix);
            }
            return pathname === blocked || pathname.startsWith(blocked + "/");
        });

        if (isBlocked) {
            // Find a safe fallback - prefer redirectTo if set, else check allowedPaths
            let fallback = "/welcome";

            // Check if /welcome is blocked
            const welcomeBlocked = lifecycleRouting.blockedPaths.some(b =>
                b === "/welcome" || b === "*"
            );

            if (welcomeBlocked && lifecycleRouting.allowedPaths.length > 0) {
                // Find first allowed concrete path
                const firstAllowed = lifecycleRouting.allowedPaths.find(p =>
                    !p.includes("*") && !p.includes("?")
                );
                if (firstAllowed) {
                    fallback = firstAllowed;
                }
            }

            if (pathname !== fallback) {
                redirectingRef.current = true;
                router.push(fallback);
            }
            return;
        }

    }, [isLoaded, isPublicRoute, lifecycleState.isAuthenticated, lifecycleRouting, pathname, router]);

    // ZERO-FLASH: Show app-shell skeleton while state is loading
    if (!isLoaded) {
        return (
            <div className="flex min-h-screen bg-background">
                {/* Sidebar skeleton */}
                <div className="hidden lg:flex w-[264px] flex-col border-r border-border bg-card animate-pulse">
                    <div className="p-4 space-y-4">
                        <div className="h-8 w-24 bg-muted rounded-md" />
                        <div className="space-y-2 mt-6">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="h-7 bg-muted/60 rounded-md" />
                            ))}
                        </div>
                        <div className="h-px bg-border my-4" />
                        <div className="space-y-2">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="h-7 bg-muted/40 rounded-md" />
                            ))}
                        </div>
                    </div>
                </div>
                {/* Main content skeleton */}
                <div className="flex-1 animate-pulse p-6">
                    <div className="flex items-center justify-between mb-8">
                        <div className="h-7 w-48 bg-muted rounded-md" />
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 bg-muted rounded-full" />
                            <div className="h-8 w-8 bg-muted rounded-full" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="rounded-lg border border-border p-4">
                                <div className="h-3 w-20 bg-muted/60 rounded mb-3" />
                                <div className="h-6 w-16 bg-muted rounded" />
                            </div>
                        ))}
                    </div>
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-12 bg-muted/30 rounded-lg border border-border" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (lifecycleState.isAuthenticated && lifecycleState.mustResetPassword) {
        return <ForcePasswordReset onSuccess={() => refreshLifecycle()} />;
    }

    // Special Component Interception: Legal Acceptance
    // We render children behind the modal to avoid a "total roadblock" feeling
    if (lifecycleState.isAuthenticated && (lifecycleState.mustAcceptLegal || lifecycleState.legalBlocked)) {
        return (
            <>
                <div className="opacity-50 pointer-events-none grayscale-[0.5] blur-[2px]">
                    {children}
                </div>
                <LegalAcceptanceModal />
            </>
        );
    }

    // If redirecting, show same skeleton (prevents flash)
    if (redirectingRef.current) {
        return (
            <div className="flex min-h-screen bg-background">
                <div className="hidden lg:flex w-[264px] flex-col border-r border-border bg-card animate-pulse">
                    <div className="p-4 space-y-4">
                        <div className="h-8 w-24 bg-muted rounded-md" />
                        <div className="space-y-2 mt-6">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="h-7 bg-muted/60 rounded-md" />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex-1 animate-pulse p-6">
                    <div className="h-7 w-48 bg-muted rounded-md mb-8" />
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-12 bg-muted/30 rounded-lg border border-border" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // All guards passed - render children
    return <>{children}</>;
}
