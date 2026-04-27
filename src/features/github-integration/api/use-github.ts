import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";
import { GITHUB_INTEGRATION_QUERY_KEYS } from "../constants";
import {
  saveCommitsToCache,
  clearCommitsCache,
  clearLegacyCommits,
  notifyCommitsUpdated,
} from "../lib/commit-cache";

// Link Repository
type LinkRepositoryRequest = InferRequestType<
  typeof client.api.github.repository.link["$post"]
>;
type LinkRepositoryResponse = InferResponseType<
  typeof client.api.github.repository.link["$post"],
  200
>;

export const useLinkRepository = () => {
  const queryClient = useQueryClient();

  return useMutation<LinkRepositoryResponse, Error, LinkRepositoryRequest>({
    mutationFn: async ({ json }) => {
      const response = await client.api.github.repository.link["$post"]({ json });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || "Failed to link repository");
      }

      return await response.json();
    },
    onSuccess: async ({ data }) => {
      toast.success("Repository linked successfully");
      
  // Clear cached commits for fresh repo link
  await clearCommitsCache(data.projectId);
  clearLegacyCommits(data.projectId);
      
      // Invalidate all related queries
      queryClient.invalidateQueries({
        queryKey: GITHUB_INTEGRATION_QUERY_KEYS.repository(data.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: GITHUB_INTEGRATION_QUERY_KEYS.documentation(data.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: GITHUB_INTEGRATION_QUERY_KEYS.commits(data.projectId),
      });
      
      // Automatically fetch commits after linking repository
      toast.loading("Fetching commits...", { id: "fetch-commits" });
      
      try {
        const commitsResponse = await client.api.github.commits.fetch["$post"]({
          json: { projectId: data.projectId, limit: 500 },
        });

        if (commitsResponse.ok) {
          const commitsData = await commitsResponse.json();
          if (commitsData.data?.summaries) {
            // Optimize storage: only save essential fields to avoid quota exceeded error
            try {
              const optimizedCommits = commitsData.data.summaries.map((commit: { hash: string; message: string; author: string; authorAvatar: string | null; date: string; url: string; aiSummary?: string | null; filesChanged?: number; additions?: number; deletions?: number }) => ({
                hash: commit.hash,
                message: commit.message,
                author: commit.author,
                authorAvatar: commit.authorAvatar,
                date: commit.date,
                url: commit.url,
                aiSummary: commit.aiSummary ?? null,
                filesChanged: commit.filesChanged ?? 0,
                additions: commit.additions ?? 0,
                deletions: commit.deletions ?? 0,
                // Omit 'files' array which can be very large
              }));

              await saveCommitsToCache(data.projectId, optimizedCommits);
              clearLegacyCommits(data.projectId);
              notifyCommitsUpdated(data.projectId);
            } catch {
              // Silent fail for cache saving
            }
            
            // Dispatch custom event to notify CommitHistory component
            notifyCommitsUpdated(data.projectId);
            
            // Invalidate commits query to refetch
            queryClient.invalidateQueries({
              queryKey: GITHUB_INTEGRATION_QUERY_KEYS.commits(data.projectId),
            });
            
            toast.success(`Fetched ${commitsData.data.summaries.length} commits successfully`, { 
              id: "fetch-commits" 
            });
          }
        } else {
          const errorData = await commitsResponse.json() as { error?: string };
          throw new Error(errorData.error || "Failed to fetch commits");
        }
      } catch {
        toast.error("Repository connected but failed to fetch commits. You can fetch them manually.", { 
          id: "fetch-commits" 
        });
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to link repository");
    },
  });
};

// Get Repository
export const useGetRepository = (projectId: string) => {
  return useQuery({
    queryKey: GITHUB_INTEGRATION_QUERY_KEYS.repository(projectId),
    queryFn: async () => {
      const response = await client.api.github.repository.$get({
        query: { projectId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch repository");
      }

      const { data } = await response.json();
      return data;
    },
    enabled: !!projectId,
  });
};

// Disconnect Repository
type DisconnectRepositoryRequest = {
  param: { repositoryId: string };
  projectId: string;
};

export const useDisconnectRepository = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DisconnectRepositoryRequest>({
    mutationFn: async ({ param }) => {
      const response = await client.api.github.repository[":repositoryId"].$delete({
        param,
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect repository");
      }
    },
    onSuccess: async (_, variables) => {
      toast.success("Repository disconnected");
      
      await clearCommitsCache(variables.projectId);
      clearLegacyCommits(variables.projectId);
      
      // Invalidate all related queries
      queryClient.invalidateQueries({
        queryKey: ["github-repo"],
      });
      queryClient.invalidateQueries({
        queryKey: GITHUB_INTEGRATION_QUERY_KEYS.documentation(variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: GITHUB_INTEGRATION_QUERY_KEYS.commits(variables.projectId),
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to disconnect repository");
    },
  });
};

// Generate Documentation
type GenerateDocumentationRequest = InferRequestType<
  typeof client.api.github.documentation.generate["$post"]
>;
type GenerateDocumentationResponse = InferResponseType<
  typeof client.api.github.documentation.generate["$post"],
  200
>;

export const useGenerateDocumentation = () => {
  return useMutation<
    GenerateDocumentationResponse,
    Error,
    GenerateDocumentationRequest
  >({
    mutationFn: async ({ json }) => {
      const response = await client.api.github.documentation.generate["$post"]({
        json,
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || "Failed to generate documentation");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Documentation generated for preview");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate documentation");
    },
  });
};

// Refine Documentation
type RefineDocumentationRequest = InferRequestType<
  typeof client.api.github.documentation.refine["$post"]
>;
type RefineDocumentationResponse = InferResponseType<
  typeof client.api.github.documentation.refine["$post"],
  200
>;

export const useRefineDocumentation = () => {
  return useMutation<RefineDocumentationResponse, Error, RefineDocumentationRequest>({
    mutationFn: async ({ json }) => {
      const response = await client.api.github.documentation.refine["$post"]({ json });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || "Failed to refine documentation");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Documentation refined for preview");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to refine documentation");
    },
  });
};

// Save Documentation
type SaveDocumentationRequest = InferRequestType<
  typeof client.api.github.documentation.save["$post"]
>;
type SaveDocumentationResponse = InferResponseType<
  typeof client.api.github.documentation.save["$post"],
  200
>;

export const useSaveDocumentation = () => {
  const queryClient = useQueryClient();

  return useMutation<SaveDocumentationResponse, Error, SaveDocumentationRequest>({
    mutationFn: async ({ json }) => {
      const response = await client.api.github.documentation.save["$post"]({ json });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || "Failed to save documentation");
      }

      return await response.json();
    },
    onSuccess: ({ data }) => {
      toast.success("Documentation saved successfully");
      queryClient.invalidateQueries({
        queryKey: GITHUB_INTEGRATION_QUERY_KEYS.documentation(data.projectId),
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save documentation");
    },
  });
};

// Get Documentation
export const useGetDocumentation = (projectId: string) => {
  return useQuery({
    queryKey: GITHUB_INTEGRATION_QUERY_KEYS.documentation(projectId),
    queryFn: async () => {
      const response = await client.api.github.documentation["$get"]({
        query: { projectId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch documentation");
      }

      const { data } = await response.json();
      return data;
    },
    enabled: !!projectId,
  });
};

// Fetch Commits with real-time AI summaries
type FetchCommitsRequest = InferRequestType<
  typeof client.api.github.commits.fetch["$post"]
>;
type FetchCommitsResponse = InferResponseType<
  typeof client.api.github.commits.fetch["$post"],
  200
>;

export const useFetchCommits = () => {
  return useMutation<FetchCommitsResponse, Error, FetchCommitsRequest>({
    mutationFn: async ({ json }) => {
      toast.loading('Fetching commits...', { id: "manual-fetch-commits" });
      
      const response = await client.api.github.commits.fetch["$post"]({ json });

      if (!response.ok) {
        toast.dismiss("manual-fetch-commits");
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || "Failed to fetch commits");
      }

      return await response.json();
    },
    onSuccess: (response) => {
      const count = response.data?.summaries?.length || 0;
      toast.success(`Successfully fetched ${count} commits`, { id: "manual-fetch-commits" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to fetch commits", { id: "manual-fetch-commits" });
    },
  });
};

// Ask Question with real-time AI response
type AskQuestionRequest = InferRequestType<
  typeof client.api.github.qa.ask["$post"]
>;
type AskQuestionResponse = InferResponseType<
  typeof client.api.github.qa.ask["$post"],
  200
>;

export const useAskQuestion = () => {
  return useMutation<AskQuestionResponse, Error, AskQuestionRequest>({
    mutationFn: async ({ json }) => {
      const response = await client.api.github.qa.ask["$post"]({ json });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || "Failed to answer question");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Question answered");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to answer question");
    },
  });
};
