"use client";

import { Crown, Star, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SpaceRole, getSpaceRoleDisplay } from "../types";

interface SpaceRoleBadgeProps {
  role: SpaceRole;
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const SpaceRoleBadge = ({ 
  role, 
  showTooltip = true,
  size = "md",
  className 
}: SpaceRoleBadgeProps) => {
  const { label, description } = getSpaceRoleDisplay(role);

  const sizeClasses = {
    sm: "text-[9px] h-4 px-1.5 gap-0.5",
    md: "text-[10px] h-5 px-2 gap-1",
    lg: "text-xs h-6 px-2.5 gap-1.5",
  };

  const iconSizes = {
    sm: "size-2",
    md: "size-2.5",
    lg: "size-3",
  };

  const getIcon = () => {
    switch (role) {
      case SpaceRole.ADMIN:
        return <Crown className={iconSizes[size]} />;
      case SpaceRole.MEMBER:
        return <Star className={iconSizes[size]} />;
      case SpaceRole.VIEWER:
        return <Shield className={iconSizes[size]} />;
      default:
        return null;
    }
  };

  const badge = (
    <Badge 
      variant="outline"
      className={cn(
        "font-semibold border-0 shadow-sm",
        sizeClasses[size],
        role === SpaceRole.ADMIN && "bg-amber-500 text-white",
        role === SpaceRole.MEMBER && "bg-blue-500 text-white",
        role === SpaceRole.VIEWER && "bg-slate-500 text-white",
        className
      )}
    >
      {getIcon()}
      {label}
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs font-medium">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Simple Master Badge without shimmer
interface MasterBadgeProps {
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const MasterBadge = ({ 
  showTooltip = true,
  size = "md",
  className 
}: MasterBadgeProps) => {
  const sizeClasses = {
    sm: "text-[9px] font-medium h-5 px-2 gap-1 rounded-sm",
    md: "text-[10px] h-6 px-2.5 gap-1.5 rounded-md",
    lg: "text-xs h-7 px-3 gap-2 rounded-lg",
  };

  const iconSizes = {
    sm: "size-2.5",
    md: "size-3",
    lg: "size-3.5",
  };

  const badge = (
    <Badge 
      variant="outline"
      className={cn(
        "font-bold border-0 shadow-sm",
        sizeClasses[size],
        "bg-blue-600 text-white",
        className
      )}
    >
      <Crown className={iconSizes[size]} />
      <span className="tracking-wide">MASTER</span>
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="text-xs font-semibold flex items-center gap-1">
              <Crown className="size-3 text-purple-600" />
              Space Master
            </p>
            <p className="text-xs text-muted-foreground">
              Full control over this space including teams, projects, and all settings.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default SpaceRoleBadge;
