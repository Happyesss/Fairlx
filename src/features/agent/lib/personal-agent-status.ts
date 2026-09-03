import type { PersonalAgentProfile } from "../types";

export function profileIsTrained(profile: PersonalAgentProfile | null | undefined): boolean {
  return Boolean(profile?.status === "trained" && profile.compiledPrompt.trim());
}
