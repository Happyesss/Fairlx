import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

interface UploadImageResponse {
  data: { fileId: string; url: string };
}

export const useUploadBugImage = () => {
  return useMutation<UploadImageResponse, Error, File>({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/bug-reports/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        throw new Error(err.error || "Failed to upload image");
      }

      return response.json() as Promise<UploadImageResponse>;
    },
    onError: (error) => {
      toast.error(error.message || "Failed to upload image");
    },
  });
};
