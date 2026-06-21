"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, ArrowRight, Check, Loader2 } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { client } from "@/lib/rpc";
import { cn } from "@/lib/utils";
import { useAccountLifecycle } from "@/components/account-lifecycle-provider";
import { useGetOrganization } from "@/features/organizations/api/use-get-organization";

const passwordSchema = z.object({
    newPassword: z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

interface ForcePasswordResetProps {
    onSuccess?: () => void;
}

/**
 * Force Password Reset Screen
 * 
 * ENTERPRISE ONBOARDING DESIGN:
 * Shown to ORG members on first login when mustResetPassword === true.
 * User cannot navigate away until password is reset.
 * 
 * Design aligned with onboarding screens for consistency:
 * - Fairlx branding
 * - Organization logo and name
 * - Welcoming messaging
 * - Light gradient background
 * - Clear visual hierarchy
 */
export function ForcePasswordReset({ onSuccess }: ForcePasswordResetProps) {
    const queryClient = useQueryClient();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const passwordInputRef = useRef<HTMLInputElement>(null);

    // Get organization context - prefer lifecycle state, fallback to API query
    const { lifecycleState } = useAccountLifecycle();

    // Only fetch via API if lifecycle doesn't have the org name (shouldn't happen normally)
    const { data: organization } = useGetOrganization({
        orgId: (!lifecycleState.activeOrgName && lifecycleState.activeOrgId) ? lifecycleState.activeOrgId : ""
    });

    // Autofocus on first password field
    useEffect(() => {
        passwordInputRef.current?.focus();
    }, []);

    const form = useForm<PasswordFormValues>({
        resolver: zodResolver(passwordSchema),
        defaultValues: {
            newPassword: "",
            confirmPassword: "",
        },
    });

    const password = form.watch("newPassword");

    // Password strength indicators
    const passwordChecks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
    };

    const mutation = useMutation({
        mutationFn: async (values: PasswordFormValues) => {
            const response = await client.api.auth["reset-password-first-login"].$post({
                json: { newPassword: values.newPassword },
            });

            if (!response.ok) {
                const errorData = await response.json() as { error?: string };
                throw new Error(errorData.error || "Failed to set password");
            }

            return await response.json();
        },
        onSuccess: async () => {
            toast.success("You're all set! Welcome to Fairlx.");
            // Invalidate and refetch lifecycle to ensure guard sees fresh state immediately
            await queryClient.invalidateQueries({ queryKey: ["account-lifecycle"] });
            await queryClient.refetchQueries({
                queryKey: ["account-lifecycle"],
                type: "active",
            });
            onSuccess?.();
        },
        onError: (error) => {
            toast.error(error.message || "Failed to set password");
        },
    });

    const onSubmit = (values: PasswordFormValues) => {
        mutation.mutate(values);
    };

    // Get org name and initial for avatar fallback
    // Prefer lifecycle state, fallback to API response
    const orgName = lifecycleState.activeOrgName || organization?.name || "Your Organization";
    const orgInitial = orgName.charAt(0).toUpperCase();
    const orgImageUrl = lifecycleState.activeOrgImageUrl || organization?.imageUrl;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
            {/* Fairlx Logo */}
            <div className="mb-6">
                <Image
                    src="/Logo.png"
                    alt="Fairlx"
                    width={56}
                    height={44}
                    priority
                    className="drop-shadow-sm"
                />
            </div>

            <Card className="w-full max-w-lg shadow-lg">
                <CardHeader className="text-center pb-2">
                    {/* Organization Avatar */}
                    <div className="mx-auto mb-4">
                        <Avatar className="h-16 w-16 border-2 border-primary/20 shadow-md">
                            {orgImageUrl ? (
                                <AvatarImage src={orgImageUrl} alt={orgName} />
                            ) : null}
                            <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                                {orgInitial}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                    <CardTitle className="text-2xl font-bold">Welcome to {orgName}! 👋</CardTitle>
                    <CardDescription className="text-base mt-2">
                        You&apos;ve been invited to join <span className="font-medium text-foreground">{orgName}</span> on Fairlx.
                        Set a secure password to complete your account setup.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <FormField
                                control={form.control}
                                name="newPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Create Password</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Enter a secure password"
                                                    className="pr-10"
                                                    disabled={mutation.isPending}
                                                    {...field}
                                                    ref={(e) => {
                                                        field.ref(e);
                                                        (passwordInputRef as React.MutableRefObject<HTMLInputElement | null>).current = e;
                                                    }}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    tabIndex={-1}
                                                >
                                                    {showPassword ? (
                                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                    ) : (
                                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </Button>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Confirm Password</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input
                                                    type={showConfirmPassword ? "text" : "password"}
                                                    placeholder="Confirm your password"
                                                    className="pr-10"
                                                    disabled={mutation.isPending}
                                                    {...field}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    tabIndex={-1}
                                                >
                                                    {showConfirmPassword ? (
                                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                    ) : (
                                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </Button>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Password Requirements Checklist */}
                            <div className="rounded-xl bg-muted/50 p-4 text-sm">
                                <p className="font-medium text-foreground mb-3">Password Requirements</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <PasswordCheck
                                        met={passwordChecks.length}
                                        label="8+ characters"
                                    />
                                    <PasswordCheck
                                        met={passwordChecks.uppercase}
                                        label="Uppercase letter"
                                    />
                                    <PasswordCheck
                                        met={passwordChecks.lowercase}
                                        label="Lowercase letter"
                                    />
                                    <PasswordCheck
                                        met={passwordChecks.number}
                                        label="Number"
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full mt-6"
                                size="lg"
                                disabled={mutation.isPending}
                            >
                                {mutation.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Setting up your account...
                                    </>
                                ) : (
                                    <>
                                        Continue to Fairlx
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {/* Footer */}
            <footer className="mt-6 text-center text-xs text-muted-foreground">
                Need help? Contact{" "}
                <a
                    href="mailto:contact@fairlx.com"
                    className="underline hover:text-foreground transition-colors"
                >
                    contact@fairlx.com
                </a>
            </footer>
        </div>
    );
}

/**
 * Password requirement check item with visual indicator
 */
function PasswordCheck({ met, label }: { met: boolean; label: string }) {
    return (
        <div className={cn(
            "flex items-center gap-2 text-sm transition-colors",
            met ? "text-emerald-600" : "text-muted-foreground"
        )}>
            <div className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full transition-colors",
                met ? "bg-emerald-500 text-white" : "bg-muted-foreground/20"
            )}>
                {met && <Check className="h-3 w-3" />}
            </div>
            <span>{label}</span>
        </div>
    );
}
