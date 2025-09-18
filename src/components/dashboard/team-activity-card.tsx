"use client";

import { Card } from "@/components/ui/card";

type Activity = {
  id: string;
  author: string;
  role?: string;
  message: string;
  timestamp: string;
};

export function TeamActivityCard({ items }: { items: Activity[] }) {
  return (
    <Card className="bg-neutral-950 border-neutral-900 p-5">
        <p className="text-sm text-neutral-300 mb-3">Team activity</p>
        <div className="space-y-4">
          {items.map((a) => (
            <div key={a.id} className="bg-neutral-900 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>
                  <span className="text-neutral-200 font-medium">{a.author}</span>
                  {a.role ? ` · ${a.role}` : ""}
                </span>
                <span>{a.timestamp}</span>
              </div>
              <p className="text-sm text-neutral-200 mt-1">{a.message}</p>
            </div>
          ))}
        </div>
    </Card>
  );
}


