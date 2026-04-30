"use client";

import React, { useMemo } from "react";
import { TimelineClient } from "./timeline-client";
import { processTimelineData } from "../server/process-timeline-data";
import { TimelineZoomLevel } from "../types";
import { PopulatedWorkItem, Sprint } from "@/features/sprints/types";
import { PageLoader } from "@/components/page-loader";
import { PageError } from "@/components/page-error";
import { useGetSprints } from "@/features/sprints/api/use-get-sprints";
import { useGetWorkItems } from "@/features/sprints/api/use-get-work-items";

interface TimelineViewProps {
  workspaceId: string;
  projectId?: string;
  initialWorkItems?: { documents: PopulatedWorkItem[], total: number };
  initialSprints?: { documents: Sprint[], total: number };
}

/**
 * Client-side Timeline view wrapper for use in task-view-switcher
 * Fetches timeline data using standardized hooks
 */
export function TimelineView({ workspaceId, projectId, initialWorkItems, initialSprints }: TimelineViewProps) {
  // Fetch sprints using standardized hook
  const { data: fetchedSprintsData, isLoading: isLoadingSprints, error: sprintsError } = useGetSprints({
    workspaceId,
    projectId: projectId || "", // Optional: if empty, gets all sprints in workspace
    enabled: !initialSprints,
  });

  const sprintsData = initialSprints || fetchedSprintsData;

  // Fetch work items using standardized hook
  const { data: fetchedWorkItemsData, isLoading: isLoadingWorkItems, error: workItemsError } = useGetWorkItems({
    workspaceId,
    projectId: projectId || "", // Optional: if empty, gets all work items in workspace
    includeChildren: true,
    enabled: !initialWorkItems,
  });

  const workItemsData = initialWorkItems || fetchedWorkItemsData;

  // Process the data once both are loaded
  const processedData = useMemo(() => {
    if (!sprintsData?.documents || !workItemsData?.documents) return null;

    const timelineData = {
      sprints: sprintsData as unknown as { documents: Sprint[], total: number },
      workItems: workItemsData as unknown as { documents: PopulatedWorkItem[], total: number },
    };

    return processTimelineData(timelineData, TimelineZoomLevel.WEEKS);
  }, [sprintsData, workItemsData]);

  // If no projectId is provided and no initial data, show a message
  if (!projectId && !initialWorkItems) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <PageError message="Please select a project to view the timeline" />
      </div>
    );
  }

  // Loading state
  if (isLoadingSprints || isLoadingWorkItems) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <PageLoader />
      </div>
    );
  }

  // Error state
  if (sprintsError || workItemsError) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <PageError message="Failed to load timeline data" />
      </div>
    );
  }

  // No data state
  if (!processedData || !sprintsData?.documents || !workItemsData?.documents) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <PageError message="No timeline data available" />
      </div>
    );
  }

  // Render the timeline
  return (
    <div className="h-[calc(100vh-200px)]">
      <TimelineClient
        initialData={processedData}
        sprints={sprintsData.documents as Sprint[]}
        workItems={workItemsData.documents as PopulatedWorkItem[]}
        workspaceId={workspaceId}
        projectId={projectId}
        showHeader={false}
      />
    </div>
  );
}
