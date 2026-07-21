import {
  TimelineItem,
  TimelineSprintGroup,
  TimelineEpicGroup,
  TimelineFilters,
  TimelineGridConfig,
  TimelineZoomLevel,
  TimelineDateRange,
} from "./types";
import { PopulatedWorkItem, PopulatedSprint, WorkItemType, WorkItemStatus, WorkItemPriority } from "../sprints/types";
import { differenceInDays, addDays, startOfDay, endOfDay, parseISO, format } from "date-fns";

/**
 * Calculate progress percentage for a work item based on its children
 */
export function calculateProgress(item: PopulatedWorkItem): number {
  if (!item.children || item.children.length === 0) {
    return item.status === "DONE" ? 100 : item.status === "IN_PROGRESS" ? 50 : 0;
  }

  const totalChildren = item.children.length;
  const completedChildren = item.children.filter((child) => child.status === "DONE").length;
  
  return Math.round((completedChildren / totalChildren) * 100);
}

/**
 * Convert PopulatedWorkItem to TimelineItem with calculated fields
 */
export function workItemToTimelineItem(
  item: PopulatedWorkItem,
  level: number = 0,
  expandedItems: Set<string> = new Set(),
  sprint?: { startDate?: string; endDate?: string } | null
): TimelineItem {
  const progress = calculateProgress(item);
  const isExpanded = expandedItems.has(item.$id);

  // Use work item's own startDate/dueDate if available
  // Fall back to sprint dates or calculated defaults only if not set
  let startDate: string | undefined;
  let dueDate: string | undefined;

  if (item.startDate && item.dueDate) {
    // Work item has both start and due dates - use them directly
    startDate = item.startDate;
    dueDate = item.dueDate;
  } else if (item.startDate && !item.dueDate) {
    // Has start date but no due date - calculate due date
    const start = parseISO(item.startDate);
    const estimatedDays = item.estimatedHours ? Math.max(1, Math.ceil(item.estimatedHours / 8)) : 7;
    startDate = item.startDate;
    dueDate = format(addDays(start, estimatedDays), "yyyy-MM-dd");
  } else if (item.dueDate && !item.startDate) {
    // Has due date but no start date - calculate start date
    const due = parseISO(item.dueDate);
    const estimatedDays = item.estimatedHours ? Math.max(1, Math.ceil(item.estimatedHours / 8)) : 7;
    startDate = format(addDays(due, -estimatedDays), "yyyy-MM-dd");
    dueDate = item.dueDate;
  } else if (sprint?.startDate && sprint?.endDate) {
    // No dates on item but item is in a sprint - use sprint dates
    startDate = sprint.startDate;
    dueDate = sprint.endDate;
  } else {
    // No dates and no sprint - use current date + 7 days as default
    const now = new Date();
    const defaultDue = addDays(now, 7);
    const defaultStart = now;
    startDate = format(defaultStart, "yyyy-MM-dd");
    dueDate = format(defaultDue, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  }

  return {
    id: item.$id,
    key: item.key,
    title: item.title,
    type: item.type,
    status: item.status,
    priority: item.priority,
    assigneeIds: item.assigneeIds,
    assignees: item.assignees,
    startDate,
    dueDate,
    estimatedHours: item.estimatedHours,
    labels: item.labels,
    description: item.description,
    progress,
    sprintId: item.sprintId,
    epicId: item.epicId,
    parentId: item.parentId,
    children: isExpanded && item.children ? item.children.map((child) => workItemToTimelineItem(child, level + 1, expandedItems, sprint)) : undefined,
    childrenCount: item.childrenCount || 0,
    isExpanded,
    level,
  };
}

/**
 * Group work items by sprints and epics for the work tree
 */
export function groupItemsBySprintAndEpic(
  sprints: PopulatedSprint[],
  workItems: PopulatedWorkItem[],
  expandedItems: Set<string>
): TimelineSprintGroup[] {
  // First, separate items into scheduled (in sprints) and unscheduled (no sprint)
  const itemsWithoutSprint = workItems.filter((item) => !item.sprintId);
  const itemsWithSprint = workItems.filter((item) => item.sprintId);

  const groups: TimelineSprintGroup[] = [];

  // ALWAYS add "Unscheduled" group if there are ANY work items or no sprints
  // This ensures tasks without sprints are visible
  if (itemsWithoutSprint.length > 0 || sprints.length === 0) {
    const unscheduledEpics = itemsWithoutSprint.filter(
      (item) => item.type === WorkItemType.EPIC
    );

    const epicGroups: TimelineEpicGroup[] = unscheduledEpics.map((epic) => {
      const epicTasks = itemsWithoutSprint.filter((item) => item.epicId === epic.$id);
      
      return {
        epic: workItemToTimelineItem(epic, 1, expandedItems),
        tasks: epicTasks.map((task) => workItemToTimelineItem(task, 2, expandedItems)),
        isExpanded: expandedItems.has(epic.$id),
      };
    });

    // Add standalone tasks (no epic, no sprint)
    const standaloneTasks = itemsWithoutSprint.filter(
      (item) => item.type !== WorkItemType.EPIC && !item.epicId
    );

    // Create a virtual "No Epic" group for standalone tasks (or show it even if empty)
    if (standaloneTasks.length > 0 || (itemsWithoutSprint.length > 0 && epicGroups.length === 0)) {
      epicGroups.push({
        epic: {
          id: 'no-epic-unscheduled',
          key: '',
          title: 'No Epic',
          type: WorkItemType.TASK,
          status: WorkItemStatus.TODO,
          priority: WorkItemPriority.MEDIUM,
          assigneeIds: [],
          progress: 0,
          level: 1,
          isExpanded: expandedItems.has('no-epic-unscheduled'),
        } as TimelineItem,
        tasks: standaloneTasks.map((task) => workItemToTimelineItem(task, 2, expandedItems)),
        isExpanded: expandedItems.has('no-epic-unscheduled'),
      });
    }

    // Only add Unscheduled section if it has content
    if (epicGroups.length > 0) {
      groups.push({
        sprint: {
          $id: 'unscheduled',
          name: 'Unscheduled',
          status: 'PLANNED',
          workspaceId: '',
          $createdAt: '',
          $updatedAt: '',
        } as PopulatedSprint,
        epics: epicGroups,
        isExpanded: expandedItems.has('unscheduled'),
      });
    }
  }

  // Then add regular sprint groups
  const sprintGroups = sprints.map((sprint) => {
    // Get all epics that are physically in this sprint
    const epicsInThisSprint = itemsWithSprint.filter(
      (item) => item.sprintId === sprint.$id && item.type === WorkItemType.EPIC
    );

    // Get all tasks in this sprint (non-epic work items)
    const tasksInThisSprint = itemsWithSprint.filter(
      (item) => item.sprintId === sprint.$id && item.type !== WorkItemType.EPIC
    );

    // Group tasks by their epicId
    const tasksByEpicId = new Map<string | undefined, PopulatedWorkItem[]>();
    
    tasksInThisSprint.forEach((task) => {
      const epicId = task.epicId || undefined;
      if (!tasksByEpicId.has(epicId)) {
        tasksByEpicId.set(epicId, []);
      }
      tasksByEpicId.get(epicId)!.push(task);
    });

    const epicGroups: TimelineEpicGroup[] = [];
    const processedEpicIds = new Set<string>();

    // First, process epics that have tasks in this sprint
    tasksByEpicId.forEach((tasks, epicId) => {
      if (!epicId) {
        // Tasks with no epic - we'll handle these later
        return;
      }

      processedEpicIds.add(epicId);

      // Only render a full epic row when the epic itself belongs to this sprint
      const epicInSprint = epicsInThisSprint.find((item) => item.$id === epicId);

      if (epicInSprint) {
        epicGroups.push({
          epic: workItemToTimelineItem(epicInSprint, 1, expandedItems, sprint),
          tasks: tasks.map((task) => workItemToTimelineItem(task, 2, expandedItems, sprint)),
          isExpanded: expandedItems.has(epicId),
        });
        return;
      }

      // Cross-sprint / unscheduled epic: lightweight label only (no second epic bar)
      const foreignEpic = workItems.find(
        (item) => item.$id === epicId && item.type === WorkItemType.EPIC
      );

      const labelId = `epic-label-${epicId}-${sprint.$id}`;
      epicGroups.push({
        epic: {
          id: labelId,
          key: foreignEpic?.key || "",
          title: foreignEpic?.title || "Epic",
          type: WorkItemType.EPIC,
          status: foreignEpic?.status || WorkItemStatus.TODO,
          priority: foreignEpic?.priority || WorkItemPriority.MEDIUM,
          assigneeIds: [],
          progress: 0,
          level: 1,
          epicId,
          isExpanded: expandedItems.has(labelId) || expandedItems.has(epicId),
          isLabelOnly: true,
        } as TimelineItem,
        tasks: tasks.map((task) => workItemToTimelineItem(task, 2, expandedItems, sprint)),
        isExpanded: expandedItems.has(labelId) || expandedItems.has(epicId),
      });
    });

    // Then, add epics that are in this sprint but have no tasks (standalone epics)
    epicsInThisSprint.forEach((epic) => {
      if (!processedEpicIds.has(epic.$id)) {
        epicGroups.push({
          epic: workItemToTimelineItem(epic, 1, expandedItems, sprint),
          tasks: [],
          isExpanded: expandedItems.has(epic.$id),
        });
      }
    });

    // Finally, add tasks with no epic to "No Epic" group
    const tasksWithoutEpic = tasksByEpicId.get(undefined);
    if (tasksWithoutEpic && tasksWithoutEpic.length > 0) {
      epicGroups.push({
        epic: {
          id: `no-epic-${sprint.$id}`,
          key: '',
          title: 'No Epic',
          type: WorkItemType.TASK,
          status: WorkItemStatus.TODO,
          priority: WorkItemPriority.MEDIUM,
          assigneeIds: [],
          progress: 0,
          level: 1,
          isExpanded: expandedItems.has(`no-epic-${sprint.$id}`),
        } as TimelineItem,
        tasks: tasksWithoutEpic.map((task) => workItemToTimelineItem(task, 2, expandedItems, sprint)),
        isExpanded: expandedItems.has(`no-epic-${sprint.$id}`),
      });
    }

    return {
      sprint,
      epics: epicGroups,
      isExpanded: expandedItems.has(sprint.$id),
    };
  });

  return [...groups, ...sprintGroups];
}

/**
 * Filter timeline items based on current filters
 */
export function filterTimelineItems(items: TimelineItem[], filters: TimelineFilters): TimelineItem[] {
  return items.filter((item) => {
    // Search filter
    if (filters.search && !item.title.toLowerCase().includes(filters.search.toLowerCase()) && !item.key.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }

    // Epic filter
    if (filters.epicId && item.epicId !== filters.epicId && item.id !== filters.epicId) {
      return false;
    }

    // Type filter
    if (filters.type && filters.type !== "ALL" && item.type !== filters.type) {
      return false;
    }

    // Status filter
    if (filters.status && filters.status !== "ALL" && item.status !== filters.status) {
      return false;
    }

    // Label filter
    if (filters.label && (!item.labels || !item.labels.includes(filters.label))) {
      return false;
    }

    // Sprint filter
    if (filters.sprintId && item.sprintId !== filters.sprintId) {
      return false;
    }

    return true;
  });
}

/**
 * Calculate the position and width of a timeline bar
 */
export function calculateBarPosition(
  item: TimelineItem,
  gridConfig: TimelineGridConfig,
  rowIndex: number
): { x: number; width: number; y: number } | null {
  if (!item.dueDate) {
    return null;
  }

  const startDate = item.startDate ? parseISO(item.startDate) : addDays(parseISO(item.dueDate), -7);
  const endDate = parseISO(item.dueDate);

  const daysFromStart = differenceInDays(startDate, gridConfig.minDate);
  const duration = differenceInDays(endDate, startDate) + 1;

  return {
    x: daysFromStart * gridConfig.dayWidth,
    width: Math.max(duration * gridConfig.dayWidth, gridConfig.dayWidth * 0.5), // Minimum half-day width
    y: rowIndex * gridConfig.rowHeight,
  };
}

/**
 * Generate date range for the timeline based on all items
 */
export function calculateTimelineRange(items: TimelineItem[], zoomLevel: TimelineZoomLevel): TimelineDateRange {
  const now = new Date();
  let minDate = startOfDay(addDays(now, -30));
  let maxDate = endOfDay(addDays(now, 90));

  items.forEach((item) => {
    if (item.startDate) {
      const itemStart = parseISO(item.startDate);
      if (itemStart < minDate) minDate = itemStart;
    }
    if (item.dueDate) {
      const itemEnd = parseISO(item.dueDate);
      if (itemEnd > maxDate) maxDate = itemEnd;
    }
  });

  // Add padding based on zoom level
  const padding = zoomLevel === TimelineZoomLevel.TODAY ? 7 : zoomLevel === TimelineZoomLevel.WEEKS ? 14 : 30;
  minDate = addDays(minDate, -padding);
  maxDate = addDays(maxDate, padding);

  return { startDate: minDate, endDate: maxDate };
}

/**
 * Flatten hierarchical timeline items for rendering
 */
export function flattenTimelineItems(groups: TimelineSprintGroup[]): TimelineItem[] {
  const flattened: TimelineItem[] = [];

  groups.forEach((sprintGroup) => {
    if (!sprintGroup.isExpanded) return;

    sprintGroup.epics.forEach((epicGroup) => {
      // Don't add virtual "No Epic" groups or cross-sprint epic labels to the Gantt bars
      const isVirtualGroup = epicGroup.epic.id.startsWith('no-epic-');
      const isLabelOnly = epicGroup.epic.isLabelOnly || epicGroup.epic.id.startsWith('epic-label-');
      
      if (!isVirtualGroup && !isLabelOnly) {
        flattened.push(epicGroup.epic);
      }

      if (epicGroup.isExpanded) {
        epicGroup.tasks.forEach((task) => {
          flattened.push(task);

          if (task.isExpanded && task.children) {
            task.children.forEach((subtask) => {
              flattened.push(subtask);
            });
          }
        });
      }
    });
  });

  return flattened;
}

/**
 * Convert pixel position to date
 */
export function pixelToDate(pixelX: number, gridConfig: TimelineGridConfig): Date {
  const daysFromStart = pixelX / gridConfig.dayWidth;
  return addDays(gridConfig.minDate, Math.round(daysFromStart));
}

/**
 * Convert date to pixel position
 */
export function dateToPixel(date: Date, gridConfig: TimelineGridConfig): number {
  const daysFromStart = differenceInDays(date, gridConfig.minDate);
  return daysFromStart * gridConfig.dayWidth;
}

/**
 * Get all unique labels from timeline items
 */
export function extractLabels(items: TimelineItem[]): string[] {
  const labelsSet = new Set<string>();
  
  items.forEach((item) => {
    if (item.labels) {
      item.labels.forEach((label) => labelsSet.add(label));
    }
  });

  return Array.from(labelsSet).sort();
}

/**
 * Format date for display based on zoom level
 */
export function formatDateForZoom(date: Date, zoomLevel: TimelineZoomLevel): string {
  switch (zoomLevel) {
    case TimelineZoomLevel.TODAY:
      return format(date, "MMM d");
    case TimelineZoomLevel.WEEKS:
      return format(date, "MMM d");
    case TimelineZoomLevel.MONTHS:
      return format(date, "MMM yyyy");
    case TimelineZoomLevel.QUARTERS:
      return format(date, "QQQ yyyy");
    default:
      return format(date, "MMM d");
  }
}
