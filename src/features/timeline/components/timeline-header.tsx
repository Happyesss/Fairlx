import React from "react";
import { Search, ChevronDown, Download, ChevronRight, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TimelineFilters, TimelineZoomLevel, TimelineItem } from "../types";
import { WorkItemType, WorkItemStatus } from "@/features/sprints/types";
import { format } from "date-fns";

interface TimelineHeaderProps {
  filters: TimelineFilters;
  onFiltersChange: (filters: Partial<TimelineFilters>) => void;
  onResetFilters: () => void;
  zoomLevel: TimelineZoomLevel;
  onZoomChange: (level: TimelineZoomLevel) => void;
  onToggleExpandAll: () => void;
  allExpanded: boolean;
  onCenterToday: () => void;
  epics: TimelineItem[];
  labels: string[];
  allItems?: TimelineItem[];
  onCreateEpic?: () => void;
}

export function TimelineHeader({
  filters,
  onFiltersChange,
  onResetFilters,
  zoomLevel,
  onZoomChange,
  onToggleExpandAll,
  allExpanded,
  onCenterToday,
  epics,
  labels,
  allItems = [],
  onCreateEpic,
}: TimelineHeaderProps) {
  const handleExportCSV = () => {
    if (allItems.length === 0) {
      alert("No data to export");
      return;
    }

    // Create CSV content
    const headers = ["Key", "Title", "Type", "Status", "Priority", "Start Date", "Due Date", "Progress", "Assignees", "Labels"];
    const rows = allItems.map(item => [
      item.key,
      `"${item.title.replace(/"/g, '""')}"`, // Escape quotes
      item.type,
      item.status,
      item.priority || "",
      item.startDate ? format(new Date(item.startDate), "yyyy-MM-dd") : "",
      item.dueDate ? format(new Date(item.dueDate), "yyyy-MM-dd") : "",
      `${item.progress}%`,
      item.assignees?.map(a => a.name).join("; ") || "",
      item.labels?.join("; ") || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `timeline_export_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPNG = () => {
    alert("PNG export coming soon! This will capture the timeline as an image.");
  };

  const handleExportPDF = () => {
    alert("PDF export coming soon! This will generate a PDF report.");
  };

  return (
    <div className="border-b bg-white p-4 space-y-4">
      {/* Top Row: Search and Actions */}
      <div className="flex items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title or key..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            className="pl-9"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onCenterToday}
          >
            Today
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onToggleExpandAll}
          >
            {allExpanded ? (
              <>
                <ChevronRight className="h-4 w-4 mr-2" />
                Collapse All
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Expand All
              </>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPNG}>
                Export as PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV}>
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={onCreateEpic}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Epic
          </Button>
        </div>
      </div>

      {/* Bottom Row: Filters and Zoom */}
      <div className="flex items-center gap-3">
        {/* Epic Filter */}
        <Select
          value={filters.epicId || "all"}
          onValueChange={(value) =>
            onFiltersChange({ epicId: value === "all" ? null : value })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Epics" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Epics</SelectItem>
            {epics.map((epic) => (
              <SelectItem key={epic.id} value={epic.id}>
                {epic.key} - {epic.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Type Filter */}
        <Select
          value={filters.type || "ALL"}
          onValueChange={(value) =>
            onFiltersChange({ type: value as WorkItemType | "ALL" })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value={WorkItemType.EPIC}>Epic</SelectItem>
            <SelectItem value={WorkItemType.STORY}>Story</SelectItem>
            <SelectItem value={WorkItemType.TASK}>Task</SelectItem>
            <SelectItem value={WorkItemType.BUG}>Bug</SelectItem>
            <SelectItem value={WorkItemType.SUBTASK}>Subtask</SelectItem>
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={filters.status || "ALL"}
          onValueChange={(value) =>
            onFiltersChange({ status: value as WorkItemStatus | "ALL" })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value={WorkItemStatus.TODO}>To Do</SelectItem>
            <SelectItem value={WorkItemStatus.IN_PROGRESS}>In Progress</SelectItem>
            <SelectItem value={WorkItemStatus.IN_REVIEW}>In Review</SelectItem>
            <SelectItem value={WorkItemStatus.DONE}>Done</SelectItem>
            <SelectItem value={WorkItemStatus.BLOCKED}>Blocked</SelectItem>
          </SelectContent>
        </Select>

        {/* Label Filter */}
        <Select
          value={filters.label || "all"}
          onValueChange={(value) =>
            onFiltersChange({ label: value === "all" ? null : value })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Labels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Labels</SelectItem>
            {labels.map((label) => (
              <SelectItem key={label} value={label}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Reset Filters */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetFilters}
          className="text-muted-foreground"
        >
          Reset Filters
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-2 border rounded-lg p-1">
          <Button
            variant={zoomLevel === TimelineZoomLevel.TODAY ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onZoomChange(TimelineZoomLevel.TODAY)}
            className="text-xs"
          >
            Days
          </Button>
          <Button
            variant={zoomLevel === TimelineZoomLevel.WEEKS ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onZoomChange(TimelineZoomLevel.WEEKS)}
            className="text-xs"
          >
            Weeks
          </Button>
          <Button
            variant={zoomLevel === TimelineZoomLevel.MONTHS ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onZoomChange(TimelineZoomLevel.MONTHS)}
            className="text-xs"
          >
            Months
          </Button>
          <Button
            variant={zoomLevel === TimelineZoomLevel.QUARTERS ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onZoomChange(TimelineZoomLevel.QUARTERS)}
            className="text-xs"
          >
            Quarters
          </Button>
        </div>
      </div>
    </div>
  );
}
