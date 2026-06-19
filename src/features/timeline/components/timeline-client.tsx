"use client";

import React, { useMemo, useRef, useCallback, useTransition, useState } from "react";
import { GripVertical } from "lucide-react";
import { useTimelineState } from "@/features/timeline/hooks/use-timeline-store";
import { useUpdateTimelineItem } from "@/features/timeline/api/use-update-timeline-item";
import { TimelineHeader } from "@/features/timeline/components/timeline-header";
import { TimelineWorkTree } from "@/features/timeline/components/timeline-work-tree";
import { TimelineGrid } from "@/features/timeline/components/timeline-grid";
import { TimelineDetailsPanel } from "@/features/timeline/components/timeline-details-panel";
import {
  filterTimelineItems,
  flattenTimelineItems,
  calculateTimelineRange,
  dateToPixel,
  groupItemsBySprintAndEpic,
} from "@/features/timeline/utils";
import {
  TimelineGridConfig,
  TimelineItem,
  ZOOM_CONFIGS,
  TimelineSprintGroup,
} from "@/features/timeline/types";
import { PopulatedWorkItem, PopulatedSprint } from "@/features/sprints/types";
import { CreateEpicDialog } from "@/features/sprints/components/create-epic-dialog";
import { useGetGitHubReleases } from "@/features/github-integration/api/use-github";

interface TimelineClientProps {
  initialData: {
    allTimelineItems: TimelineItem[];
    sprintGroups: TimelineSprintGroup[];
    flatItems: TimelineItem[];
    gridConfig: TimelineGridConfig;
    epics: TimelineItem[];
    labels: string[];
    expandedItems: string[];
  };
  sprints: PopulatedSprint[];
  workItems: PopulatedWorkItem[];
  workspaceId: string;
  projectId?: string;
  showHeader?: boolean;
}

/**
 * Client-side interactive timeline component
 * Handles user interactions while working with server-provided data
 */
