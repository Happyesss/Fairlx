"use client";

import { Card } from "@/components/ui/card";
import { Task } from "@/features/tasks/types";
import Link from "next/link";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

export function ProjectTasksCard({ tasks }: { tasks: Task[] }) {
  const workspaceId = useWorkspaceId();
  return (
    <Card className="bg-neutral-950 border-neutral-900 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-300">Project Tasks</p>
          <Link href={`/workspaces/${workspaceId}/tasks`} className="text-xs text-neutral-400 hover:text-white">See all</Link>
        </div>
        <ul className="mt-3 space-y-2">
          {tasks.slice(0,6).map((t) => (
            <li key={t.$id} className="bg-neutral-900 rounded-lg p-3 text-sm text-neutral-200">
              <div className="flex items-center justify-between">
                <span className="truncate">{t.name}</span>
                <span className="text-neutral-400 text-xs">{t.project?.name || "—"}</span>
              </div>
            </li>
          ))}
          {tasks.length === 0 && (
            <li className="text-xs text-neutral-500">No tasks found</li>
          )}
        </ul>
    </Card>
  );
}


