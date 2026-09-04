"use client";

import { AlertCircle, CheckCircle2, ExternalLink, Info, Lock, Shield } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type GuideStep = {
  title: string;
  body: string;
  href?: { label: string; url: string };
  bullets?: string[];
  highlight?: string;
  warning?: string;
};

type CredentialGuide = {
  title: string;
  description: string;
  credential: string;
  openLabel: string;
  openUrl: string;
  steps: GuideStep[];
  uses: string[];
  avoids: string[];
};

const GUIDES: Record<string, CredentialGuide> = {
  outlook: {
    title: "Connect Outlook / Microsoft 365",
    description: "Fairlx signs you in with Microsoft once and stores a refresh token. You never paste a Graph Explorer access token.",
    credential: "Microsoft sign-in",
    openLabel: "Open Microsoft app registrations",
    openUrl: "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    steps: [
      {
        title: "Prefer Fairlx Connect",
        body: "If your admin set AGENT_MICROSOFT_CLIENT_ID, click Connect Outlook. Sign in with the mailbox that should send, accept Mail.Send, and you are done.",
      },
      {
        title: "Or bring your own Microsoft app",
        body: "Create an app registration in Microsoft Entra ID. Platform: Web. Redirect URI must be exactly your Fairlx callback.",
        href: {
          label: "App registrations",
          url: "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
        },
        bullets: [
          "Redirect URI: {your Fairlx origin}/api/agent/plugins/oauth/callback",
          "Delegated Microsoft Graph permission: Mail.Send, plus User.Read and offline_access",
          "Create a client secret and paste client ID + secret on the Connect card, then Connect.",
        ],
        warning: "Application-only (client credentials) tokens cannot call /me/sendMail. Use delegated sign-in.",
      },
      {
        title: "Stay signed in",
        body: "Fairlx encrypts the refresh token and refreshes access tokens automatically when the Agent sends mail.",
        highlight: "You should not need to reconnect until you revoke the app or the refresh token is reset.",
      },
    ],
    uses: ["Send mail as you after policy allows", "Delegated Mail.Send only"],
    avoids: ["No mailbox reading", "No calendar or OneDrive", "No short-lived pasted access tokens"],
  },
  gmail: {
    title: "Connect Gmail",
    description: "Fairlx signs you in with Google once and stores a refresh token. Do not paste OAuth Playground access tokens.",
    credential: "Google sign-in",
    openLabel: "Open Google Cloud credentials",
    openUrl: "https://console.cloud.google.com/apis/credentials",
    steps: [
      {
        title: "Prefer Fairlx Connect",
        body: "If GOOGLE_CLIENT_ID is configured on Fairlx, click Connect Gmail, sign in, and allow gmail.send.",
      },
      {
        title: "Or bring your own Google OAuth client",
        body: "Enable Gmail API, then create a Web application OAuth client.",
        href: {
          label: "Enable Gmail API",
          url: "https://console.cloud.google.com/apis/library/gmail.googleapis.com",
        },
        bullets: [
          "Authorized redirect URI: {your Fairlx origin}/api/agent/plugins/oauth/callback",
          "Scope used: https://www.googleapis.com/auth/gmail.send",
          "Paste client ID + secret on the Connect card only when Fairlx does not already have Google OAuth env.",
        ],
      },
      {
        title: "Stay signed in",
        body: "Fairlx keeps the refresh token encrypted and refreshes Gmail access tokens before send.",
        highlight: "Reconnect only if you revoke Fairlx in your Google account.",
      },
    ],
    uses: ["Send mail as you after policy allows", "gmail.send only"],
    avoids: ["No full mailbox read", "No Drive or contacts", "No hourly token paste"],
  },
  resend: {
    title: "Resend API key",
    description: "Fairlx posts to Resend (or a compatible HTTP endpoint) with your API key. This is the simplest mail option if you already verify a domain.",
    credential: "API key",
    openLabel: "Open Resend API keys",
    openUrl: "https://resend.com/api-keys",
    steps: [
      {
        title: "Create a Resend account",
        body: "Sign in at Resend. You can send test mail from their onboarding address before a domain is verified.",
        href: { label: "Resend dashboard", url: "https://resend.com" },
      },
      {
        title: "Create an API key",
        body: "Open API Keys, click Create API Key, give it a name such as Fairlx Agent, then copy the key immediately.",
        href: { label: "API keys", url: "https://resend.com/api-keys" },
        warning: "Resend shows the full key only once. Store it, then paste it into the API key field.",
      },
      {
        title: "Set a From address",
        body: "For production, add and verify your domain, then use an address on that domain (for example agent@yourdomain.com).",
        href: { label: "Domains", url: "https://resend.com/domains" },
        bullets: [
          "Testing: you can use Resend’s onboarding From address from their docs until the domain is verified.",
          "Leave Endpoint blank unless you use a compatible custom URL. Default is https://api.resend.com/emails.",
        ],
      },
      {
        title: "Connect in Fairlx",
        body: "Paste the API key, fill From, then Connect. Mail still waits for Accept in the Agent before it sends.",
      },
    ],
    uses: ["HTTP send after you Accept", "Your verified domain From address"],
    avoids: ["Fairlx does not host your DNS", "No send until you Accept"],
  },
};

