"use client";

import React, { useMemo, useRef, useCallback, useTransition, useState } from "react";
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
  projectId: string;
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

  // Get selected item details
  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return (
      initialData.allTimelineItems.find(
        (item: TimelineItem) => item.id === selectedItemId
      ) || null
    );
  }, [selectedItemId, initialData.allTimelineItems]);

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
        <div className="border-b bg-white px-6 py-4">
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
        onCreateEpic={() => setIsCreateEpicDialogOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Work Tree Sidebar */}
        <TimelineWorkTree
          sprintGroups={sprintGroups}
          selectedItemId={selectedItemId}
          onItemClick={setSelectedItemId}
          onToggleExpanded={toggleExpanded}
        />

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

      {/* Create Epic Dialog */}
      <CreateEpicDialog
        workspaceId={workspaceId}
        projectId={projectId}
        open={isCreateEpicDialogOpen}
        onCloseAction={() => setIsCreateEpicDialogOpen(false)}
      />
    </div>
  );
}
