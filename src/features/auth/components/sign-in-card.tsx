"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa6";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { signUpWithGithub, signUpWithGoogle } from "@/lib/oauth";

import { loginSchema } from "../schemas";
import { useLogin } from "../api/use-login";
import { TwoFactorChallengeCard } from "@/features/twoFactorAuth/components/two-factor-challenge-card";
import { TwoFactorMethod } from "@/features/twoFactorAuth/server/types";
import { useBYOBTenant } from "@/features/byob/api/use-byob-tenant";

interface SignInCardProps {
  returnUrl?: string;
  /**
   * When provided, the card is rendered in BYOB context.
   * - "Sign Up" link points to /{byobOrgSlug}/sign-up
   * - OAuth buttons are hidden (BYOB uses email/password only)
   * - "Sign in with your organisation" section is hidden
   */
  byobOrgSlug?: string;
}

export const SignInCard = ({ returnUrl, byobOrgSlug }: SignInCardProps) => {
  const [twoFactorData, setTwoFactorData] = useState<{
    tempToken: string;
    method: TwoFactorMethod;
    methods: TwoFactorMethod[];
    email: string;
  } | null>(null);

  const { mutate, isPending } = useLogin(returnUrl);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    mutate({ json: values }, {
      onSuccess: (data) => {
        if ("state" in data && data.state === "REQUIRE_2FA") {
          setTwoFactorData({
            tempToken: data.tempToken as string,
            method: data.method as TwoFactorMethod,
            methods: data.methods as TwoFactorMethod[],
            email: values.email,
          });
        }
      },
    });
  };

  if (twoFactorData) {
    return (
      <TwoFactorChallengeCard
        tempToken={twoFactorData.tempToken}
        method={twoFactorData.method}
        methods={twoFactorData.methods}
        email={twoFactorData.email}
        onCancel={() => setTwoFactorData(null)}
      />
    );
  }

  // Sign-up footer
  const signUpHref = byobOrgSlug
    ? `/${byobOrgSlug}/sign-up`
    : returnUrl
      ? `/sign-up?returnUrl=${encodeURIComponent(returnUrl)}`
      : "/sign-up";

  return (
    <div className="w-full py-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-1 text-2xl font-bold leading-[1.3] tracking-tight text-[#1c65ee] md:text-[1.75rem]">Manage your projects.</h1>
        <p className="text-base leading-relaxed text-muted-foreground">Welcome back to Fairlx.</p>
      </div>

      {/* OAuth Buttons — hidden in BYOB context */}
      {!byobOrgSlug && (
        <div className="mb-3 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => signUpWithGoogle(returnUrl)}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium leading-5 text-foreground transition-all duration-200 hover:border-muted-foreground/30 hover:bg-accent active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FcGoogle className="h-4 w-4 shrink-0" />
            <span>Sign in with Google</span>
          </button>
          <button
            type="button"
            onClick={() => signUpWithGithub(returnUrl)}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium leading-5 text-foreground transition-all duration-200 hover:border-muted-foreground/30 hover:bg-accent active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FaGithub className="h-4 w-4 shrink-0" />
            <span>Sign in with GitHub</span>
          </button>
        </div>
      )}

      {/* "Sign in with your organisation" — hidden in BYOB context */}
      {!byobOrgSlug && (
        <OrgSignInSection />
      )}

      {/* Divider */}
      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="select-none text-xs lowercase text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Email / Password Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField
            name="email"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <label className="mb-1.5 block text-[0.8125rem] font-medium text-foreground">Email</label>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="name@company.com"
                    className="h-11 w-full rounded-lg border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:ring-offset-0"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="password"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <label className="mb-1.5 block text-[0.8125rem] font-medium text-foreground">Password</label>
                <FormControl>
                  <PasswordInput
                    placeholder="Enter password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <button
            type="submit"
            disabled={isPending}
            className="mt-1 flex w-full items-center justify-center rounded-lg bg-[#2663ec] px-4 py-3 text-sm font-semibold text-primary-foreground transition-all duration-200 enabled:hover:-translate-y-px enabled:hover:opacity-90 enabled:hover:shadow-[0_4px_12px_hsl(var(--primary)/0.3)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Continue"
            )}
          </button>
        </form>
      </Form>

      {/* Forgot Password */}
      <div className="mt-3">
        <Link href="/forgot-password" className="text-[0.8125rem] text-primary underline-offset-2 hover:underline">
          Forgot your password?
        </Link>
      </div>

      {/* Terms footer */}
      <p className="mt-7 text-center text-xs leading-relaxed text-muted-foreground">
        By signing in, you understand and agree to our{" "}
        <Link href="https://fairlx.com/terms" target="_blank" rel="noopener noreferrer" className="text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="https://fairlx.com/privacy" target="_blank" rel="noopener noreferrer" className="text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground">
          Privacy Policy
        </Link>
        .
      </p>

      {/* Sign up link */}
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href={signUpHref} className="font-semibold text-primary underline-offset-2 hover:underline">
          Sign Up
        </Link>
      </p>
    </div>
  );
};

/**
 * Inline sub-component for "Sign in with your organisation" functionality.
 * Only shown on the Cloud sign-in page, not on BYOB /{orgSlug}/sign-in.
 */
const OrgSignInSection = () => {
  const router = useRouter();
  const [orgSlug, setOrgSlug] = useState("");
  const [showInput, setShowInput] = useState(false);

  const { data: existingTenant, isLoading: isChecking } = useBYOBTenant(orgSlug);
  const orgFound =
    existingTenant && "success" in existingTenant && existingTenant.success;
  const orgNotFound = !isChecking && orgSlug.length >= 3 && !orgFound;

  if (!showInput) {
    return (
      <button
        type="button"
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium leading-5 text-foreground transition-all duration-200 hover:border-muted-foreground/30 hover:bg-accent active:scale-[0.99]"
        onClick={() => setShowInput(true)}
      >
        <Building2 className="h-4 w-4 shrink-0" />
        <span>Sign in with your organisation</span>
      </button>
    );
  }

  return (
    <div className="mt-1 flex flex-col gap-3 rounded-lg border border-border bg-accent/30 p-4">
      <p className="text-[0.8125rem] text-muted-foreground">Enter your organisation slug:</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder="my-company"
            value={orgSlug}
            className="h-11 w-full rounded-lg border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:ring-offset-0"
            onChange={(e) =>
              setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && orgFound) {
                router.push(`/${orgSlug}/sign-in`);
              }
            }}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isChecking && orgSlug.length >= 3 && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {orgFound && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {orgNotFound && <XCircle className="h-4 w-4 text-destructive" />}
          </div>
        </div>
        <Button
          disabled={!orgFound}
          onClick={() => router.push(`/${orgSlug}/sign-in`)}
          className="rounded-lg font-semibold"
        >
          Go
        </Button>
      </div>

      {orgFound && (
        <p className="text-xs text-green-500 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Organisation <span className="font-mono">{orgSlug}</span> found!
        </p>
      )}

      {orgNotFound && (
        <div className="space-y-1">
          <p className="text-xs text-destructive">Organisation not found</p>
          <button
            type="button"
            className="text-xs text-primary underline-offset-2 hover:underline"
            onClick={() => router.push(`/setup/${orgSlug}`)}
          >
            Want to set up this organisation? →
          </button>
        </div>
      )}

      <button
        type="button"
        className="text-xs text-muted-foreground hover:underline"
        onClick={() => setShowInput(false)}
      >
        Cancel
      </button>
    </div>
  );
};
