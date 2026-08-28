import { describe, expect, it } from "vitest";
import { WorkItemType } from "@/features/sprints/types";
import { TimelineZoomLevel } from "../types";
import {
  TYPE_BAR_COLORS,
  computeTimelineExportLayout,
  getTimelineExportFilename,
  getTypeBarColor,
} from "./export-timeline";

describe("getTimelineExportFilename", () => {
  it("formats the timestamp and extension", () => {
    const date = new Date("2026-03-15T09:07:00");

    expect(getTimelineExportFilename("png", date)).toBe("timeline_export_2026-03-15_09-07.png");
    expect(getTimelineExportFilename("pdf", date)).toBe("timeline_export_2026-03-15_09-07.pdf");
    expect(getTimelineExportFilename("csv", date)).toBe("timeline_export_2026-03-15_09-07.csv");
  });
});

describe("getTypeBarColor", () => {
  it("maps every work item type to a hex color", () => {
    expect(TYPE_BAR_COLORS[WorkItemType.EPIC]).toBe("#7c3aed");
    expect(TYPE_BAR_COLORS[WorkItemType.STORY]).toBe("#059669");
    expect(TYPE_BAR_COLORS[WorkItemType.TASK]).toBe("#2563eb");
    expect(TYPE_BAR_COLORS[WorkItemType.BUG]).toBe("#e11d48");
    expect(TYPE_BAR_COLORS[WorkItemType.SUBTASK]).toBe("#0284c7");
    expect(TYPE_BAR_COLORS[WorkItemType.ISSUE]).toBe("#d97706");
  });

  it("returns the mapped color for known types and falls back to TASK", () => {
    expect(getTypeBarColor(WorkItemType.BUG)).toBe("#e11d48");
    expect(getTypeBarColor("UNKNOWN" as WorkItemType)).toBe(TYPE_BAR_COLORS[WorkItemType.TASK]);
  });
});

describe("computeTimelineExportLayout", () => {
  const range = {
    startDate: new Date("2026-01-01T00:00:00"),
    endDate: new Date("2026-01-10T00:00:00"),
  };

  it("keeps full size when the canvas fits the max dimension", () => {
    const layout = computeTimelineExportLayout(2, TimelineZoomLevel.TODAY, range);

    expect(layout.totalDays).toBe(10);
    expect(layout.scale).toBe(1);
    expect(layout.dayWidth).toBe(80);
    expect(layout.labelWidth).toBe(320);
    expect(layout.rowHeight).toBe(36);
    expect(layout.headerHeight).toBe(52);
    expect(layout.titleHeight).toBe(56);
    expect(layout.padding).toBe(20);
    expect(layout.canvasWidth).toBe(1160);
    expect(layout.canvasHeight).toBe(220);
  });

  it("uses at least one row when there are no items", () => {
    const layout = computeTimelineExportLayout(0, TimelineZoomLevel.TODAY, range);

    expect(layout.scale).toBe(1);
    expect(layout.canvasHeight).toBe(184);
  });

  it("scales down uniformly when the unscaled size exceeds maxDimension", () => {
    const layout = computeTimelineExportLayout(2, TimelineZoomLevel.TODAY, range, 500);

    expect(layout.scale).toBeCloseTo(500 / 1160, 6);
    expect(layout.scale).toBeLessThan(1);
    expect(layout.dayWidth).toBeCloseTo(80 * layout.scale, 6);
    expect(layout.labelWidth).toBeCloseTo(320 * layout.scale, 6);
    expect(layout.rowHeight).toBeCloseTo(36 * layout.scale, 6);
    expect(layout.canvasWidth).toBeLessThanOrEqual(500);
    expect(layout.canvasHeight).toBeLessThanOrEqual(500);
    expect(layout.canvasWidth).toBe(Math.ceil(layout.padding * 2 + layout.labelWidth + layout.totalDays * layout.dayWidth));
    expect(layout.canvasHeight).toBe(Math.ceil(layout.padding * 2 + layout.titleHeight + layout.headerHeight + 2 * layout.rowHeight));
  });
});
