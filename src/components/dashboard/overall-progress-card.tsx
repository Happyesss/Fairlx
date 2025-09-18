"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type OverallProgressProps = {
  completedPercent: number;
  totalProjects: number;
  upcoming: number;
};

export function OverallProgressCard({
  completedPercent,
  totalProjects,
  upcoming,
}: OverallProgressProps) {
  return (
    <Card className="bg-neutral-950 border-neutral-900 p-5">
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-400">Overall Progress</p>
          <button className="text-xs text-neutral-400 hover:text-white">See all</button>
        </div>
        <div className="mt-4">
          <div className="flex items-center gap-3">
            <div className="relative size-24 grid place-items-center">
              <svg viewBox="0 0 36 36" className="size-24">
                <path
                  className="text-neutral-800"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  fill="none"
                  d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-amber-400"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeDasharray={`${completedPercent}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute text-center">
                <p className="text-2xl font-semibold text-white">{completedPercent}%</p>
                <p className="text-[10px] text-neutral-400">completed</p>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>In Progress</span>
                <span>{Math.round(completedPercent)}%</span>
              </div>
              <Progress value={completedPercent} className="h-2 bg-neutral-800" />
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="bg-neutral-900 rounded-md p-2">
                  <p className="text-neutral-400">In Progress</p>
                  <p className="text-white font-medium">{Math.round((completedPercent/100)*totalProjects)}</p>
                </div>
                <div className="bg-neutral-900 rounded-md p-2">
                  <p className="text-neutral-400">Total Projects</p>
                  <p className="text-white font-medium">{totalProjects}</p>
                </div>
                <div className="bg-neutral-900 rounded-md p-2">
                  <p className="text-neutral-400">Upcoming</p>
                  <p className="text-white font-medium">{upcoming}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}


