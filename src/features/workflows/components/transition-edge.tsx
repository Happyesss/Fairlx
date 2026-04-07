"use client";

import { memo, useState, useMemo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Position,
} from "@xyflow/react";
import { Edit, Trash2, ArrowRight, Shield, Users, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TransitionEdgeData } from "../types";

type TransitionEdgeProps = {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  source: string;
  target: string;
  data?: TransitionEdgeData;
  selected?: boolean;
};

export const TransitionEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    source,
    target,
    data,
    selected,
  }: TransitionEdgeProps) => {
    const [isHovered, setIsHovered] = useState(false);
    
    // Determine if this is a "reverse" edge (target < source alphabetically)
    // This helps offset bidirectional edges to avoid overlap
    const isReverseDirection = source > target;
    
    // Calculate offset for bidirectional edges
    const labelOffset = useMemo(() => {
      if (isReverseDirection) {
        return { x: 0, y: -25 }; // Move label up for reverse direction
      }
      return { x: 0, y: 25 }; // Move label down for forward direction
    }, [isReverseDirection]);

    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      curvature: isReverseDirection ? 0.4 : 0.25, // More curve for reverse edges
    });

    // Check for new team-based rules
    const hasTeamRules = 
      (data?.allowedTeamIds && data.allowedTeamIds.length > 0) ||
      (data?.allowedMemberRoles && data.allowedMemberRoles.length > 0);
    
    const hasApproval = data?.requiresApproval;
    
    const hasRules = hasTeamRules || hasApproval;

    return (
      <>
        {/* Invisible wider path for easier hover/selection */}
        {!data?.isPreview && (
          <path
            d={edgePath}
            fill="none"
            strokeWidth={20}
            stroke="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          />
        )}

        {/* Visible edge */}
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            stroke: selected 
              ? "hsl(var(--primary))" 
              : isHovered 
                ? "hsl(var(--primary)/0.7)" 
                : data?.isPreview 
                  ? "hsl(var(--purple-500)/0.4)" 
                  : "hsl(var(--muted-foreground)/0.4)",
            strokeWidth: selected ? 2.5 : isHovered ? 2 : 1.5,
            strokeDasharray: data?.isPreview ? "5,5" : undefined,
            transition: "stroke 0.2s, stroke-width 0.2s",
            opacity: data?.isPreview ? 0.6 : 1,
          }}
          markerEnd={data?.isPreview ? "url(#arrow-preview)" : "url(#arrow)"}
        />

        {/* Arrow marker definition */}
        <defs>
          <marker
            id="arrow"
            markerWidth="12"
            markerHeight="12"
            refX="8"
            refY="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path
              d="M2,2 L10,6 L2,10 L4,6 L2,2"
              fill={selected ? "hsl(var(--primary))" : "hsl(var(--muted-foreground)/0.6)"}
            />
          </marker>
          <marker
            id="arrow-preview"
            markerWidth="12"
            markerHeight="12"
            refX="8"
            refY="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path
              d="M2,2 L10,6 L2,10 L4,6 L2,2"
              fill="hsl(var(--purple-400)/0.5)"
            />
          </marker>
        </defs>

        {/* Edge Label */}
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX + labelOffset.x}px,${labelY + labelOffset.y}px)`,
              pointerEvents: "all",
              zIndex: isHovered || selected ? 10 : 1,
            }}
            className="nodrag nopan"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <Popover>
              <PopoverTrigger asChild>
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-all duration-200",
                    "bg-background border shadow-sm",
                    selected || isHovered
                      ? "border-primary bg-primary/5 scale-105"
                      : data?.isPreview
                        ? "border-purple-200 opacity-80"
                        : "border-border hover:border-primary/50"
                  )}
                >
                  {data?.isPreview && (
                    <Sparkles className="size-3 text-purple-600 flex-shrink-0" />
                  )}
                  {data?.name ? (
                    <>
                      <ArrowRight className="size-3 text-muted-foreground flex-shrink-0" />
                      <span className="max-w-[120px] truncate">{data.name}</span>
                    </>
                  ) : (
                    <ArrowRight className="size-3 text-muted-foreground" />
                  )}
                  {hasTeamRules && (
                    <Users className="size-3 text-blue-500 flex-shrink-0" />
                  )}
                  {hasApproval && (
                    <CheckCircle2 className="size-3 text-green-500 flex-shrink-0" />
                  )}
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="center">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Transition</h4>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => data?.onEdit(data.id)}
                      >
                        <Edit className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => data?.onDelete(data.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>

                  {data?.name && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Name</p>
                      <p className="text-sm">{data.name}</p>
                    </div>
                  )}

                  {data?.description && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Description</p>
                      <p className="text-sm text-muted-foreground">{data.description}</p>
                    </div>
                  )}

                  {/* Team-based Rules Summary */}
                  {hasRules && (
                    <div className="pt-2 border-t space-y-2">
                      <p className="text-xs text-muted-foreground">Rules</p>
                      
                      {data?.allowedTeamIds && data.allowedTeamIds.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Users className="size-3 text-blue-500" />
                          <span className="text-xs">
                            {data.allowedTeamIds.length} team(s) allowed
                          </span>
                        </div>
                      )}
                      
                      {data?.allowedMemberRoles && data.allowedMemberRoles.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Shield className="size-3 text-purple-500" />
                          <span className="text-xs">
                            Roles: {data.allowedMemberRoles.join(", ")}
                          </span>
                        </div>
                      )}
                      
                      {data?.requiresApproval && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="size-3 text-green-500" />
                          <span className="text-xs">
                            Requires approval
                            {data.approverTeamIds && data.approverTeamIds.length > 0 
                              ? ` (${data.approverTeamIds.length} team(s))`
                              : ""
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {!hasRules && !data?.name && !data?.description && (
                    <p className="text-xs text-muted-foreground italic">
                      No rules configured. Click edit to add transition rules.
                    </p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </EdgeLabelRenderer>
      </>
    );
  }
);

TransitionEdge.displayName = "TransitionEdge";