export function hasPluginCredentialGuide(catalogId: string): boolean {
  return Boolean(GUIDES[catalogId]);
}

function StepList({ steps }: { steps: GuideStep[] }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        Step-by-step
      </h3>
      {steps.map((step, index) => (
        <div
          key={step.title}
          className="space-y-2 pl-6 border-l-2 border-muted pb-4 last:pb-0 last:border-primary"
        >
          <div className="flex items-start gap-3">
            <Badge variant={index === steps.length - 1 ? "default" : "outline"} className="mt-0.5 shrink-0">
              Step {index + 1}
            </Badge>
            <div className="space-y-2 min-w-0">
              <p className="text-sm font-medium">{step.title}</p>
              <p className="text-xs text-muted-foreground">{step.body}</p>
              {step.bullets ? (
                <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                  {step.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {step.href ? (
                <a
                  href={step.href.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {step.href.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
              {step.highlight ? (
                <Alert>
                  <Info className="h-3 w-3" />
                  <AlertDescription className="text-xs">{step.highlight}</AlertDescription>
                </Alert>
              ) : null}
              {step.warning ? (
                <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                  <AlertCircle className="h-3 w-3 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                    {step.warning}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PluginCredentialGuide({ catalogId }: { catalogId: string }) {
  const guide = GUIDES[catalogId];
  if (!guide) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-6 rounded-full text-[11px] font-semibold italic shrink-0"
          aria-label={`How to get ${guide.credential}`}
          title={`How to get this ${guide.credential.toLowerCase()}`}
        >
          i
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {guide.title}
          </SheetTitle>
          <SheetDescription>{guide.description}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <Shield className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-sm text-green-800 dark:text-green-200">
              <strong className="font-semibold">Your credentials stay in Fairlx</strong>
              <p className="mt-1">
                Keys and tokens are stored encrypted. Mail is not sent until you Accept in the Agent.
              </p>
            </AlertDescription>
          </Alert>

          <StepList steps={guide.steps} />

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              What Fairlx uses
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1.5 ml-4">
              {guide.uses.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 space-y-3 border border-red-200">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-red-700 dark:text-red-300">
              <Lock className="h-4 w-4" />
              What Fairlx does not do
            </h4>
            <ul className="text-xs text-red-600 dark:text-red-400 space-y-1.5 ml-4">
              {guide.avoids.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-base leading-none">✗</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <a
            href={guide.openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
          >
            <ExternalLink className="h-4 w-4" />
            {guide.openLabel}
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
