import { AGENT_ATTACHMENTS_JSON_MAX, MAX_ATTACHED_FILE_CHARS, SPECIALIST_FULL_ATTACH_MAX } from "./limits";

export type AttachedFile = {
  name: string;
  body: string;
};

export type SpecSubject = {
  title: string;
  body: string;
  file: string;
};

const ATTACH_START = "<<<FAIRLX_ATTACH";
const ATTACH_END = "<<<END_FAIRLX_ATTACH>>>";

export const TEXT_FILE_NAME_RE =
  /\.(md|markdown|txt|json|ts|tsx|js|jsx|css|html|csv|yml|yaml|xml|svg|sh|sql|toml)$/i;

export function isReadableTextFile(name: string, type = ""): boolean {
  const mime = type.toLowerCase();
  if (mime.startsWith("text/")) return true;
  if (mime === "application/json" || mime === "application/javascript") return true;
  if (mime.includes("markdown")) return true;
  return TEXT_FILE_NAME_RE.test(name);
}

export function formatAttachedFiles(files: AttachedFile[]): string {
  return files
    .filter((file) => file.body.trim())
    .map((file) => {
      const name = JSON.stringify(file.name);
      return `${ATTACH_START} name=${name}>>>\n${file.body.trimEnd()}\n${ATTACH_END}`;
    })
    .join("\n\n");
}

export function extractAttachedFiles(content: string): AttachedFile[] {
  if (!content.includes(ATTACH_START)) return [];
  const files: AttachedFile[] = [];
  const pattern = /<<<FAIRLX_ATTACH name=("(?:\\.|[^"\\])*")>>>\r?\n?([\s\S]*?)\r?\n?<<<END_FAIRLX_ATTACH>>>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content))) {
    let name = match[1] ?? "\"file\"";
    try {
      name = JSON.parse(name) as string;
    } catch {
      name = name.replace(/^"|"$/g, "");
    }
    files.push({ name, body: (match[2] ?? "").trimEnd() });
  }
  return files;
}

export function stripAttachedFiles(content: string): string {
  if (!content.includes(ATTACH_START)) return content;
  return content
    .replace(/<<<FAIRLX_ATTACH name=("(?:\\.|[^"\\])*")>>>\r?\n?[\s\S]*?\r?\n?<<<END_FAIRLX_ATTACH>>>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function withAttachedFiles(content: string, files: AttachedFile[]): string {
  const stripped = stripAttachedFiles(content);
  if (!files.length) return stripped;
  return [formatAttachedFiles(files), stripped].filter(Boolean).join("\n\n");
}

export function serializeAttachments(files: AttachedFile[], max = AGENT_ATTACHMENTS_JSON_MAX): string {
  let copy = files.map((file) => ({
    name: file.name,
    body: file.body.slice(0, MAX_ATTACHED_FILE_CHARS),
  }));
  let json = JSON.stringify(copy);
  while (json.length > max && copy.some((file) => file.body.length > 400)) {
    copy = copy.map((file) => ({
      ...file,
      body: file.body.slice(0, Math.max(200, Math.floor(file.body.length * 0.7))),
    }));
    json = JSON.stringify(copy);
  }
  return json.length > max ? JSON.stringify([]) : json;
}

export function splitMarkdownSubjects(markdown: string, file = "spec.md"): SpecSubject[] {
  const text = markdown.replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const heading = /^(#{1,3})\s+(.+)$/gm;
  const matches = [...text.matchAll(heading)];
  if (!matches.length) {
    return [{ title: file, body: text, file }];
  }
  const subjects: SpecSubject[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index]!;
    const start = current.index ?? 0;
    const end = index + 1 < matches.length ? (matches[index + 1]!.index ?? text.length) : text.length;
    const title = current[2]?.trim() || `Section ${index + 1}`;
    const body = text.slice(start, end).trim();
    if (body) subjects.push({ title, body, file });
  }
  if (matches[0] && (matches[0].index ?? 0) > 0) {
    const preface = text.slice(0, matches[0].index).trim();
    if (preface) subjects.unshift({ title: "Overview", body: preface, file });
  }
  return subjects;
}

