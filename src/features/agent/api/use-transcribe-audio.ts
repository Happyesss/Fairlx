import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

async function readError(response: Response, fallback: string): Promise<never> {
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error("error" in body && typeof body.error === "string" ? body.error : fallback);
}

export function useTranscribeAudio() {
  return useMutation({
    mutationFn: async (file: File) => {
      const response = await client.api.agent.transcribe.$post({ form: { file } });
      if (!response.ok) {
        await readError(response, "Couldn't transcribe audio.");
      }
      const { data } = await response.json();
      return data.text;
    },
    onError: (error) => {
      toast.error(error.message || "Couldn't transcribe audio.");
    },
  });
}
