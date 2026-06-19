import * as LucideIcons from "lucide-react";
import { Layers, FileText, CheckSquare, Bug, ArrowRight, Bookmark, Clipboard, Target, Zap, AlertCircle } from "lucide-react";
import { WorkItemType } from "@/features/sprints/types";
import { Project } from "@/features/projects/types";

interface WorkItemIconProps {
  type: WorkItemType | string;
  className?: string;
  project?: Project;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string, style?: React.CSSProperties }>> = {
  "CheckSquare": CheckSquare,
  "Bookmark": Bookmark,
  "Bug": Bug,
  "Clipboard": Clipboard,
  "FileText": FileText,
  "Target": Target,
  "Zap": Zap,
  "Layers": Layers,
  "ArrowRight": ArrowRight,
  "AlertCircle": AlertCircle,
  "check-square": CheckSquare,
  "bookmark": Bookmark,
  "bug": Bug,
  "clipboard": Clipboard,
  "file-text": FileText,
  "target": Target,
  "zap": Zap,
  "layers": Layers,
  "arrow-right": ArrowRight,
  "alert-circle": AlertCircle,
};

export function WorkItemIcon({ type, className = "h-4 w-4", project }: WorkItemIconProps) {
  // Check for custom type definition first
  if (project?.customWorkItemTypes) {
    const customType = project.customWorkItemTypes.find((t: { key: string }) => t.key === type);
    if (customType) {
      const icons = LucideIcons as unknown as Record<string, LucideIcons.LucideIcon | React.ComponentType<{ className?: string, style?: React.CSSProperties }>>;
      const IconComponent = icons[customType.icon] || ICON_MAP[customType.icon] || CheckSquare;
      return <IconComponent className={className} style={{ color: customType.color }} />;
    }
  }

  // Fallback to default enum behavior
  switch (type) {
    case WorkItemType.EPIC:
      return <Layers className={className} style={{ color: "#8B5CF6" }} />;
    case WorkItemType.STORY:
      return <FileText className={className} style={{ color: "#10B981" }} />;
    case WorkItemType.TASK:
      return <CheckSquare className={className} style={{ color: "#3B82F6" }} />;
    case WorkItemType.BUG:
      return <Bug className={className} style={{ color: "#EF4444" }} />;
    case WorkItemType.SUBTASK:
      return <ArrowRight className={className} style={{ color: "#6B7280" }} />;
    case WorkItemType.ISSUE:
      return <AlertCircle className={className} style={{ color: "#EAB308" }} />;
    default:
      return <CheckSquare className={className} />;
  }
}
