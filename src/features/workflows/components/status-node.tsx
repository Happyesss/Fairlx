"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { 
  Circle, CheckCircle, Clock, Edit, Trash2, Play, Flag, 
  UserCheck, Eye, Bug, Zap, Star, AlertCircle, Ban, 
  CircleDashed, CheckSquare, ShieldCheck, Sparkles,
  CircleDot, Timer, Pause, Square, XCircle, AlertTriangle,
  Bookmark, EyeOff, Lock, Unlock, Archive, Send, 
  MessageSquare, Users, Rocket, Target, Crosshair,
  Shield, ThumbsUp, ThumbsDown, Loader, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { StatusNodeData, STATUS_TYPE_CONFIG } from "../types";

// Map icon names to actual icon components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Circle, CircleDot, CircleDashed, Clock, Timer, Play, Pause,
  Square, CheckSquare, CheckCircle, CheckCircle2: CheckCircle,
  XCircle, AlertCircle, AlertTriangle, Bug, Zap, Star, Flag,
  Bookmark, Eye, EyeOff, Lock, Unlock, Archive, Trash: Trash2,
  Send, MessageSquare, UserCheck, Users, Sparkles, Rocket,
  Target, Crosshair, Shield, ShieldCheck, ThumbsUp, ThumbsDown,
  Ban, Loader, RefreshCw,
};

const getIconComponent = (iconName: string) => {
  return ICON_MAP[iconName] || Circle;
};

type StatusNodeProps = {
  data: StatusNodeData;
  selected?: boolean;
};

export const StatusNode = memo(({ data, selected }: StatusNodeProps) => {
  const IconComponent = getIconComponent(data.icon);
  const statusTypeConfig = STATUS_TYPE_CONFIG[data.statusType];

  return (
    <div
      className={cn(
        "relative min-w-[140px] max-w-[180px] rounded-lg border-2 bg-background shadow-md transition-all duration-200",
        selected ? "ring-2 ring-primary ring-offset-2" : "hover:shadow-lg",
        data.isPreview && "border-dashed opacity-70",
        "group"
      )}
      style={{ borderColor: data.color }}
    >
      {/* Connection Handles */}
      {!data.isPreview && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            className="!w-2.5 !h-2.5 !bg-muted-foreground/50 !border-2 !border-background hover:!bg-primary transition-colors"
          />
          <Handle
            type="source"
            position={Position.Right}
            className="!w-2.5 !h-2.5 !bg-muted-foreground/50 !border-2 !border-background hover:!bg-primary transition-colors"
          />
        </>
      )}

      {/* Status Indicators */}
      <div className="absolute -top-1.5 left-2 flex gap-1">
        {data.isPreview && (
          <Badge variant="secondary" className="h-4 text-[8px] px-1.5 font-medium gap-0.5 bg-purple-100 text-purple-700 border-purple-200">
            <Sparkles className="size-2 text-purple-600" />
            Suggested
          </Badge>
        )}
        {data.isInitial && (
          <Badge variant="secondary" className="h-4 text-[8px] px-1.5 font-medium gap-0.5">
            <Play className="size-2 fill-current" />
            Start
          </Badge>
        )}
        {data.isFinal && (
          <Badge variant="secondary" className="h-4 text-[8px] px-1.5 font-medium gap-0.5 bg-emerald-100 text-emerald-700">
            <Flag className="size-2" />
            End
          </Badge>
        )}
      </div>

      {/* Main Content */}
      <div className={cn("p-3 pt-4", data.isPreview && "pointer-events-none")}>
        {/* Header */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="flex-shrink-0 p-1 rounded-md"
              style={{ backgroundColor: `${data.color}20` }}
            >
              <IconComponent
                className="size-3.5"
                style={{ color: data.color }}
              />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-xs truncate">{data.name}</h3>
              <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-wide">
                {data.key}
              </p>
            </div>
          </div>

          {/* Actions Menu */}
          {!data.isPreview && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => data.onEdit(data.id)}>
                  <Edit className="size-4 mr-2" />
                  Edit Status
                </DropdownMenuItem>
                {data.onRemove && (
                  <DropdownMenuItem onClick={() => data.onRemove?.(data.id)}>
                    <Circle className="size-4 mr-2" />
                    Remove from Canvas
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => data.onDelete(data.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Status Type Badge */}
        <div className="mt-2 flex items-center gap-1.5">
          <Badge
            variant="outline"
            className="text-[9px] h-4 px-1.5"
            style={{ borderColor: `${data.color}50`, color: data.color }}
          >
            {statusTypeConfig.label}
          </Badge>
        </div>
      </div>

      {/* Color Bar */}
      <div
        className={cn("h-0.5 rounded-b-lg", data.isPreview && "opacity-50")}
        style={{ backgroundColor: data.color }}
      />
    </div>
  );
});

StatusNode.displayName = "StatusNode";
