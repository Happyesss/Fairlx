"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
  useMemo,
} from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { Member } from "@/features/members/types";

interface MentionInputProps {
  workspaceId: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

// Parse content into display parts (text and mentions)
function parseForDisplay(content: string): Array<{ type: "text" | "mention"; content: string; userId?: string }> {
  const parts: Array<{ type: "text" | "mention"; content: string; userId?: string }> = [];
  const mentionRegex = /@([^@\[\]]+?)\[([a-zA-Z0-9]+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.substring(lastIndex, match.index) });
    }
    parts.push({ type: "mention", content: match[1], userId: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.substring(lastIndex) });
  }

  return parts;
}

export const MentionInput = ({
  workspaceId,
  value,
  onChange,
  onSubmit,
  placeholder = "Write a comment... Use @ to mention someone",
  disabled = false,
  autoFocus = false,
  className,
}: MentionInputProps) => {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [_mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: members } = useGetMembers({ workspaceId });

  // Filter members based on mention query
  const filteredMembers = members?.documents?.filter((member: Member) => {
    if (!mentionQuery) return true;
    const name = member.name?.toLowerCase() || "";
    const email = member.email?.toLowerCase() || "";
    const query = mentionQuery.toLowerCase();
    return name.includes(query) || email.includes(query);
  }) || [];

  // Parse value for display
  const _displayParts = useMemo(() => parseForDisplay(value), [value]);

  // Reset selected index when filtered members change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredMembers.length]);

  // Auto focus
  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus();
    }
  }, [autoFocus]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        editorRef.current &&
        !editorRef.current.contains(e.target as Node)
      ) {
        setShowMentions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get plain text from contenteditable, preserving mention format
  const getValueFromEditor = useCallback(() => {
    if (!editorRef.current) return "";
    
    let result = "";
    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      null
    );

    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent || "";
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.dataset.mentionUserId) {
          result += `@${el.dataset.mentionName}[${el.dataset.mentionUserId}]`;
          walker.nextNode(); // Skip the text inside the mention span
        } else if (el.tagName === "BR") {
          result += "\n";
        }
      }
    }

    return result;
  }, []);

  const insertMention = useCallback(
    (member: Member) => {
      if (!editorRef.current) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const displayName = member.name || member.email || "User";

      // Find and delete the @query text
      const textNode = range.startContainer;
      if (textNode.nodeType === Node.TEXT_NODE && textNode.textContent) {
        const text = textNode.textContent;
        const cursorPos = range.startOffset;
        const beforeCursor = text.substring(0, cursorPos);
        const lastAtIndex = beforeCursor.lastIndexOf("@");

        if (lastAtIndex !== -1) {
          // Create new text nodes and mention span
          const before = text.substring(0, lastAtIndex);
          const after = text.substring(cursorPos);

          const mentionSpan = document.createElement("span");
          mentionSpan.className = "inline-flex items-center px-1 py-0.5 mx-0.5 rounded bg-primary/10 text-primary font-medium text-sm";
          mentionSpan.contentEditable = "false";
          mentionSpan.dataset.mentionUserId = member.userId;
          mentionSpan.dataset.mentionName = displayName;
          mentionSpan.textContent = `@${displayName}`;

          const parent = textNode.parentNode;
          if (parent) {
            const beforeNode = document.createTextNode(before);
            const afterNode = document.createTextNode(after + " ");

            parent.insertBefore(beforeNode, textNode);
            parent.insertBefore(mentionSpan, textNode);
            parent.insertBefore(afterNode, textNode);
            parent.removeChild(textNode);

            // Set cursor after mention
            const newRange = document.createRange();
            newRange.setStart(afterNode, 1);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
        }
      }

      // Update value
      const newValue = getValueFromEditor();
      onChange(newValue);

      setShowMentions(false);
      setMentionQuery("");
      setMentionStartIndex(-1);
    },
    [onChange, getValueFromEditor]
  );

  const handleInput = useCallback(() => {
    const newValue = getValueFromEditor();
    onChange(newValue);

    // Check for mention trigger
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;

    if (textNode.nodeType === Node.TEXT_NODE && textNode.textContent) {
      const text = textNode.textContent;
      const cursorPos = range.startOffset;
      const beforeCursor = text.substring(0, cursorPos);
      const lastAtIndex = beforeCursor.lastIndexOf("@");

      if (lastAtIndex !== -1) {
        const charBeforeAt = lastAtIndex > 0 ? beforeCursor[lastAtIndex - 1] : " ";
        if (charBeforeAt === " " || charBeforeAt === "\n" || lastAtIndex === 0) {
          const query = beforeCursor.substring(lastAtIndex + 1);
          if (!query.includes(" ") && !query.includes("\n") && !query.includes("[")) {
            setMentionQuery(query);
            setMentionStartIndex(lastAtIndex);
            setShowMentions(true);
            return;
          }
        }
      }
    }

    setShowMentions(false);
    setMentionQuery("");
    setMentionStartIndex(-1);
  }, [onChange, getValueFromEditor]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (showMentions && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredMembers.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredMembers.length - 1
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredMembers[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }

    // Submit on Enter without Shift
    if (e.key === "Enter" && !e.shiftKey && !showMentions) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const getInitials = (member: Member) => {
    if (member.name) {
      return member.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return member.email?.[0]?.toUpperCase() || "?";
  };

  // Sync editor content when value changes externally (like after submission)
  useEffect(() => {
    if (!editorRef.current) return;
    const currentValue = getValueFromEditor();
    if (currentValue !== value) {
      // Value was changed externally, update editor
      if (value === "") {
        editorRef.current.innerHTML = "";
      }
    }
  }, [value, getValueFromEditor]);

  return (
    <div className={cn("relative", className)}>
      <div className="flex gap-2">
        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          data-placeholder={placeholder}
          className={cn(
            "min-h-[80px] flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "whitespace-pre-wrap break-words overflow-y-auto max-h-[200px]",
            "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none",
            disabled && "cursor-not-allowed opacity-50"
          )}
          suppressContentEditableWarning
        />
        <Button
          type="button"
          size="icon"
          disabled={disabled || !value.trim()}
          onClick={onSubmit}
          className="shrink-0 self-end"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Mention Dropdown */}
      {showMentions && filteredMembers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 bottom-full mb-1 w-64 max-h-48 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {filteredMembers.slice(0, 10).map((member: Member, index: number) => (
            <button
              key={member.$id}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors",
                index === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
              onClick={() => insertMention(member)}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage
                  src={member.profileImageUrl || undefined}
                  alt={member.name || "User"}
                />
                <AvatarFallback className="text-xs">
                  {getInitials(member)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start overflow-hidden">
                <span className="font-medium truncate">
                  {member.name || "Unknown"}
                </span>
                {member.email && (
                  <span className="text-xs text-muted-foreground truncate">
                    {member.email}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showMentions && filteredMembers.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 bottom-full mb-1 w-64 rounded-md border bg-popover p-3 shadow-md"
        >
          <p className="text-sm text-muted-foreground text-center">
            No members found
          </p>
        </div>
      )}
    </div>
  );
};