export function TimelineClient({
  initialData,
  sprints,
  workItems,
  workspaceId,
  projectId,
  showHeader = true,
}: TimelineClientProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isCreateEpicDialogOpen, setIsCreateEpicDialogOpen] = useState(false);
  const [workTreeWidth, setWorkTreeWidth] = useState(400);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = workTreeWidth;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.min(Math.max(startWidthRef.current + delta, 200), 700);
      setWorkTreeWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [workTreeWidth]);

  // State management
  const timelineState = useTimelineState();
  const {
    filters,
    setFilters,
    resetFilters,
    zoomLevel,
    setZoomLevel,
    selectedItemId,
    setSelectedItemId,
    expandedItems,
    toggleExpanded,
    collapseAll,
    setExpanded,
  } = timelineState;

  const { mutate: updateItem } = useUpdateTimelineItem();
  const { data: releases } = useGetGitHubReleases(projectId || "", !!projectId);

  // Initialize expanded items from server data
  React.useEffect(() => {
    if (expandedItems.size === 0 && initialData.expandedItems.length > 0) {
      setExpanded(initialData.expandedItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData.expandedItems]);

  // Recompute groups when expansion changes (lightweight client-side operation)
  const sprintGroups = useMemo(() => {
    return groupItemsBySprintAndEpic(sprints, workItems, expandedItems);
  }, [sprints, workItems, expandedItems]);

  // Filter items based on current filters
  const filteredItems = useMemo(() => {
    return filterTimelineItems(initialData.allTimelineItems, filters);
  }, [initialData.allTimelineItems, filters]);

  // Flatten for grid rendering and remove duplicates by id to keep React keys stable
  const flatItems = useMemo(() => {
    const flattened = flattenTimelineItems(sprintGroups);
    const unique = new Map<string, TimelineItem>();

    flattened.forEach((item) => {
      if (!unique.has(item.id)) {
        unique.set(item.id, item);
      }
    });

    return Array.from(unique.values());
  }, [sprintGroups]);

  // Recalculate grid config when zoom changes
  const gridConfig: TimelineGridConfig = useMemo(() => {
    const range = calculateTimelineRange(filteredItems, zoomLevel);
    const config = ZOOM_CONFIGS[zoomLevel];

    return {
      dayWidth: config.dayWidth,
      rowHeight: 48,
      headerHeight: 60,
      minDate: range.startDate,
      maxDate: range.endDate,
    };
  }, [filteredItems, zoomLevel]);

  // Get selected item details - use flatItems (same as grid) for consistent dates
  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return (
      flatItems.find(
        (item: TimelineItem) => item.id === selectedItemId
      ) || null
    );
  }, [selectedItemId, flatItems]);

  // Check if all items are expanded
  const allExpanded = useMemo(() => {
    const allExpandableIds = [
      ...sprints.map((s) => s.$id),
      ...initialData.allTimelineItems.map((i: TimelineItem) => i.id),
    ];
    return allExpandableIds.every((id) => expandedItems.has(id));
  }, [sprints, initialData.allTimelineItems, expandedItems]);

  // Handlers
  const handleToggleExpandAll = useCallback(() => {
    startTransition(() => {
      if (allExpanded) {
        collapseAll();
      } else {
        const allIds = [
          ...sprints.map((s) => s.$id),
          ...initialData.allTimelineItems.map((i: TimelineItem) => i.id),
        ];
        setExpanded(allIds);
      }
    });
  }, [
    allExpanded,
    sprints,
    initialData.allTimelineItems,
    setExpanded,
    collapseAll,
  ]);

  const handleCenterToday = useCallback(() => {
    if (scrollContainerRef.current) {
      const todayX = dateToPixel(new Date(), gridConfig);
      scrollContainerRef.current.scrollLeft =
        todayX - scrollContainerRef.current.clientWidth / 2;
    }
  }, [gridConfig]);

  const handleItemUpdate = useCallback(
    (itemId: string, updates: Record<string, unknown>) => {
      updateItem({
        param: { workItemId: itemId },
        json: updates,
      });
    },
    [updateItem]
  );

  return (
    <div className="h-screen flex flex-col">
      {/* Page Title Header */}
      {showHeader && (
        <div className="border-b bg-background px-6 py-4">
          <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visualize your project timeline and track progress
          </p>
        </div>
      )}

      {/* Timeline Header with Filters */}
      <TimelineHeader
        filters={filters}
        onFiltersChange={setFilters}
        onResetFilters={resetFilters}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        onToggleExpandAll={handleToggleExpandAll}
        allExpanded={allExpanded}
        onCenterToday={handleCenterToday}
        epics={initialData.epics}
        labels={initialData.labels}
        allItems={flatItems}
        onCreateEpic={projectId ? () => setIsCreateEpicDialogOpen(true) : undefined}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Work Tree Sidebar */}
        <TimelineWorkTree
          sprintGroups={sprintGroups}
          selectedItemId={selectedItemId}
          onItemClick={setSelectedItemId}
          onToggleExpanded={toggleExpanded}
          width={workTreeWidth}
        />

        {/* Resize Handle */}
        <div
          onMouseDown={handleResizeStart}
          className="w-1.5 bg-border hover:bg-primary/50 active:bg-primary/50 transition-colors cursor-col-resize flex items-center justify-center group shrink-0"
        >
          <GripVertical className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Timeline Grid */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto bg-muted/10"
        >
          <TimelineGrid
            items={flatItems}
            gridConfig={gridConfig}
            zoomLevel={zoomLevel}
            selectedItemId={selectedItemId}
            onItemClick={setSelectedItemId}
            onItemUpdate={handleItemUpdate}
            scrollContainerRef={scrollContainerRef}
            releases={releases || []}
          />
        </div>

        {/* Details Panel */}
        {selectedItem && (
          <TimelineDetailsPanel
            item={selectedItem}
            onClose={() => setSelectedItemId(null)}
            onUpdate={handleItemUpdate}
          />
        )}
      </div>

      {/* Loading overlay */}
      {isPending && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center pointer-events-none">
          <div className="text-sm text-muted-foreground">Updating...</div>
        </div>
      )}

      {/* Create Epic Dialog - Only if we have a projectId */}
      {workspaceId && projectId && (
        <CreateEpicDialog
          workspaceId={workspaceId}
          projectId={projectId}
          open={isCreateEpicDialogOpen}
          onCloseAction={() => setIsCreateEpicDialogOpen(false)}
        />
      )}
    </div>
  );
}
