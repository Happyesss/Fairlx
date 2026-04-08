"use client";

import { useState, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, X, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { TaskContext } from "../types/ai-context";

interface TaskPickerProps {
  tasks: TaskContext[];
  selectedTask: TaskContext | null;
  onSelect: (task: TaskContext) => void;
  onClear: () => void;
  disabled?: boolean;
  /** Parse @-mention text to auto-resolve a task */
  inputText?: string;
}

/**
 * Resolve @-mention targets from input text.
 * Supports formats like:
 * - @PROJ-123  (exact key match)
 * - @signup bug  (partial title match)
 */
export function resolveAtMention(
  text: string,
  tasks: TaskContext[]
): TaskContext | null {
  // Match @-mention pattern:
  // 1. @KEY-123 (exact key like PROJ-123)
  // 2. @multi word target (until stop-words: to, status, needs, set, change, mark, as, or end of string)
  const keyMatch = text.match(/@([A-Z]+-\d+)/i);
  const phraseMatch = text.match(/@(\S+(?:\s+(?!to\b|status\b|needs\b|set\b|change\b|mark\b|as\b)\S+)*)/i);
  
  const atMatch = keyMatch || phraseMatch;
  
  if (!atMatch || !atMatch[1]) return null;
  
  const target = atMatch[1].trim().toLowerCase();
  
  // Try exact key match first
  const byKey = tasks.find(
    (t) => t.id.toLowerCase() === target || 
           (t.name && t.name.toLowerCase() === target)
  );
  if (byKey) return byKey;
  
  // Try key pattern match (e.g., PROJ-123)
  const taskKeyMatch = tasks.find(
    (t) => {
      // Tasks from context might store key in a different way
      // Check if name starts with a project prefix pattern
      const taskKey = t.name?.match(/^[A-Z]+-\d+/i)?.[0];
      return taskKey?.toLowerCase() === target;
    }
  );
  if (taskKeyMatch) return taskKeyMatch;
  
  // Try partial title match (case-insensitive)
  const byTitle = tasks.find(
    (t) => t.name.toLowerCase().includes(target)
  );
  if (byTitle) return byTitle;
  
  return null;
}

export const TaskPicker = ({
  tasks,
  selectedTask,
  onSelect,
  onClear,
  disabled = false,
  inputText = "",
}: TaskPickerProps) => {
  const [open, setOpen] = useState(false);

  // Auto-resolve @-mentions from the chat input
  useEffect(() => {
    if (inputText && !selectedTask) {
      const resolved = resolveAtMention(inputText, tasks);
      if (resolved) {
        onSelect(resolved);
      }
    }
  }, [inputText, tasks, selectedTask, onSelect]);

  // Priority colors for badges
  const priorityColor = useMemo(() => {
    const map: Record<string, string> = {
      URGENT: "bg-red-500/10 text-red-600 border-red-500/20",
      HIGH: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      MEDIUM: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
      LOW: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    };
    return (priority?: string) => map[priority || ""] || "";
  }, []);

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <Search className="h-3 w-3" />
        Select task to edit
        <span className="text-destructive">*</span>
      </label>
      <div className="flex gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "flex-1 justify-between h-8 text-xs border-dashed",
                !selectedTask && "text-muted-foreground",
                !selectedTask && "border-destructive/50"
              )}
              disabled={disabled}
              id="task-picker-trigger"
            >
              {selectedTask ? (
                <span className="flex items-center gap-2 truncate">
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-mono">
                    {selectedTask.status}
                  </Badge>
                  <span className="truncate">{selectedTask.name}</span>
                </span>
              ) : (
                "Search by key or title..."
              )}
              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[350px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search by key (PROJ-123) or title..." className="h-8 text-xs" />
              <CommandList>
                <CommandEmpty>No tasks found.</CommandEmpty>
                <CommandGroup heading={`${tasks.length} tasks available`}>
                  {tasks.map((task) => (
                    <CommandItem
                      key={task.id}
                      value={`${task.name} ${task.status} ${task.priority || ""}`}
                      onSelect={() => {
                        onSelect(task);
                        setOpen(false);
                      }}
                      className="text-xs"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3 w-3",
                          selectedTask?.id === task.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                        <span className="truncate font-medium">{task.name}</span>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            {task.status}
                          </Badge>
                          {task.priority && (
                            <Badge variant="outline" className={cn("text-[10px] px-1 py-0 h-4", priorityColor(task.priority))}>
                              {task.priority}
                            </Badge>
                          )}
                          {task.assigneeName && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              → {task.assigneeName}
                            </span>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedTask && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            disabled={disabled}
            id="task-picker-clear"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      {!selectedTask && (
        <p className="text-[10px] text-destructive/70">
          Please select a task before submitting. Tip: type @TASK-KEY in your message to auto-select.
        </p>
      )}
    </div>
  );
};
