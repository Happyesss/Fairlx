import { formatDistanceToNow } from "date-fns";

export { AGENT_FIELD_CLASS as fieldClass } from "../constants";

export function userInitials(name?: string | null, email?: string | null): string {
  const source = (name || "").trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
    if (letters) return letters;
  }
  return (email?.[0] || "U").toUpperCase();
}

export function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function relativeTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatDistanceToNow(date, { addSuffix: true });
}

export function firstName(name?: string | null, email?: string | null): string {
  const source = (name || "").trim();
  if (source) return source.split(/\s+/)[0] ?? source;
  return email?.split("@")[0] || "there";
}
