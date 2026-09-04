"use client";

import { ExternalLink, Lock, Shield, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const TokenGuide = () => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-auto p-0 text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline"
        >
          How to generate token?
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            GitHub Personal Access Token Guide
          </SheetTitle>
          <SheetDescription>
            Follow these simple steps to create a token for private repositories
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Security Notice */}
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <Shield className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-sm text-green-800 dark:text-green-200">
              <strong className="font-semibold">Your Security Matters</strong>
              <p className="mt-1">
                Tokens stay encrypted in Fairlx. The Agent never runs git on Fairlx servers.
                File edits and pull requests go through the GitHub API and wait for Accept in chat.
              </p>
            </AlertDescription>
          </Alert>

          {/* Step-by-step Guide */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Step-by-Step Instructions
            </h3>

            {/* Step 1 */}
            <div className="space-y-2 pl-6 border-l-2 border-muted pb-4">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5 shrink-0">
                  Step 1
                </Badge>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Go to GitHub Settings</p>
                  <p className="text-xs text-muted-foreground">
                    Navigate to your GitHub account settings
                  </p>
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Open GitHub Token Settings
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="space-y-2 pl-6 border-l-2 border-muted pb-4">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5 shrink-0">
                  Step 2
                </Badge>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Generate New Token</p>
                  <p className="text-xs text-muted-foreground">
                    Click on &quot;Generate new token&quot; → Select &quot;Generate new token (classic)&quot;
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-2 pl-6 border-l-2 border-muted pb-4">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5 shrink-0">
                  Step 3
                </Badge>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Configure Token</p>
                  <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                    <li>
                      <strong>Note:</strong> Give it a descriptive name (e.g., &quot;Fairlx Integration&quot;)
                    </li>
                    <li>
                      <strong>Expiration:</strong> Choose your preferred expiration (e.g., 90 days)
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="space-y-2 pl-6 border-l-2 border-primary pb-4">
              <div className="flex items-start gap-3">
                <Badge className="mt-0.5 shrink-0">Step 4</Badge>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Select Repository Scope</p>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-muted-foreground font-semibold">
                      ✓ Check this permission:
                    </p>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3" />
                        <code className="bg-background px-2 py-0.5 rounded font-mono">
                          repo
                        </code>
                        <span className="text-muted-foreground">
                          (Read and write on private repositories)
                        </span>
                      </div>
                    </div>
                    <Alert className="mt-2">
                      <AlertCircle className="h-3 w-3" />
                      <AlertDescription className="text-xs">
                        The classic <strong>repo</strong> scope is required for the Agent to commit on a branch
                        and open a pull request. Writes still wait for Accept/Deny in the Agent. Fine-grained
                        tokens need Contents read/write plus Pull requests write.
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 5 */}
            <div className="space-y-2 pl-6 border-l-2 border-muted pb-4">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5 shrink-0">
                  Step 5
                </Badge>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Generate & Copy Token</p>
                  <p className="text-xs text-muted-foreground">
                    Click &quot;Generate token&quot; at the bottom, then copy the token immediately
                  </p>
                  <Alert className="mt-2 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                    <AlertCircle className="h-3 w-3 text-amber-600" />
                    <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>Important:</strong> Save your token now! You won&apos;t be able to see it again.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            </div>

            {/* Step 6 */}
            <div className="space-y-2 pl-6 border-l-2 border-muted">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5 shrink-0">
                  Step 6
                </Badge>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Paste Token Here</p>
                  <p className="text-xs text-muted-foreground">
                    Return to this form and paste your token in the &quot;GitHub Token&quot; field
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* What We Access */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              What Fairlx uses
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1.5 ml-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                <span>Repository structure and file contents</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                <span>Commit history and messages</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                <span>Branch commits and pull requests after you Accept in the Agent</span>
              </li>
            </ul>
          </div>

          {/* What We Don't Access */}
          <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 space-y-3 border border-red-200">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-red-700 dark:text-red-300">
              <Lock className="h-4 w-4" />
              What Fairlx does not do
            </h4>
            <ul className="text-xs text-red-600 dark:text-red-400 space-y-1.5 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-base">✗</span>
                <span>No git or shell on Fairlx servers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-base">✗</span>
                <span>No writes without Accept in the Agent</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-base">✗</span>
                <span>No access to your GitHub account settings</span>
              </li>
            </ul>
          </div>

          {/* Quick Link */}
          <div className="pt-2">
            <a
              href="https://github.com/settings/tokens/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
            >
              <ExternalLink className="h-4 w-4" />
              Create Token on GitHub Now
            </a>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
