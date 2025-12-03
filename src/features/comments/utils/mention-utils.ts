import { Member } from "@/features/members/types";

/**
 * Extracts mentioned user IDs from comment content
 * Mentions are in format @Username or @email@domain.com
 */
export function extractMentions(
  content: string,
  members: Member[]
): string[] {
  const mentionedIds: string[] = [];
  // Match @mentions (words or emails after @)
  const mentionRegex = /@([\w\s]+?)(?=\s|$|@)|@([\w.-]+@[\w.-]+)/g;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    const mentionName = (match[1] || match[2])?.trim();
    if (mentionName) {
      // Find member by name or email
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
 */
export type ContentPart =
  | { type: "text"; content: string }
  | { type: "mention"; name: string; userId?: string };

export function parseContentWithMentions(
  content: string,
  members?: Member[]
): ContentPart[] {
  const parts: ContentPart[] = [];
  // Match @mentions followed by a name (stopping at next @ or newline)
  const mentionRegex = /@([\w\s.-]+?)(?=\s@|\s{2}|$|\n)/g;
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: content.substring(lastIndex, match.index),
      });
    }

    const mentionName = match[1].trim();
    
    // Find member to get userId
    const member = members?.find(
      (m) =>
        m.name?.toLowerCase() === mentionName.toLowerCase() ||
        m.email?.toLowerCase() === mentionName.toLowerCase()
    );

    parts.push({
      type: "mention",
      name: mentionName,
      userId: member?.userId,
    });

    lastIndex = match.index + match[0].length;
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
