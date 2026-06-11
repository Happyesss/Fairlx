import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  TimelineItem,
  TimelineGridConfig,
  TimelineZoomLevel,
  ZOOM_CONFIGS,
  STATUS_COLORS,
  TYPE_COLORS,
  PRIORITY_COLORS,
  DragState,
} from "../types";
import {
  calculateBarPosition,
  dateToPixel,
  formatDateForZoom,
} from "../utils";
import {
  addDays,
  addWeeks,
  addMonths,
  format,
  differenceInDays,
} from "date-fns";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TimelineGridProps {
  items: TimelineItem[];
  gridConfig: TimelineGridConfig;
  zoomLevel: TimelineZoomLevel;
  selectedItemId: string | null;
  onItemClick: (itemId: string) => void;
  onItemUpdate: (itemId: string, updates: { startDate?: string; dueDate?: string }) => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  releases?: Array<{
    $id: string;
    projectId: string;
    tagName: string;
    name: string;
    body: string;
    publishedAt: string;
    htmlUrl: string;
    authorName: string;
  }>;
}

export function TimelineGrid({
  items,
  gridConfig,
  zoomLevel,
  selectedItemId,
  onItemClick,
  onItemUpdate,
  scrollContainerRef,
  releases = [],
}: TimelineGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    itemId: null,
    type: null,
    startX: 0,
    currentX: 0,
  });

  // Calculate total width and height
  const totalDays = differenceInDays(gridConfig.maxDate, gridConfig.minDate) + 1;
  const totalWidth = totalDays * gridConfig.dayWidth;
  const totalHeight = items.length * gridConfig.rowHeight;

  // Center on today when component mounts
  useEffect(() => {
    if (scrollContainerRef?.current) {
      const todayX = dateToPixel(new Date(), gridConfig);
      scrollContainerRef.current.scrollLeft = todayX - scrollContainerRef.current.clientWidth / 2;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle mouse down on bar (start drag)
  const handleBarMouseDown = useCallback(
    (e: React.MouseEvent, item: TimelineItem, type: "move" | "resize-start" | "resize-end") => {
      e.preventDefault();
      e.stopPropagation();

      setDragState({
        isDragging: true,
        itemId: item.id,
        type,
        startX: e.clientX,
        currentX: e.clientX,
        originalStartDate: item.startDate,
        originalEndDate: item.dueDate,
      });
    },
    []
  );

  // Handle mouse move (during drag)
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState.isDragging || !dragState.itemId) return;

      setDragState((prev) => ({
        ...prev,
        currentX: e.clientX,
      }));
    },
    [dragState.isDragging, dragState.itemId]
  );

  // Handle mouse up (end drag)
  const handleMouseUp = useCallback(() => {
    if (!dragState.isDragging || !dragState.itemId) return;

    const item = items.find((i) => i.id === dragState.itemId);
    if (!item || !item.startDate || !item.dueDate) {
      setDragState({
        isDragging: false,
        itemId: null,
        type: null,
        startX: 0,
        currentX: 0,
      });
      return;
    }

    const deltaX = dragState.currentX - dragState.startX;
    const deltaDays = Math.round(deltaX / gridConfig.dayWidth);

    if (Math.abs(deltaDays) === 0) {
      setDragState({
        isDragging: false,
        itemId: null,
        type: null,
        startX: 0,
        currentX: 0,
      });
      return;
    }

    let updates: { startDate?: string; dueDate?: string } = {};

    if (dragState.type === "move") {
      // Move both start and end dates
      const newStartDate = addDays(new Date(item.startDate), deltaDays);
      const newEndDate = addDays(new Date(item.dueDate), deltaDays);
      updates = {
        startDate: format(newStartDate, "yyyy-MM-dd"),
        dueDate: format(newEndDate, "yyyy-MM-dd"),
      };
    } else if (dragState.type === "resize-start") {
      // Only move start date
      const newStartDate = addDays(new Date(item.startDate), deltaDays);
      updates = {
        startDate: format(newStartDate, "yyyy-MM-dd"),
      };
    } else if (dragState.type === "resize-end") {
      // Only move end date
      const newEndDate = addDays(new Date(item.dueDate), deltaDays);
      updates = {
        dueDate: format(newEndDate, "yyyy-MM-dd"),
      };
    }

    onItemUpdate(item.id, updates);

    setDragState({
      isDragging: false,
      itemId: null,
      type: null,
      startX: 0,
      currentX: 0,
    });
  }, [dragState, items, gridConfig, onItemUpdate]);

  // Add/remove mouse event listeners
  useEffect(() => {
    if (dragState.isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={gridRef}
      className="relative bg-background"
      style={{
        width: totalWidth,
        height: totalHeight + gridConfig.headerHeight,
        minWidth: "100%",
      }}
    >
      {/* Time Scale Header */}
      <TimeScaleHeader
        gridConfig={gridConfig}
        zoomLevel={zoomLevel}
      />

      {/* Grid Lines */}
      <GridLines
        gridConfig={gridConfig}
        zoomLevel={zoomLevel}
      />

      {/* Today Marker */}
      <TodayMarker gridConfig={gridConfig} items={items} />

      {/* GitHub Release Markers */}
      {releases.length > 0 && (
        <ReleaseMarkers gridConfig={gridConfig} items={items} releases={releases} />
      )}

      {/* Task Bars */}
      <TooltipProvider>
        {items.map((item, index) => {
          const position = calculateBarPosition(item, gridConfig, index);
          if (!position) return null;

          // Apply drag offset if this item is being dragged
          let adjustedX = position.x;
          let adjustedWidth = position.width;

          if (dragState.isDragging && dragState.itemId === item.id) {
            const deltaX = dragState.currentX - dragState.startX;
            if (dragState.type === "move") {
              adjustedX += deltaX;
            } else if (dragState.type === "resize-start") {
              adjustedX += deltaX;
              adjustedWidth -= deltaX;
            } else if (dragState.type === "resize-end") {
              adjustedWidth += deltaX;
            }
          }

          return (
            <TaskBar
              key={item.id}
              item={item}
              x={adjustedX}
              width={Math.max(adjustedWidth, 40)}
              y={position.y + gridConfig.headerHeight}
              height={gridConfig.rowHeight - 8}
              isSelected={selectedItemId === item.id}
              onClick={() => onItemClick(item.id)}
              onMouseDown={handleBarMouseDown}
            />
          );
        })}
      </TooltipProvider>
    </div>
  );
}

interface TimeScaleHeaderProps {
  gridConfig: TimelineGridConfig;
  zoomLevel: TimelineZoomLevel;
}

function TimeScaleHeader({ gridConfig, zoomLevel }: TimeScaleHeaderProps) {
  const headers: Array<{ label: string; x: number; width: number }> = [];
  let currentDate = gridConfig.minDate;

  const config = ZOOM_CONFIGS[zoomLevel];

  while (currentDate <= gridConfig.maxDate) {
    const label = formatDateForZoom(currentDate, zoomLevel);
    const x = dateToPixel(currentDate, gridConfig);

    let nextDate: Date;
    if (config.unit === "day") {
      nextDate = addDays(currentDate, 1);
    } else if (config.unit === "week") {
      nextDate = addWeeks(currentDate, 1);
    } else {
      nextDate = addMonths(currentDate, 1);
    }

    const width = dateToPixel(nextDate, gridConfig) - x;
    headers.push({ label, x, width });

    currentDate = nextDate;
  }

  return (
    <div
      className="sticky top-0 bg-card border-b z-10 flex"
      style={{ height: gridConfig.headerHeight }}
    >
      {headers.map((header, index) => (
        <div
          key={index}
          className="border-r text-xs text-center py-2 font-medium flex items-center justify-center"
          style={{
            position: "absolute",
            left: header.x,
            width: header.width,
          }}
        >
          {header.label}
        </div>
      ))}
    </div>
  );
}

interface GridLinesProps {
  gridConfig: TimelineGridConfig;
  zoomLevel: TimelineZoomLevel;
}

function GridLines({ gridConfig, zoomLevel }: GridLinesProps) {
  const lines: number[] = [];
  const config = ZOOM_CONFIGS[zoomLevel];

  // Vertical lines
  let currentDate = gridConfig.minDate;
  while (currentDate <= gridConfig.maxDate) {
    const x = dateToPixel(currentDate, gridConfig);
    lines.push(x);

    if (config.unit === "day") {
      currentDate = addDays(currentDate, 1);
    } else if (config.unit === "week") {
      currentDate = addWeeks(currentDate, 1);
    } else {
      currentDate = addMonths(currentDate, 1);
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ top: gridConfig.headerHeight }}>
      {/* Vertical lines */}
      {lines.map((x, index) => (
        <div
          key={`v-${index}`}
          className="absolute top-0 bottom-0 border-l border-border/30"
          style={{ left: x }}
        />
      ))}
    </div>
  );
}

