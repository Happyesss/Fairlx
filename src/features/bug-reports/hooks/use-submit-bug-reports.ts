import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

interface BugPayload {
  title: string;
  description: string;
  imageFileIds: string[];
  imageUrls: string[];
}

interface SubmitBugReportsResponse {
  data: { $id: string }[];
}

export const useSubmitBugReports = () => {
  return useMutation<SubmitBugReportsResponse, Error, { bugs: BugPayload[] }>({
    mutationFn: async (payload) => {
      const response = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        throw new Error(err.error || "Failed to submit bug report");
      }

      return response.json() as Promise<SubmitBugReportsResponse>;
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit bug report");
    },
  });
};
