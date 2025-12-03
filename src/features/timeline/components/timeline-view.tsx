"use client";

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { TimelineClient } from "./timeline-client";
import { processTimelineData } from "../server/process-timeline-data";
import { TimelineZoomLevel } from "../types";
import { PageLoader } from "@/components/page-loader";
import { PageError } from "@/components/page-error";

interface TimelineViewProps {
  workspaceId: string;
  projectId?: string;
}

/**
 * Client-side Timeline view wrapper for use in task-view-switcher
 * Fetches timeline data on the client and renders the TimelineClient component
 */
export function TimelineView({ workspaceId, projectId }: TimelineViewProps) {
  // Fetch sprints - use enabled to control when query runs
  const { data: sprintsData, isLoading: isLoadingSprints, error: sprintsError } = useQuery({
    queryKey: ["sprints", workspaceId, projectId],
    queryFn: async () => {
      const response = await client.api.sprints.$get({
        query: {
          workspaceId,
          projectId: projectId!,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch sprints");
      }

      const result = await response.json();
      return result.data;
    },
    enabled: !!projectId,
  });

  // Fetch work items - include children for timeline visualization
  const { data: workItemsData, isLoading: isLoadingWorkItems, error: workItemsError } = useQuery({
    queryKey: ["work-items", workspaceId, projectId, "timeline"],
    queryFn: async () => {
      const response = await client.api["work-items"].$get({
        query: {
          workspaceId,
          projectId: projectId!,
          includeChildren: "true",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch work items");
      }

      const result = await response.json();
      return result.data;
    },
    enabled: !!projectId,
  });

  // Process the data once both are loaded
  const processedData = useMemo(() => {
    if (!sprintsData || !workItemsData) return null;

    const timelineData = {
      sprints: sprintsData,
      workItems: workItemsData,
    };

    return processTimelineData(timelineData, TimelineZoomLevel.WEEKS);
  }, [sprintsData, workItemsData]);

  // If no projectId is provided, show a message
  if (!projectId) {
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
  if (!processedData || !sprintsData || !workItemsData) {
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
        sprints={sprintsData.documents}
        workItems={workItemsData.documents}
        workspaceId={workspaceId}
        projectId={projectId}
        showHeader={false}
      />
    </div>
  );
}
