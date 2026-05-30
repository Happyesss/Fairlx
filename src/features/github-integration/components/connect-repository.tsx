"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Trash2, AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfirm } from "@/hooks/use-confirm";

import { useLinkRepository, useDisconnectRepository, useGetRepository } from "../api/use-github";
import { TokenGuide } from "./token-guide";
import { githubAPI } from "../lib/github-api";

const formSchema = z.object({
  githubUrl: z
    .string()
    .min(1, "GitHub URL is required")
    .url("Must be a valid URL")
    .refine(
      (url) => url.includes("github.com"),
      "Must be a GitHub repository URL"
    ),
  branch: z.string().min(1, "Branch name is required").default("main"),
  githubToken: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ConnectRepositoryProps {
  projectId: string;
  isUpdate?: boolean;
  canManage?: boolean;
}

export const ConnectRepository = ({
  projectId,
  isUpdate = false,
  canManage = false,
}: ConnectRepositoryProps) => {
  const [open, setOpen] = useState(false);
  const [isCheckingRepo, setIsCheckingRepo] = useState(false);
  const [repoValidation, setRepoValidation] = useState<{
    isPrivate: boolean;
    needsToken: boolean;
    error?: string;
  } | null>(null);
  
  const { data: repository } = useGetRepository(projectId);
  const { mutate: linkRepository, isPending: isLinking } = useLinkRepository();
  const { mutate: disconnectRepository, isPending: isDisconnecting } =
    useDisconnectRepository();
  const [ConfirmDialog, confirm] = useConfirm(
    "Disconnect Repository",
    "Are you sure you want to disconnect this repository? Documentation and commit data will be preserved but won't be updated.",
    "destructive"
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      githubUrl: repository?.githubUrl || "",
      branch: repository?.branch || "main",
      githubToken: "",
    },
  });

  // Watch for URL changes and validate repository
  const githubUrl = form.watch("githubUrl");
  const githubToken = form.watch("githubToken");

  useEffect(() => {
    const checkRepository = async () => {
      // Only check if URL looks complete (has owner/repo format)
      if (!githubUrl || !githubUrl.includes("github.com/")) {
        setRepoValidation(null);
        return;
      }

      // Parse GitHub URL first to validate format
      let owner: string, repo: string;
      try {
        const parsed = githubAPI.parseGitHubUrl(githubUrl);
        owner = parsed.owner;
        repo = parsed.repo;
        
        // Don't check if we don't have both owner and repo
        if (!owner || !repo) {
          setRepoValidation(null);
          return;
        }
      } catch {
        setRepoValidation(null);
        return;
      }

      try {
        setIsCheckingRepo(true);
        
        // Create API instance with token if provided
        const { GitHubAPI } = await import("../lib/github-api");
        const api = new GitHubAPI(githubToken || undefined);
        const result = await api.checkRepositoryAccess(owner, repo);
        
        setRepoValidation({
          isPrivate: result.isPrivate,
          needsToken: result.needsToken,
          error: result.error,
        });
      } catch {
        setRepoValidation(null);
      } finally {
        setIsCheckingRepo(false);
      }
    };

    // Increase debounce time to 1 second to avoid excessive API calls
    const timeoutId = setTimeout(checkRepository, 1000);
    return () => clearTimeout(timeoutId);
  }, [githubUrl, githubToken]);

  const onSubmit = (values: FormValues) => {
    // Validate private repository has token
    if (repoValidation?.needsToken && !values.githubToken) {
      form.setError("githubToken", {
        type: "manual",
        message: "GitHub token is required for private repositories",
      });
      return;
    }

    linkRepository(
      {
        json: { ...values, projectId },
      },
      {
        onSuccess: () => {
          setOpen(false);
          form.reset();
          setRepoValidation(null);
        },
      }
    );
  };

  const handleDisconnect = async () => {
    if (!repository) return;

    const ok = await confirm();
    if (!ok) return;

    disconnectRepository({
      param: { repositoryId: repository.$id },
      projectId,
    });
  };

  if (isUpdate && repository) {
    if (!canManage) return null;
    return (
      <>
        <ConfirmDialog />
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1">
                <RefreshCw className="size-4 mr-2" />
                Update Repository
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
              <DialogHeader>
                <DialogTitle>Update GitHub Repository</DialogTitle>
                <DialogDescription>
                  Update the repository URL or branch. This will re-sync all data.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="githubUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GitHub Repository URL</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              placeholder="https://github.com/username/repository"
                              {...field}
                              disabled={isLinking}
                            />
                            {isCheckingRepo && (
                              <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        </FormControl>
                        <FormDescription>
                          The full URL of your GitHub repository
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="branch"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Branch</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="main"
                            {...field}
                            disabled={isLinking}
                          />
                        </FormControl>
                        <FormDescription>
                          The branch to analyze (e.g., main, master, develop)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="githubToken"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className={repoValidation?.needsToken ? "text-destructive" : ""}>
                            GitHub Token {repoValidation?.needsToken && <span className="text-destructive">*</span>}
                            {!repoValidation?.needsToken && <span className="text-muted-foreground font-normal">(optional, for private repositories)</span>}
                          </FormLabel>
                          <TokenGuide />
                        </div>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                            {...field}
                            disabled={isLinking}
                            className={repoValidation?.needsToken && !field.value ? "border-destructive focus-visible:ring-destructive" : ""}
                          />
                        </FormControl>
                        {repoValidation?.needsToken && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              This is a private repository. Please provide a GitHub token to proceed.
                            </AlertDescription>
                          </Alert>
                        )}
                        {repoValidation?.isPrivate && !repoValidation.needsToken && (
                          <Alert className="mt-2 border-green-200 bg-green-50 dark:bg-green-950/20">
                            <AlertCircle className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-xs text-green-800 dark:text-green-200">
                              ✓ Private repository access verified
                            </AlertDescription>
                          </Alert>
                        )}
                        {!repoValidation?.isPrivate && repoValidation && (
                          <Alert className="mt-2 border-green-200 bg-green-50 dark:bg-green-950/20">
                            <AlertCircle className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-xs text-green-800 dark:text-green-200">
                              ✓ This is a public repository. Token is optional.
                            </AlertDescription>
                          </Alert>
                        )}
                        {!repoValidation && (
                          <FormDescription>
                            Personal access token for private repositories. Leave empty for public repos.
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpen(false)}
                      disabled={isLinking}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isLinking}>
                      {isLinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Update Repository
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            size="sm"
            className="flex-1 bg-red-500"
          >
            {isDisconnecting ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="size-4 mr-2" />
            )}
            Disconnect Repository
          </Button>
        </div>
      </>
    );
  }

  if (!canManage) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">Connect Repository</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Connect GitHub Repository</DialogTitle>
          <DialogDescription>
            Enter your GitHub repository URL to enable AI-powered code insights
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="githubUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GitHub Repository URL</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="https://github.com/username/repository"
                        {...field}
                        disabled={isLinking}
                      />
                      {isCheckingRepo && (
                        <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    The full URL of your GitHub repository
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="branch"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="main"
                      {...field}
                      disabled={isLinking}
                    />
                  </FormControl>
                  <FormDescription>
                    The branch to analyze (e.g., main, master, develop)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="githubToken"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className={repoValidation?.needsToken ? "text-destructive" : ""}>
                      GitHub Token {repoValidation?.needsToken && <span className="text-destructive">*</span>}
                      {!repoValidation?.needsToken && <span className="text-muted-foreground font-normal">(optional, for private repositories)</span>}
                    </FormLabel>
                    <TokenGuide />
                  </div>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      {...field}
                      disabled={isLinking}
                      className={repoValidation?.needsToken && !field.value ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                  </FormControl>
                  {repoValidation?.needsToken && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        This is a private repository. Please provide a GitHub token to proceed.
                      </AlertDescription>
                    </Alert>
                  )}
                  {repoValidation?.isPrivate && !repoValidation.needsToken && (
                    <Alert className="mt-2 border-green-200 bg-green-50 dark:bg-green-950/20">
                      <AlertCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-xs text-green-800 dark:text-green-200">
                        ✓ Private repository access verified
                      </AlertDescription>
                    </Alert>
                  )}
                  {!repoValidation?.isPrivate && repoValidation && (
                    <Alert className="mt-2 border-green-200 bg-green-50 dark:bg-green-950/20">
                      <AlertCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-xs text-green-800 dark:text-green-200">
                        ✓ This is a public repository. Token is optional.
                      </AlertDescription>
                    </Alert>
                  )}
                  {!repoValidation && (
                    <FormDescription>
                      Personal access token for private repositories. Leave empty for public repos.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLinking}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLinking}>
                {isLinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect Repository
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
