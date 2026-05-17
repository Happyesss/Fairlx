"use client";

import { useMemo } from "react";
import { 
  Circle, 
  Clock, 
  CheckCircle2, 
  Folder,
  AlertTriangle,
  Link as LinkIcon,
  Unlink,
  GripVertical,
  Play,
  Flag,
  Layers,
  ArrowDownRight,
  RefreshCw,
  Archive,
  AlertCircle,
  XCircle,
  Star,
  Zap,
  Target,
  Rocket,
  Bug,
  Lightbulb,
  Bookmark,
  MessageCircle,
  Eye,
  Search,
  Settings,
  Users,
  Shield,
  Lock,
  Unlock,
  Heart,
  ThumbsUp,
  Send,
  FileText,
  Package,
  Code,
  GitBranch,
  Pause,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

import { 
  PopulatedWorkflow, 
  WorkflowStatus, 
  StatusType,
  STATUS_TYPE_CONFIG 
} from "../types";
import { Project } from "@/features/projects/types";

// Icon mapping for dynamic icon loading
const ICON_MAP: Record<string, LucideIcon> = {
  "circle": Circle,
  "check-circle": CheckCircle2,
  "clock": Clock,
  "play": Play,
  "pause": Pause,
  "alert-circle": AlertCircle,
  "x-circle": XCircle,
  "archive": Archive,
  "flag": Flag,
  "star": Star,
  "zap": Zap,
  "target": Target,
  "rocket": Rocket,
  "bug": Bug,
  "lightbulb": Lightbulb,
  "bookmark": Bookmark,
  "message-circle": MessageCircle,
  "eye": Eye,
  "search": Search,
  "settings": Settings,
  "users": Users,
  "shield": Shield,
  "lock": Lock,
  "unlock": Unlock,
  "heart": Heart,
  "thumbs-up": ThumbsUp,
  "send": Send,
  "file-text": FileText,
  "folder": Folder,
  "package": Package,
  "code": Code,
  "git-branch": GitBranch,
  "refresh-cw": RefreshCw,
};

const getIconComponent = (iconName?: string): LucideIcon => {
  if (!iconName) return Circle;
  return ICON_MAP[iconName] || Circle;
};

interface WorkflowSimpleViewProps {
  workflow: PopulatedWorkflow;
  projects: Project[];
  workspaceId: string;
  spaceId?: string;
  isAdmin?: boolean;
  onConnectProject?: () => void;
  onDisconnectProject?: (projectId: string) => void;
  onSyncFromProject?: (projectId: string) => void;
  isSyncing?: boolean;
  onDragStatusStart?: (status: WorkflowStatus) => void;
  onRemoveStatus?: (statusId: string) => void;
}

// Check for conflicts between workflow statuses and project
interface StatusConflict {
  projectId: string;
  projectName: string;
  missingInWorkflow: string[];
  extraInWorkflow: string[];
}

const detectStatusConflicts = (
  workflow: PopulatedWorkflow,
  projects: Project[]
): StatusConflict[] => {
  if (!workflow.statuses || workflow.statuses.length === 0) return [];

  const workflowStatusKeys = workflow.statuses.map(s => s.key);
  const conflicts: StatusConflict[] = [];

  for (const project of projects) {
    if (project.workflowId !== workflow.$id) continue;

    const missingInWorkflow: string[] = [];
    const extraInWorkflow: string[] = [];

    // Placeholder for future status conflict detection with customWorkItemTypes

    if (missingInWorkflow.length > 0 || extraInWorkflow.length > 0) {
      conflicts.push({
        projectId: project.$id,
        projectName: project.name,
        missingInWorkflow,
        extraInWorkflow,
      });
    }
  }

  void workflowStatusKeys;
  return conflicts;
};

export const WorkflowSimpleView = ({
  workflow,
  projects,
  workspaceId,
  spaceId: _spaceId,
  isAdmin = false,
  onConnectProject,
  onDisconnectProject,
  onSyncFromProject,
  isSyncing = false,
  onDragStatusStart,
  onRemoveStatus: _onRemoveStatus,
}: WorkflowSimpleViewProps) => {
  void _spaceId;
  void _onRemoveStatus; // Used by parent, not directly in this component

  // Group statuses by status type - only show statuses NOT yet placed on canvas
  const statusesByType = useMemo(() => {
    const groups: Record<StatusType, WorkflowStatus[]> = {
      [StatusType.OPEN]: [],
      [StatusType.IN_PROGRESS]: [],
      [StatusType.CLOSED]: [],
    };
    
    for (const status of workflow.statuses || []) {
      // Only show statuses that don't have canvas positions yet
      // If positionX and positionY are 0 or undefined, show them
      const hasCanvasPosition = (status.positionX && status.positionX > 0) || (status.positionY && status.positionY > 0);
      
      if (!hasCanvasPosition && groups[status.statusType]) {
        groups[status.statusType].push(status);
      }
    }
    
    // Sort each group by position
    Object.keys(groups).forEach(key => {
      groups[key as StatusType].sort((a, b) => a.position - b.position);
    });
    
    return groups;
  }, [workflow.statuses]);

  // Find projects connected to this workflow
  const connectedProjects = useMemo(() => 
    projects.filter(p => p.workflowId === workflow.$id),
    [projects, workflow.$id]
  );

  // Detect conflicts
  const conflicts = useMemo(() => 
    detectStatusConflicts(workflow, projects),
    [workflow, projects]
  );

  const hasStatuses = (workflow.statuses?.length || 0) > 0;

  // Handle drag start for a status
  const handleDragStart = (e: React.DragEvent, status: WorkflowStatus) => {
    e.dataTransfer.setData("application/reactflow", JSON.stringify({
      type: "statusNode",
      status: status,
    }));
    e.dataTransfer.effectAllowed = "move";
    onDragStatusStart?.(status);
  };

  const statusTypeConfig = [
    { 
      key: StatusType.OPEN, 
      label: "Open", 
      icon: Circle,
      gradient: "from-slate-500/20 to-slate-600/10",
      borderColor: "border-slate-400/30",
      iconColor: "text-slate-500",
      bgHover: "hover:bg-slate-500/10",
      description: "Work not started"
    },
    { 
      key: StatusType.IN_PROGRESS, 
      label: "In Progress", 
      icon: Clock,
      gradient: "from-blue-500/20 to-blue-600/10",
      borderColor: "border-blue-400/30",
      iconColor: "text-blue-500",
      bgHover: "hover:bg-blue-500/10",
      description: "Work in progress"
    },
    { 
      key: StatusType.CLOSED, 
      label: "Closed", 
      icon: CheckCircle2,
      gradient: "from-emerald-500/20 to-emerald-600/10",
      borderColor: "border-emerald-400/30",
      iconColor: "text-emerald-500",
      bgHover: "hover:bg-emerald-500/10",
      description: "Completed work"
    },
  ];

  return (
    <div className="space-y-4">

      {/* Statuses Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Statuses</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {workflow.statuses?.length || 0}
          </Badge>
        </div>

        {hasStatuses ? (
          <div className="space-y-3">
            {statusTypeConfig.map(({ key, label, icon: TypeIcon, gradient, borderColor, iconColor, description }) => {
              const statuses = statusesByType[key];
              if (statuses.length === 0) return null;

              return (
                <div key={key} className="space-y-2">
                  {/* Status Type Header */}
                  <div className="flex items-center gap-2 px-1">
                    <TypeIcon className={`size-3.5 ${iconColor}`} />
                    <span className="text-xs font-medium text-muted-foreground">{label}</span>
                    <span className="text-[10px] text-muted-foreground/70">({statuses.length})</span>
                  </div>
                  
                  {/* Status Cards */}
                  <div className="space-y-1.5">
                    {statuses.map((status) => {
                      const StatusIcon = getIconComponent(status.icon);
                      return (
                      <TooltipProvider key={status.$id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              draggable
                              onDragStart={(e) => handleDragStart(e, status)}
                              className={`
                                group relative flex items-center gap-2.5 p-2.5 rounded-lg
                                bg-gradient-to-r ${gradient} ${borderColor}
                                border cursor-grab active:cursor-grabbing
                                transition-all duration-200
                                hover:shadow-md hover:scale-[1.02] hover:border-primary/40
                                active:scale-[0.98]
                              `}
                            >
                              {/* Drag Handle */}
                              <div className="opacity-40 group-hover:opacity-100 transition-opacity">
                                <GripVertical className="size-3.5 text-muted-foreground" />
                              </div>
                              
                              {/* Status Icon */}
                              <div 
                                className="size-6 rounded-md flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${status.color}20` }}
                              >
                                <StatusIcon className="size-3.5" style={{ color: status.color }} />
                              </div>
                              
                              {/* Status Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-medium truncate">
                                    {status.name}
                                  </span>
                                  {status.isInitial && (
                                    <Play className="size-3 text-green-500 fill-green-500" />
                                  )}
                                  {status.isFinal && (
                                    <Flag className="size-3 text-emerald-500 fill-emerald-500" />
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {status.key}
                                </span>
                              </div>

                              {/* Drag hint on hover */}
                              <ArrowDownRight className="size-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-[200px]">
                            <div className="space-y-1">
                              <p className="font-medium">{status.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {status.description || description}
                              </p>
                              <div className="flex flex-wrap items-center gap-1 pt-1 border-t">
                                <Badge variant="outline" className="text-[10px]">
                                  {STATUS_TYPE_CONFIG[status.statusType]?.label}
                                </Badge>
                                {status.isInitial && (
                                  <Badge className="text-[10px] bg-green-500/10 text-green-600 hover:bg-green-500/20 border-0">
                                    Start
                                  </Badge>
                                )}
                                {status.isFinal && (
                                  <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-0">
                                    End
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )})}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 px-4 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30">
            <Circle className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground text-center">
              No statuses yet
            </p>
            <p className="text-xs text-muted-foreground/70 text-center mt-1">
              Click &quot;Add Status&quot; to create your first status
            </p>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/50" />
        </div>
      </div>

      {/* Connected Projects Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Projects</span>
            <Badge variant="secondary" className="text-[10px] rounded-full px-1.5 py-0.5 h-4">
              {connectedProjects.length}
            </Badge>
          </div>
          {isAdmin && onConnectProject && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="size-7"
                    onClick={onConnectProject}
                  >
                    <LinkIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent size="xs" side="left" sideOffset={8}>Connect a project</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {connectedProjects.length > 0 ? (
          <div className="space-y-1.5 pl-3">
            {connectedProjects.map((project) => {
              const projectConflict = conflicts.find(c => c.projectId === project.$id);
              
              return (
                <Link 
                  key={project.$id}
                  href={`/workspaces/${workspaceId}/projects/${project.$id}`}
                  className="group flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div 
                    className="size-6 rounded-md flex items-center justify-center text-white font-medium text-xs shadow-sm"
                    style={{ backgroundColor: project.color || "#6366f1" }}
                  >
                    {project.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-regular truncate   transition-colors">
                        {project.name}
                      </span>
                      {projectConflict && (
                        <AlertTriangle className="size-3 text-amber-500" />
                      )}
                    </div>
                    {project.key && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {project.key}
                      </span>
                    )}
                  </div>
                  {isAdmin && onSyncFromProject && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-primary transition-colors"
                            disabled={isSyncing}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onSyncFromProject(project.$id);
                            }}
                          >
                            <RefreshCw className={`size-3 ${isSyncing ? 'animate-spin' : ''}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent size="xs" side="left" sideOffset={8}>Sync statuses from project</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {isAdmin && onDisconnectProject && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-destructive transition-colors"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onDisconnectProject(project.$id);
                            }}
                          >
                            <Unlink className="size-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent size="xs" side="left" sideOffset={8}>Disconnect</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 px-4 rounded-xl border border-dashed border-muted-foreground/20 bg-muted/20">
            <Folder className="size-6 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground text-center">
              No projects connected
            </p>
            {isAdmin && onConnectProject && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-7 mt-2"
                onClick={onConnectProject}
              >
                Connect a project
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Conflict Alerts */}
      {conflicts.length > 0 && (
        <Alert variant="destructive" className="text-xs">
          <AlertTriangle className="h-3.5 w-3.5" />
          <AlertTitle className="text-xs font-medium">Status Conflicts</AlertTitle>
          <AlertDescription className="text-xs">
            {conflicts.length} project(s) have status mismatches with this workflow.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