interface TodayMarkerProps {
  gridConfig: TimelineGridConfig;
  items: TimelineItem[];
}

function TodayMarker({ gridConfig, items }: TodayMarkerProps) {
  const todayX = dateToPixel(new Date(), gridConfig);
  const totalHeight = items.length * gridConfig.rowHeight;

  return (
    <div
      className="absolute top-0 w-0.5 bg-blue-600 z-20 pointer-events-none"
      style={{
        left: todayX,
        height: totalHeight + gridConfig.headerHeight,
      }}
    >
      <div className="absolute top-0 -left-6 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
        Today
      </div>
    </div>
  );
}

interface TaskBarProps {
  item: TimelineItem;
  x: number;
  width: number;
  y: number;
  height: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseDown: (e: React.MouseEvent, item: TimelineItem, type: "move" | "resize-start" | "resize-end") => void;
}

function TaskBar({
  item,
  x,
  width,
  y,
  height,
  isSelected,
  onClick,
  onMouseDown,
}: TaskBarProps) {
  // Use TYPE_COLORS for more professional look based on work item type
  const typeStyle = TYPE_COLORS[item.type] || TYPE_COLORS.TASK;
  const priorityStyle = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.MEDIUM;
  const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.TODO;

  // Use different visual treatment based on status
  const isDone = item.status === "DONE";
  const isInProgress = item.status === "IN_PROGRESS";
  const isAssigned = item.status === "ASSIGNED";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "absolute rounded cursor-pointer transition-all group border-l-[3px]",
            typeStyle.bg,
            typeStyle.border,
            isSelected && "ring-2 ring-blue-500 ring-offset-1 z-10",
            isDone && "opacity-70",
            isAssigned && "border-l-rose-500 border-dashed",
            "hover:shadow-lg hover:z-20 hover:scale-[1.02]"
          )}
          style={{
            left: x,
            top: y,
            width,
            height,
          }}
          onClick={onClick}
          onMouseDown={(e) => onMouseDown(e, item, "move")}
        >
          {/* Progress fill for in-progress items */}
          {isInProgress && item.progress > 0 && (
            <div
              className={cn("absolute inset-0 rounded-l transition-all", typeStyle.accent, "opacity-20")}
              style={{ width: `${item.progress}%` }}
            />
          )}

          {/* Priority indicator dot */}
          <div
            className={cn(
              "absolute top-1 right-1 w-1.5 h-1.5 rounded-full",
              priorityStyle.dot,
              item.priority === "URGENT" && "animate-pulse"
            )}
          />

          {/* Content - Professional style with key and title */}
          <div className="absolute inset-0 flex items-center px-2.5 gap-1.5">
            <span className={cn("text-[11px] font-semibold tracking-tight truncate", typeStyle.text)}>
              {item.key}
            </span>
            {width > 80 && (
              <span className="text-[10px] text-white/80 truncate flex-1">
                {item.title}
              </span>
            )}
          </div>

          {/* Done checkmark overlay */}
          {isDone && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/10 rounded">
              <svg
                className="w-4 h-4 text-emerald-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}

          {/* Resize handles - subtle and professional */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-foreground/20 transition-opacity rounded-l"
            onMouseDown={(e) => {
              e.stopPropagation();
              onMouseDown(e, item, "resize-start");
            }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-foreground/20 transition-opacity rounded-r"
            onMouseDown={(e) => {
              e.stopPropagation();
              onMouseDown(e, item, "resize-end");
            }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-mono font-semibold", typeStyle.text)}>{item.key}</span>
            <span className="text-xs text-muted-foreground">{item.type}</span>
          </div>
          <div className="font-medium text-sm">{item.title}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {item.startDate && format(new Date(item.startDate), "MMM d")} - {item.dueDate && format(new Date(item.dueDate), "MMM d, yyyy")}
          </div>
          {/* Filter null assignees to handle deleted users or permission-masked relations */}
          {(() => {
            const validAssignees = item.assignees?.filter(a => a != null && a.name) ?? [];
            return validAssignees.length > 0 ? (
              <div className="text-xs flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {validAssignees.map((a) => a.name).join(", ")}
              </div>
            ) : null;
          })()}
          <div className="flex items-center gap-3 text-xs">
            <span className={cn("px-1.5 py-0.5 rounded", statusStyle.bg, statusStyle.text)}>
              {item.status.replace(/_/g, " ")}
            </span>
            <span className={cn("px-1.5 py-0.5 rounded", priorityStyle.bg, priorityStyle.text)}>
              {item.priority}
            </span>
          </div>
          {isInProgress && (
            <div className="text-xs">
              <div className="flex items-center justify-between mb-1">
                <span>Progress</span>
                <span className="font-medium">{item.progress}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full transition-all", typeStyle.accent)}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface ReleaseMarkersProps {
  gridConfig: TimelineGridConfig;
  items: TimelineItem[];
  releases: Array<{
    $id: string;
    tagName: string;
    name: string;
    publishedAt: string;
    htmlUrl: string;
    body?: string;
  }>;
}

function ReleaseMarkers({ gridConfig, items, releases }: ReleaseMarkersProps) {
  const totalHeight = items.length * gridConfig.rowHeight;

  return (
    <>
      {releases.map((release) => {
        const releaseDate = new Date(release.publishedAt);
        if (releaseDate < gridConfig.minDate || releaseDate > gridConfig.maxDate) {
          return null;
        }

        const x = dateToPixel(releaseDate, gridConfig);

        return (
          <div
            key={release.$id}
            className="absolute top-0 w-0.5 bg-purple-600/40 border-l border-dashed border-purple-500/60 z-20 hover:w-1 hover:bg-purple-600 transition-all group pointer-events-auto cursor-pointer"
            style={{
              left: x,
              height: totalHeight + gridConfig.headerHeight,
            }}
            title={`${release.tagName}: ${release.name || "Release"}`}
            onClick={() => window.open(release.htmlUrl, "_blank")}
          >
            <div className="absolute top-10 -left-12 bg-purple-600 hover:bg-purple-700 text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-bold whitespace-nowrap shadow-sm group-hover:scale-105 transition-transform flex items-center gap-1 z-30">
              🚀 {release.tagName}
            </div>
          </div>
        );
      })}
    </>
  );
}
