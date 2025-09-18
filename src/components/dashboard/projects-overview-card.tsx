"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type ProjectSummary = {
  id: string;
  title: string;
  progress: number;
  members?: { id: string; avatarUrl?: string; name: string }[];
};

type ProjectsOverviewProps = {
  ongoing: ProjectSummary[];
  pending: ProjectSummary[];
};

export function ProjectsOverviewCard({ ongoing, pending }: ProjectsOverviewProps) {
  return (
    <Card className="bg-neutral-950 border-neutral-900 p-5">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <span className="text-xs bg-neutral-900 px-2 py-1 rounded-full text-neutral-300">Ongoing</span>
            <span className="text-xs bg-neutral-900 px-2 py-1 rounded-full text-neutral-500">Pending</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...ongoing, ...pending].map((p) => (
            <div key={p.id} className="bg-neutral-900 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-200">{p.title}</p>
                <button className="text-xs text-amber-400">View project</button>
              </div>
              <div className="mt-3">
                <Progress value={p.progress} className="h-2 bg-neutral-800" />
                <div className="mt-1 text-right text-[10px] text-neutral-400">{p.progress}%</div>
              </div>
            </div>
          ))}
        </div>
    </Card>
  );
}


