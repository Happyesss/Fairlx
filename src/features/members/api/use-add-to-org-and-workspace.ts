"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MemberRole } from "../types";

interface AddToOrgAndWorkspaceData {
  workspaceId: string;
  email: string;
  name?: string;
  role?: MemberRole;
}

export const useAddToOrgAndWorkspace = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: AddToOrgAndWorkspaceData) => {
      const response = await fetch("/api/members/org-and-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to add member");
      }
      return data;
    },
    onSuccess: (data, variables) => {
      const added = data?.data;
      if (added?.addedToOrganization && added?.emailSent) {
        toast.success(`${added.name} was added to the organization and this workspace. A welcome email was sent.`);
      } else if (added?.addedToOrganization) {
        toast.warning(
          `${added.name} was added, but the invite email did not send${
            added.emailError ? `: ${added.emailError}` : ""
          }. Resend it from Organization → Members.`,
        );
      } else {
        toast.success(`${added?.name || "Member"} was added to this workspace.`);
      }
      queryClient.invalidateQueries({ queryKey: ["members", variables.workspaceId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add member");
    },
  });

  return mutation;
};
