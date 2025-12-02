import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrent } from "@/features/auth/queries";
import { getTimelineData } from "@/features/timeline/server/get-timeline-data";
import { processTimelineData } from "@/features/timeline/server/process-timeline-data";
import { TimelineClient } from "@/features/timeline/components/timeline-client";
import { PageLoader } from "@/components/page-loader";
import { PageError } from "@/components/page-error";
import { TimelineZoomLevel } from "@/features/timeline/types";

interface TimelinePageProps {
  searchParams: Promise<{
    workspaceId?: string;
    projectId?: string;
  }>;
}

/**
 * Server-side rendered Timeline page
 * Fetches and processes data on the server to prevent client-side overload
 */
export default async function TimelinePage({
  searchParams,
}: TimelinePageProps) {
  // Verify authentication on the server
  const user = await getCurrent();
  if (!user) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const { workspaceId, projectId } = params;

  if (!workspaceId) {
    return <PageError message="Workspace ID is required" />;
  }

  // Fetch timeline data on the server
  const timelineData = await getTimelineData({ workspaceId, projectId });

  if (!timelineData) {
    return <PageError message="Failed to load timeline data" />;
  }

  // Debug: Log the data to help troubleshoot
  // console.log("Timeline Data Debug:", {
  //   sprintsCount: timelineData.sprints.total,
  //   workItemsCount: timelineData.workItems.total,
  //   firstSprint: timelineData.sprints.documents[0]?.name,
  //   firstWorkItem: timelineData.workItems.documents[0]?.title,
  // });

  // Process data on the server (heavy computation)
  const processedData = processTimelineData(
    timelineData,
    TimelineZoomLevel.WEEKS
  );

  // console.log("Processed Data Debug:", {
  //   sprintGroupsCount: processedData.sprintGroups.length,
  //   flatItemsCount: processedData.flatItems.length,
  //   epicsCount: processedData.epics.length,
  // });

  return (
    <Suspense fallback={<PageLoader />}>
      <TimelineClient
        initialData={processedData}
        sprints={timelineData.sprints.documents}
        workItems={timelineData.workItems.documents}
        workspaceId={workspaceId}
        projectId={projectId || ""}
      />
    </Suspense>
  );
}
