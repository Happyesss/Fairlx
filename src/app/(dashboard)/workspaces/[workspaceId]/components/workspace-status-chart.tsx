"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface StatusDataItem {
  name: string;
  count: number;
}

interface WorkspaceStatusChartProps {
  data: StatusDataItem[];
}

const STATUS_COLORS: Record<string, string> = {
  "Done": "#10b981",
  "Completed": "#10b981",
  "In Progress": "#f59e0b",
  "To Do": "#3b82f6",
  "In Review": "#8b5cf6",
  "Assigned": "#ec4899",
  "Backlog": "#6b7280",
};

const FALLBACK_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#6b7280"];

export const WorkspaceStatusChart = ({ data }: WorkspaceStatusChartProps) => {
  const total = useMemo(() => data.reduce((sum, item) => sum + item.count, 0), [data]);

  const chartData = useMemo(
    () =>
      data
        .filter((item) => item.count > 0)
        .map((item, i) => ({
          ...item,
          fill: STATUS_COLORS[item.name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
          percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
        })),
    [data, total]
  );

  if (!chartData.length) {
    return (
      <div className="h-[260px] flex flex-col items-center justify-center text-sm text-muted-foreground">
        <div className="h-16 w-16 rounded-full border-4 border-dashed border-muted mb-3" />
        <p>No status data available</p>
      </div>
    );
  }

  const completionPct = total > 0
    ? Math.round(((chartData.find(d => d.name === "Done" || d.name === "Completed")?.count || 0) / total) * 100)
    : 0;

  return (
    <div className="flex flex-col items-center">
      <div className="h-[200px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={85}
              paddingAngle={3}
              dataKey="count"
              strokeWidth={0}
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                color: 'hsl(var(--foreground))',
              }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number, name: string) => [`${value} tasks`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{completionPct}%</p>
            <p className="text-[10px] text-muted-foreground">Complete</p>
          </div>
        </div>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.fill }}
            />
            <span className="text-xs text-muted-foreground">
              {item.name} <span className="font-medium text-foreground">{item.percentage}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
