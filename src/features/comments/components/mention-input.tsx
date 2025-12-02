"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
} from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  // Reset selected index when filtered members change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredMembers.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowMentions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const insertMention = useCallback(
    (member: Member) => {
      const beforeMention = value.substring(0, mentionStartIndex);
      const afterMention = value.substring(
        textareaRef.current?.selectionStart || mentionStartIndex + mentionQuery.length + 1
      );
      const mentionText = `@${member.name || member.email} `;

      const newValue = beforeMention + mentionText + afterMention;
      onChange(newValue);
      setShowMentions(false);
      setMentionQuery("");
      setMentionStartIndex(-1);

      // Focus back on textarea and set cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = beforeMention.length + mentionText.length;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    },
    [value, mentionStartIndex, mentionQuery, onChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    onChange(newValue);

    // Check if we should show mention dropdown
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      // Check if @ is at start or preceded by whitespace
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
      if (charBeforeAt === " " || charBeforeAt === "\n" || lastAtIndex === 0) {
        const query = textBeforeCursor.substring(lastAtIndex + 1);
        // Only show if query doesn't contain spaces (single word)
        if (!query.includes(" ") && !query.includes("\n")) {
          setMentionQuery(query);
          setMentionStartIndex(lastAtIndex);
          setShowMentions(true);
          return;
        }
      }
    }

    setShowMentions(false);
    setMentionQuery("");
    setMentionStartIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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

    // Submit on Enter without Shift (when not showing mentions)
    if (e.key === "Enter" && !e.shiftKey && !showMentions) {
      e.preventDefault();
      onSubmit();
    }
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

  return (
    <div className={cn("relative", className)}>
      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className="min-h-[80px] resize-none flex-1"
        />
        <Button
          type="submit"
          size="icon"
          disabled={disabled || !value.trim()}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Mention Dropdown - positioned above */}
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