export function subjectsFromFiles(files: AttachedFile[]): SpecSubject[] {
  return files.flatMap((file) => splitMarkdownSubjects(file.body, file.name));
}

export function matchSubject(subjects: SpecSubject[], subject: string): SpecSubject | undefined {
  const needle = subject.trim().toLowerCase();
  if (!needle) return undefined;
  return (
    subjects.find((item) => item.title.toLowerCase() === needle) ||
    subjects.find((item) => item.title.toLowerCase().includes(needle) || needle.includes(item.title.toLowerCase()))
  );
}

export function subjectsToc(subjects: SpecSubject[]): string {
  if (!subjects.length) return "";
  return subjects.map((item, index) => `${index + 1}. ${item.title}`).join("\n");
}

export function attachedSearchPayload(query: string, files: AttachedFile[]) {
  if (!files.length) return null;
  const subjects = subjectsFromFiles(files);
  const q = query.trim().toLowerCase();
  const named = files.filter((file) => q && file.name.toLowerCase().includes(q.slice(0, 48)));
  const subjectHit = q ? matchSubject(subjects, query) : undefined;
  const wantsSpec =
    !q ||
    named.length > 0 ||
    Boolean(subjectHit) ||
    /\b(spec|specification|attached|feature list|markdown|\.md|product)\b/i.test(query);
  if (!wantsSpec) {
    return {
      attachedFiles: files.map((file) => ({ name: file.name, chars: file.body.length })),
      subjects: subjects.map((item) => item.title),
    };
  }
  return {
    source: "attached_files",
    files: subjectHit
      ? [{ name: subjectHit.file, subject: subjectHit.title, content: subjectHit.body }]
      : named.length
        ? named.map((file) => ({ name: file.name, content: file.body }))
        : files.map((file) => ({ name: file.name, content: file.body })),
    subjects: subjects.map((item) => item.title),
  };
}

export function buildSpecialistUserMessage(params: {
  task: string;
  parentPrompt: string;
  subject?: string;
}): string {
  const files = extractAttachedFiles(params.parentPrompt);
  if (!files.length) return params.task;
  const subjects = subjectsFromFiles(files);
  const total = files.reduce((sum, file) => sum + file.body.length, 0);
  const matched = params.subject ? matchSubject(subjects, params.subject) : undefined;
  let spec: string;
  if (matched) {
    spec = formatAttachedFiles([{ name: `${matched.file} · ${matched.title}`, body: matched.body }]);
  } else if (total <= SPECIALIST_FULL_ATTACH_MAX || !params.subject) {
    spec =
      total <= SPECIALIST_FULL_ATTACH_MAX
        ? formatAttachedFiles(files)
        : [
            "Attached spec is large. Subjects:",
            subjectsToc(subjects),
            formatAttachedFiles(
              files.map((file) => ({
                name: file.name,
                body: `${file.body.slice(0, SPECIALIST_FULL_ATTACH_MAX)}\n\n[Truncated for this sub-agent. Pass subject to load one heading.]`,
              })),
            ),
          ].join("\n\n");
  } else {
    spec = [
      `No heading matched subject "${params.subject}". Available subjects:`,
      subjectsToc(subjects),
      formatAttachedFiles(files.map((file) => ({ name: file.name, body: file.body.slice(0, 8000) }))),
    ].join("\n\n");
  }
  const subjectLine = params.subject ? `Subject for this sub-agent: ${params.subject}` : "";
  const toc = subjects.length > 1 && !matched ? `Spec subjects:\n${subjectsToc(subjects)}` : "";
  return [spec, toc, subjectLine, `Task:\n${params.task}`].filter(Boolean).join("\n\n");
}
