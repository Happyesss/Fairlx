const FENCE_RE = /\[\[choices\]\]\s*([\s\S]*?)\s*\[\[\/choices\]\]/i;
const OPTIONS_TAIL_RE = /(?:^|\n)options:\s*\n((?:(?:[-*•]|\d+[.)])\s+.+\n?)+)\s*$/i;

export function splitAssistantChoices(content: string): { text: string; choices: string[] } {
  const source = content.trim();
  if (!source) return { text: "", choices: [] };

  const fence = source.match(FENCE_RE);
  if (fence) {
    return {
      text: source.replace(FENCE_RE, "").trim(),
      choices: linesToChoices(fence[1] ?? ""),
    };
  }

  const tail = source.match(OPTIONS_TAIL_RE);
  if (tail && typeof tail.index === "number") {
    return {
      text: source.slice(0, tail.index).trim(),
      choices: linesToChoices(tail[1] ?? ""),
    };
  }

  return { text: source, choices: [] };
}

function linesToChoices(block: string): string[] {
  const seen = new Set<string>();
  const choices: string[] = [];
  for (const raw of block.split("\n")) {
    const line = raw
      .replace(/^[-*•]\s+/, "")
      .replace(/^\d+[.)]\s+/, "")
      .replace(/^\[(?:choices|\/choices)\]$/i, "")
      .trim();
    if (!line || line.length > 80) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    choices.push(line);
    if (choices.length >= 6) break;
  }
  return choices;
}
