"use client"

import { MySpaceDashboard } from "@/features/tasks/components/my-space-dashboard"
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id"

export default function MySpacePage() {
  const workspaceId = useWorkspaceId()

  if (!workspaceId) {
    return <div className="p-8 text-center">Loading...</div>
  }

  return <MySpaceDashboard />
}
