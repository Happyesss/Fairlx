import type { AgentContextChip } from "../types";
import { isReadableTextFile } from "./attachments";
import { MAX_ATTACHED_FILE_CHARS } from "./limits";

export async function chipFromFile(file: File): Promise<AgentContextChip> {
  const id = `${file.name}-${file.size}-${file.lastModified}`;
  if (file.type.startsWith("image/")) {
    return { kind: "image", id, label: file.name, meta: "image" };
  }
  if (!isReadableTextFile(file.name, file.type)) {
    return {
      kind: "file",
      id,
      label: file.name,
      meta: file.type || "binary",
    };
  }
  const raw = await file.text();
  const truncated = raw.length > MAX_ATTACHED_FILE_CHARS;
  const body = truncated
    ? `${raw.slice(0, MAX_ATTACHED_FILE_CHARS)}\n\n[Truncated after ${MAX_ATTACHED_FILE_CHARS} characters.]`
    : raw;
  return {
    kind: "file",
    id,
    label: file.name,
    meta: truncated ? "text truncated" : file.type || "text",
    content: body,
  };
}
