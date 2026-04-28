"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa6";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, CheckCircle2, XCircle, Sparkles } from "lucide-react";

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

import { registerSchema } from "../schemas";
import { useRegister } from "../api/use-register";
import { LegalAcceptance } from "./legal-acceptance";
import { useBYOBTenant } from "@/features/byob/api/use-byob-tenant";
import { generateSlugSuggestions } from "@/features/byob/utils/slug-suggestions";


interface SignUpCardProps {
  returnUrl?: string;
}

/**
 * SignUpCard - Simplified registration form
 * 
 * WHY simplified: Account type selection now happens POST-AUTH in onboarding.
 * This allows:
 * - Same flow for email/password and OAuth users
 * - Same email always resolves to same user
 * - No account type decision at signup time
 */
export const SignUpCard = ({ returnUrl }: SignUpCardProps) => {
  const { mutate, isPending } = useRegister(returnUrl);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      acceptedTerms: false as unknown as true,
      acceptedDPA: false as unknown as true,
    },
  });

  const acceptedTerms = form.watch("acceptedTerms");
  const acceptedDPA = form.watch("acceptedDPA");
  const isValid = acceptedTerms && acceptedDPA;

  const onSubmit = (values: z.infer<typeof registerSchema>) => {
    mutate({ json: values });
  };

  return (
    <div className="w-full pt-4 pb-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-1 text-2xl font-bold leading-[1.3] tracking-tight text-[#2663ec] md:text-[1.75rem]">Get started for free.</h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Join Fairlx today to start managing your projects with ease.
        </p>
      </div>

      {/* OAuth Buttons */}
      <div className="mb-3 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => signUpWithGoogle(returnUrl)}
          disabled={isPending}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium leading-5 text-foreground transition-all duration-200 hover:border-muted-foreground/30 hover:bg-accent active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FcGoogle className="h-4 w-4 shrink-0" />
          <span>Sign up with Google</span>
        </button>
        <button
          type="button"
          onClick={() => signUpWithGithub(returnUrl)}
          disabled={isPending}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium leading-5 text-foreground transition-all duration-200 hover:border-muted-foreground/30 hover:bg-accent active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FaGithub className="h-4 w-4 shrink-0" />
          <span>Sign up with GitHub</span>
        </button>
      </div>

      {/* BYOB Section */}
      <BYOBSetupSection />

      {/* Divider */}
      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="select-none text-xs lowercase text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Registration Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField
            name="name"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <label className="mb-1.5 block text-[0.8125rem] font-medium text-foreground">Name</label>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="Enter your name"
                    className="h-11 w-full rounded-lg border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:ring-offset-0"
                    disabled={isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
                    disabled={isPending}
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
                    placeholder="Enter your password"
                    disabled={isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <LegalAcceptance
            acceptedTerms={acceptedTerms}
            acceptedDPA={acceptedDPA}
            onAcceptedTermsChange={(checked) => form.setValue("acceptedTerms", checked as true, { shouldValidate: true })}
            onAcceptedDPAChange={(checked) => form.setValue("acceptedDPA", checked as true, { shouldValidate: true })}
            disabled={isPending}
          />

          <button
            type="submit"
            disabled={isPending || !isValid}
            className="mt-1 flex w-full items-center justify-center rounded-lg bg-[#2663ec] px-4 py-3 text-sm font-semibold text-primary-foreground transition-all duration-200 enabled:hover:-translate-y-px enabled:hover:opacity-90 enabled:hover:shadow-[0_4px_12px_hsl(var(--primary)/0.3)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Sign Up"
            )}
          </button>
        </form>
      </Form>

      {/* Terms footer */}
      <p className="mt-7 text-center text-xs leading-relaxed text-muted-foreground">
        By signing up, you understand and agree to our{" "}
        <Link href="https://fairlx.com/terms" target="_blank" rel="noopener noreferrer" className="text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="https://fairlx.com/privacy" target="_blank" rel="noopener noreferrer" className="text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground">
          Privacy Policy
        </Link>
        .
      </p>

      {/* Login link */}
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={returnUrl ? `/sign-in?returnUrl=${encodeURIComponent(returnUrl)}` : "/sign-in"} className="font-semibold text-primary underline-offset-2 hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
};

/**
 * Inline sub-component for "Bring Your Own Backend" setup option
 * with live slug availability checking and suggestions.
 */
const BYOBSetupSection = () => {
  const router = useRouter();
  const [orgSlug, setOrgSlug] = useState("");
  const [showInput, setShowInput] = useState(false);

  const { data: existingTenant, isLoading: isChecking } = useBYOBTenant(orgSlug);
  const slugTaken = existingTenant && "success" in existingTenant && existingTenant.success;
  const isAvailable = !isChecking && orgSlug.length >= 3 && !slugTaken;

  const suggestions = useMemo(() => {
    if (!slugTaken || orgSlug.length < 3) return [];
    return generateSlugSuggestions(orgSlug, 5);
  }, [slugTaken, orgSlug]);

  if (!showInput) {
    return (
      <button
        type="button"
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium leading-5 text-foreground transition-all duration-200 hover:border-muted-foreground/30 hover:bg-accent active:scale-[0.99]"
        onClick={() => setShowInput(true)}
      >
        <Building2 className="h-4 w-4 shrink-0" />
        <span>Bring your own backend</span>
      </button>
    );
  }

  return (
    <div className="mt-1 flex flex-col gap-3 rounded-lg border border-border bg-accent/30 p-4">
      <p className="text-[0.8125rem] text-muted-foreground">
        Choose your organisation slug to get started:
      </p>
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
              if (e.key === "Enter" && isAvailable) {
                router.push(`/setup/${orgSlug}`);
              }
            }}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isChecking && orgSlug.length >= 3 && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {!isChecking && orgSlug.length >= 3 && slugTaken && (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            {isAvailable && (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
          </div>
        </div>
        <Button
          disabled={!isAvailable}
          onClick={() => router.push(`/setup/${orgSlug}`)}
          className="rounded-lg font-semibold"
        >
          Go
        </Button>
      </div>

      {/* Available */}
      {isAvailable && (
        <p className="text-xs text-green-500 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          <span className="font-mono">{orgSlug}</span> is available!
        </p>
      )}

      {/* Taken + suggestions */}
      {slugTaken && (
        <div className="space-y-2">
          <p className="text-xs text-destructive">This slug is already taken</p>
          {suggestions.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Try one of these:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setOrgSlug(s)}
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-all duration-200 hover:border-primary hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
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
