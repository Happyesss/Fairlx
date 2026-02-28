import { Member } from "@/features/members/types";

/**
 * Extracts mentioned user IDs from comment content
 * Mentions are in format @Username, @email@domain.com, or @Username[userId]
 */
export function extractMentions(
  content: string,
  members: Member[]
): string[] {
  const mentionedIds: string[] = [];

  // Match TipTap format: @name[userId] - extract userId directly
  const tiptapMentionRegex = /@[\w\s.-]+?\[([a-zA-Z0-9]+)\]/g;
  let match;

  while ((match = tiptapMentionRegex.exec(content)) !== null) {
    const userId = match[1];
    if (userId && !mentionedIds.includes(userId)) {
      mentionedIds.push(userId);
    }
  }

  // Also check plain @mentions (for backwards compatibility)
  const plainMentionRegex = /@([\w\s]+?)(?=\s|$|@)/g;
  while ((match = plainMentionRegex.exec(content)) !== null) {
    const mentionName = match[1]?.trim();
    if (mentionName) {
      const member = members.find(
        (m) =>
          m.name?.toLowerCase() === mentionName.toLowerCase() ||
          m.email?.toLowerCase() === mentionName.toLowerCase()
      );
      if (member && !mentionedIds.includes(member.userId)) {
        mentionedIds.push(member.userId);
      }
    }
  }

  return mentionedIds;
}

/**
 * Parses content and returns array of text parts and mention parts
 * Handles both TipTap format @name[id] and plain @name format
 */
export type ContentPart =
  | { type: "text"; content: string }
  | { type: "mention"; name: string; userId?: string };

export function parseContentWithMentions(
  content: string,
  members?: Member[]
): ContentPart[] {
  const parts: ContentPart[] = [];

  // Two-pass parsing to handle both @Name[userId] (with spaces) and plain @name
  // First regex: @Name[userId] format where Name can contain spaces
  // Second regex: plain @name format (single word)
  const mentionWithIdRegex = /@([^@\[\]]+?)\[([a-zA-Z0-9]+)\]/g;
  const plainMentionRegex = /@([\w.-]+)/g;
  
  // Build a map of all mention positions
  const mentions: Array<{
    start: number;
    end: number;
    name: string;
    userId?: string;
  }> = [];

  // First pass: find all @Name[userId] mentions
  let match;
  while ((match = mentionWithIdRegex.exec(content)) !== null) {
    mentions.push({
      start: match.index,
      end: match.index + match[0].length,
      name: match[1].trim(),
      userId: match[2],
    });
  }

  // Second pass: find plain @name mentions that don't overlap with first pass
  while ((match = plainMentionRegex.exec(content)) !== null) {
    const overlaps = mentions.some(
      (m) => match!.index >= m.start && match!.index < m.end
    );
    if (!overlaps) {
      mentions.push({
        start: match.index,
        end: match.index + match[0].length,
        name: match[1].trim(),
        userId: undefined,
      });
    }
  }

  // Sort mentions by position
  mentions.sort((a, b) => a.start - b.start);

  // Build parts array
  let lastIndex = 0;
  for (const mention of mentions) {
    // Add text before mention
    if (mention.start > lastIndex) {
      parts.push({
        type: "text",
        content: content.substring(lastIndex, mention.start),
      });
    }

    // Try to find member by userId first, then by name
    let member = null;
    if (mention.userId) {
      member = members?.find((m) => m.userId === mention.userId);
    }
    if (!member) {
      member = members?.find(
        (m) =>
          m.name?.toLowerCase() === mention.name.toLowerCase() ||
          m.email?.toLowerCase() === mention.name.toLowerCase()
      );
    }

    parts.push({
      type: "mention",
      name: member?.name || mention.name, // Use resolved name if available
      userId: mention.userId || member?.userId,
    });

    lastIndex = mention.end;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: "text",
      content: content.substring(lastIndex),
    });
  }

  // If no parts were added, return the entire content as text
  if (parts.length === 0) {
    parts.push({ type: "text", content });
  }

  return parts;
}

