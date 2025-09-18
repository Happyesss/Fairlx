"use client";

import React, { useEffect, useState } from "react";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Card } from "@/components/ui/card";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type SeriesPoint = { name: string; value: number };

export function PerformanceAnalytics({ data }: { data: SeriesPoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Card className="bg-neutral-950 border-neutral-900 p-5">
      <p className="text-sm text-neutral-300 mb-3">Performance & Analytics</p>
      {mounted ? (
        <ChartContainer
          config={{ value: { label: "Tasks" } }}
          className="h-64 w-full"
        >
          <ResponsiveContainer>
            <LineChart data={data}>
              <XAxis dataKey="name" stroke="#666" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#666" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <ChartLegend content={<ChartLegendContent />} />
          <ChartTooltip />
        </ChartContainer>
      ) : (
        <div className="h-64 w-full" />
      )}
    </Card>
  );
}


