import * as React from "react";
import { cn } from "@/lib/utils";
import { TaskPriority } from "../types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDown,
  Minus,
  ArrowUp,
  AlertTriangle
} from "lucide-react";

interface PriorityIconProps {
  priority: TaskPriority | string;
  className?: string;
  color?: string;
}

const cleanPriorityKey = (priority: TaskPriority | string): TaskPriority | string => {
  if (!priority) return priority;
  const str = String(priority)
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}]/gu, "")
    .replace(/[—–\-•·*`_]/g, " ")
    .trim()
    .toUpperCase();
  if (str === "HIGH" || str === "URGENT" || str === "MEDIUM" || str === "LOW") {
    return str as TaskPriority;
  }
  return priority;
};

const PriorityIcon = ({ priority, className, color }: PriorityIconProps) => {
  const normalized = cleanPriorityKey(priority);

  const getIconStyle = (p: TaskPriority | string) => {
    if (color) return ""; // allow inline style override if color is passed

    switch (p) {
      case TaskPriority.LOW:
        return "text-blue-500";
      case TaskPriority.MEDIUM:
        return "text-yellow-500";
      case TaskPriority.HIGH:
        return "text-orange-500";
      case TaskPriority.URGENT:
        return "text-red-600";
      default:
        return "text-gray-500";
    }
  };

  const getIcon = (p: TaskPriority | string) => {
    switch (p) {
      case TaskPriority.LOW:
        return <ArrowDown className="h-3.5 w-3.5" />;
      case TaskPriority.MEDIUM:
        return <Minus className="h-3.5 w-3.5" />;
      case TaskPriority.HIGH:
        return <ArrowUp className="h-3.5 w-3.5" />;
      case TaskPriority.URGENT:
        return <AlertTriangle className="h-3.5 w-3.5" />;
      default:
        return <Minus className="h-3.5 w-3.5" />;
    }
  };

  return (
    <span className={cn(getIconStyle(normalized), className)} style={{ color }}>
      {getIcon(normalized)}
    </span>
  );
};

interface PriorityBadgeProps {
  priority: TaskPriority | string;
  className?: string;
  color?: string; // Hex color for custom badge
}

export const PriorityBadge = ({ priority, className, color }: PriorityBadgeProps) => {
  const normalized = cleanPriorityKey(priority);

  const getVariant = (p: TaskPriority | string): "secondary" | "default" | "destructive" | "outline" => {
    if (color) return "outline"; // Use outline for custom colors to apply style

    switch (p) {
      case TaskPriority.LOW:
        return "secondary";
      case TaskPriority.MEDIUM:
        return "secondary";
      case TaskPriority.HIGH:
        return "secondary";
      case TaskPriority.URGENT:
        return "destructive";
      default:
        return "secondary";
    }
  };

  const formatPriorityLabel = (value: string) => {
    const cleaned = value
      .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}]/gu, "")
      .replace(/[—–\-•·*`_]/g, " ")
      .trim();
    const label = cleaned || value;
    return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
  };

  return (
    <Badge
      variant={getVariant(normalized)}
      className={cn("text-xs inline-flex items-center gap-1", className)}
      style={color ? { borderColor: color, color: color, backgroundColor: `${color}1A` } : undefined}
    >
      <PriorityIcon priority={normalized} className="shrink-0" color={color} />
      <p className="text-[11px] font-medium leading-none">{formatPriorityLabel(String(normalized))}</p>
    </Badge>
  );
};

type SelectTriggerProps = React.ComponentPropsWithoutRef<typeof SelectTrigger>;

interface PrioritySelectorProps
  extends Omit<
    SelectTriggerProps,
    "children" | "value" | "defaultValue" | "onValueChange"
  > {
  value?: TaskPriority | string;
  onValueChange: (value: TaskPriority | string) => void;
  placeholder?: string;
  disabled?: boolean;
  customPriorities?: { key: string; label: string; color: string; level: number }[];
}

export const PrioritySelector = React.forwardRef<
  HTMLButtonElement,
  PrioritySelectorProps
>(
  (
    {
      value,
      onValueChange,
      placeholder = "Select priority",
      disabled = false,
      className,
      customPriorities = [],
      ...triggerProps
    },
    ref
  ) => {
    // If custom priorities are present, use them. Otherwise fallback to defaults.
    // Logic: If customPriorities array is empty, show default enum.
    // If NOT empty, show ONLY custom priorities? Or merge?
    // Usually "Custom Priorities" implies replacing the default set for that project.

    // Merge default priorities with custom ones
    const prioritiesToRender = React.useMemo(() => {
      const defaultPriorities = Object.values(TaskPriority).map(p => ({
        key: p,
        label: p,
        color: "",
        level: 0
      }));

      const custom = customPriorities || [];
      const customKeys = new Set(custom.map(p => p.key));
      const filteredDefaults = defaultPriorities.filter(p => !customKeys.has(p.key));

      return [...filteredDefaults, ...custom];
    }, [customPriorities]);

    return (
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger
          ref={ref}
          className={cn("h-8", className)}
          disabled={disabled}
          {...triggerProps}
        >
          <SelectValue placeholder={placeholder}>
            {value && (
              <div className="flex items-center">
                {(() => {
                  const custom = customPriorities.find(p => p.key === value);
                  return (
                    <>
                      <PriorityIcon priority={value} className="mr-2" color={custom?.color} />
                      {custom ? custom.label : value}
                    </>
                  )
                })()}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {prioritiesToRender.map((priority) => (
            <SelectItem key={priority.key} value={priority.key}>
              <div className="flex items-center">
                <PriorityIcon
                  priority={priority.key}
                  className="mr-2"
                  color={priority.color}
                />
                {priority.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
);

PrioritySelector.displayName = "PrioritySelector";

export { PriorityIcon };