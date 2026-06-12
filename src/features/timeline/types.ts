import { WorkItemType, WorkItemStatus, WorkItemPriority, PopulatedSprint } from "../sprints/types";

export enum TimelineZoomLevel {
  TODAY = "TODAY",
  WEEKS = "WEEKS",
  MONTHS = "MONTHS",
  QUARTERS = "QUARTERS",
}

export type TimelineFilters = {
  search: string;
  epicId?: string | null;
  type?: WorkItemType | "ALL";
  label?: string | null;
  status?: WorkItemStatus | "ALL";
  sprintId?: string | null;
};

export type TimelineItem = {
  id: string;
  key: string;
  title: string;
  type: WorkItemType;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  assigneeIds: string[];
  assignees?: Array<{
    $id: string;
    name: string;
    email?: string;
    profileImageUrl?: string | null;
  }>;
  startDate?: string;
  dueDate?: string;
  estimatedHours?: number;
  labels?: string[];
  description?: string | null;
  progress: number; // 0-100
  sprintId?: string | null;
  epicId?: string | null;
  parentId?: string | null;
  children?: TimelineItem[];
  childrenCount?: number;
  isExpanded?: boolean;
  level?: number; // Hierarchy depth
};

export type TimelineSprintGroup = {
  sprint: PopulatedSprint;
  epics: TimelineEpicGroup[];
  isExpanded: boolean;
};

export type TimelineEpicGroup = {
  epic: TimelineItem;
  tasks: TimelineItem[];
  isExpanded: boolean;
};

export type TimelineState = {
  filters: TimelineFilters;
  zoomLevel: TimelineZoomLevel;
  selectedItemId: string | null;
  expandedItems: Set<string>;
  selectedItems: Set<string>; // For multi-select
  scrollPosition: number;
  currentDate: Date;
};

export type TimelineBarPosition = {
  startX: number;
  width: number;
  y: number;
};

export type TimelineDateRange = {
  startDate: Date;
  endDate: Date;
};

export type DragState = {
  isDragging: boolean;
  itemId: string | null;
  type: "move" | "resize-start" | "resize-end" | null;
  startX: number;
  currentX: number;
  originalStartDate?: string;
  originalEndDate?: string;
};

export type TimelineGridConfig = {
  dayWidth: number; // Pixels per day
  rowHeight: number; // Pixels per row
  headerHeight: number; // Height of the date header
  minDate: Date;
  maxDate: Date;
};

export const ZOOM_CONFIGS: Record<TimelineZoomLevel, { dayWidth: number; label: string; unit: "day" | "week" | "month" }> = {
  [TimelineZoomLevel.TODAY]: { dayWidth: 80, label: "Today", unit: "day" },
  [TimelineZoomLevel.WEEKS]: { dayWidth: 40, label: "Weeks", unit: "week" },
  [TimelineZoomLevel.MONTHS]: { dayWidth: 20, label: "Months", unit: "month" },
  [TimelineZoomLevel.QUARTERS]: { dayWidth: 6, label: "Quarters", unit: "month" },
};

export const STATUS_COLORS: Record<WorkItemStatus, { bg: string; text: string; border: string }> = {
  [WorkItemStatus.TODO]: { bg: "bg-slate-50", text: "text-slate-700", border: "border-l-slate-400" },
  [WorkItemStatus.IN_PROGRESS]: { bg: "bg-blue-50", text: "text-blue-700", border: "border-l-blue-500" },
  [WorkItemStatus.IN_REVIEW]: { bg: "bg-purple-50", text: "text-purple-700", border: "border-l-purple-500" },
  [WorkItemStatus.DONE]: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-l-emerald-500" },
  [WorkItemStatus.ASSIGNED]: { bg: "bg-rose-50", text: "text-rose-700", border: "border-l-rose-500" },
};

// Professional colors for different work item types
export const TYPE_COLORS: Record<WorkItemType, { bg: string; text: string; border: string; accent: string }> = {
  [WorkItemType.EPIC]: {
    bg: "bg-gradient-to-r from-violet-600/95 via-violet-500/85 to-violet-400/80",
    text: "text-white",
    border: "border border-white/10 border-l-white/60",
    accent: "bg-white/40",
  },
  [WorkItemType.STORY]: {
    bg: "bg-gradient-to-r from-emerald-600/95 via-emerald-500/85 to-emerald-400/80",
    text: "text-white",
    border: "border border-white/10 border-l-white/60",
    accent: "bg-white/40",
  },
  [WorkItemType.TASK]: {
    bg: "bg-gradient-to-r from-blue-600/95 via-blue-500/85 to-blue-400/80",
    text: "text-white",
    border: "border border-white/10 border-l-white/60",
    accent: "bg-white/35",
  },
  [WorkItemType.BUG]: {
    bg: "bg-gradient-to-r from-rose-600/95 via-rose-500/85 to-rose-400/80",
    text: "text-white",
    border: "border border-white/10 border-l-white/60",
    accent: "bg-white/35",
  },
  [WorkItemType.SUBTASK]: {
    bg: "bg-gradient-to-r from-sky-600/95 via-sky-500/85 to-sky-400/80",
    text: "text-white",
    border: "border border-white/10 border-l-white/60",
    accent: "bg-white/35",
  },
  [WorkItemType.ISSUE]: {
    bg: "bg-gradient-to-r from-amber-600/95 via-amber-500/85 to-amber-400/80",
    text: "text-white",
    border: "border border-white/10 border-l-white/60",
    accent: "bg-white/35",
  },
};

// Priority colors for visual indicators
export const PRIORITY_COLORS: Record<WorkItemPriority, { bg: string; text: string; dot: string }> = {
  [WorkItemPriority.LOW]: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
  [WorkItemPriority.MEDIUM]: { bg: "bg-blue-100", text: "text-blue-600", dot: "bg-blue-500" },
  [WorkItemPriority.HIGH]: { bg: "bg-orange-100", text: "text-orange-600", dot: "bg-orange-500" },
  [WorkItemPriority.URGENT]: { bg: "bg-red-100", text: "text-red-600", dot: "bg-red-500" },
};

