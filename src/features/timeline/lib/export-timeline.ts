"use client";

import { format, differenceInDays, addDays, addWeeks, addMonths } from "date-fns";
import { WorkItemStatus, WorkItemType } from "@/features/sprints/types";
import {
  TimelineGridConfig,
  TimelineItem,
  TimelineZoomLevel,
  ZOOM_CONFIGS,
} from "../types";
import { calculateBarPosition, calculateTimelineRange, formatDateForZoom } from "../utils";

export const TYPE_BAR_COLORS: Record<WorkItemType, string> = {
  [WorkItemType.EPIC]: "#7c3aed",
  [WorkItemType.STORY]: "#059669",
  [WorkItemType.TASK]: "#2563eb",
  [WorkItemType.BUG]: "#e11d48",
  [WorkItemType.SUBTASK]: "#0284c7",
  [WorkItemType.ISSUE]: "#d97706",
};

const LABEL_WIDTH = 320;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 52;
const TITLE_HEIGHT = 56;
const PADDING = 20;
const MAX_CANVAS_DIMENSION = 8192;

export type TimelineExportLayout = {
  labelWidth: number;
  dayWidth: number;
  rowHeight: number;
  headerHeight: number;
  titleHeight: number;
  padding: number;
  totalDays: number;
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
  minDate: Date;
  maxDate: Date;
};

export function getTimelineExportFilename(
  extension: "png" | "pdf" | "csv",
  date: Date = new Date()
): string {
  return `timeline_export_${format(date, "yyyy-MM-dd_HH-mm")}.${extension}`;
}

export function getTypeBarColor(type: WorkItemType): string {
  return TYPE_BAR_COLORS[type] ?? TYPE_BAR_COLORS[WorkItemType.TASK];
}

export function buildExportGridConfig(
  items: TimelineItem[],
  zoomLevel: TimelineZoomLevel
): TimelineGridConfig {
  const range = calculateTimelineRange(items, zoomLevel);
  const zoom = ZOOM_CONFIGS[zoomLevel];

  return {
    dayWidth: zoom.dayWidth,
    rowHeight: ROW_HEIGHT,
    headerHeight: HEADER_HEIGHT,
    minDate: range.startDate,
    maxDate: range.endDate,
  };
}

export function computeTimelineExportLayout(
  itemCount: number,
  zoomLevel: TimelineZoomLevel,
  range: { startDate: Date; endDate: Date },
  maxDimension = MAX_CANVAS_DIMENSION
): TimelineExportLayout {
  const zoom = ZOOM_CONFIGS[zoomLevel];
  const totalDays = Math.max(1, differenceInDays(range.endDate, range.startDate) + 1);

  const unscaledWidth = PADDING * 2 + LABEL_WIDTH + totalDays * zoom.dayWidth;
  const unscaledHeight = PADDING * 2 + TITLE_HEIGHT + HEADER_HEIGHT + Math.max(itemCount, 1) * ROW_HEIGHT;
  const scale = Math.min(1, maxDimension / unscaledWidth, maxDimension / unscaledHeight);

  const dayWidth = zoom.dayWidth * scale;
  const labelWidth = LABEL_WIDTH * scale;
  const rowHeight = ROW_HEIGHT * scale;
  const headerHeight = HEADER_HEIGHT * scale;
  const titleHeight = TITLE_HEIGHT * scale;
  const padding = PADDING * scale;

  return {
    labelWidth,
    dayWidth,
    rowHeight,
    headerHeight,
    titleHeight,
    padding,
    totalDays,
    canvasWidth: Math.ceil(padding * 2 + labelWidth + totalDays * dayWidth),
    canvasHeight: Math.ceil(padding * 2 + titleHeight + headerHeight + Math.max(itemCount, 1) * rowHeight),
    scale,
    minDate: range.startDate,
    maxDate: range.endDate,
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to encode canvas"));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;

  const ellipsis = "…";
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (ctx.measureText(`${text.slice(0, mid)}${ellipsis}`).width <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low === 0 ? ellipsis : `${text.slice(0, low)}${ellipsis}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function statusLabel(status: WorkItemStatus): string {
  return status.replace(/_/g, " ");
}

function drawDateHeaders(
  ctx: CanvasRenderingContext2D,
  layout: TimelineExportLayout,
  zoomLevel: TimelineZoomLevel,
  gridOriginX: number,
  headerY: number
) {
  const { unit } = ZOOM_CONFIGS[zoomLevel];
  const fontSize = Math.max(9, 11 * layout.scale);
  ctx.font = `${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = "#525252";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  let current = layout.minDate;
  const addFn = unit === "day" ? addDays : unit === "week" ? addWeeks : addMonths;
  const step = unit === "month" && zoomLevel === TimelineZoomLevel.QUARTERS ? 3 : 1;

  while (current <= layout.maxDate) {
    const offsetDays = differenceInDays(current, layout.minDate);
    const x = gridOriginX + offsetDays * layout.dayWidth;
    const label = formatDateForZoom(current, zoomLevel);
    ctx.fillText(label, x + 6 * layout.scale, headerY + layout.headerHeight / 2);

    ctx.strokeStyle = "#e5e5e5";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, headerY);
    ctx.lineTo(x, layout.canvasHeight - layout.padding);
    ctx.stroke();

    current = addFn(current, step);
  }
}

export function renderTimelineCanvas(
  items: TimelineItem[],
  zoomLevel: TimelineZoomLevel,
  exportedAt: Date = new Date()
): HTMLCanvasElement {
  if (typeof document === "undefined") {
    throw new Error("Timeline export requires a browser");
  }

  const range = calculateTimelineRange(items, zoomLevel);
  const layout = computeTimelineExportLayout(items.length, zoomLevel, range);
  const gridConfig: TimelineGridConfig = {
    dayWidth: layout.dayWidth,
    rowHeight: layout.rowHeight,
    headerHeight: layout.headerHeight,
    minDate: layout.minDate,
    maxDate: layout.maxDate,
  };

  const canvas = document.createElement("canvas");
  canvas.width = layout.canvasWidth;
  canvas.height = layout.canvasHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create canvas context");
  }

  const gridOriginX = layout.padding + layout.labelWidth;
  const headerY = layout.padding + layout.titleHeight;
  const rowsY = headerY + layout.headerHeight;
  const ganttWidth = layout.totalDays * layout.dayWidth;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, layout.canvasWidth, layout.canvasHeight);

  ctx.fillStyle = "#0a0a0a";
  ctx.font = `bold ${Math.max(14, 18 * layout.scale)}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Timeline Export", layout.padding, layout.padding + layout.titleHeight / 2 - 8 * layout.scale);

  ctx.fillStyle = "#737373";
  ctx.font = `${Math.max(10, 12 * layout.scale)}px Arial, Helvetica, sans-serif`;
  ctx.fillText(
    `${format(exportedAt, "PPpp")}  ·  ${ZOOM_CONFIGS[zoomLevel].label}  ·  ${items.length} item${items.length === 1 ? "" : "s"}`,
    layout.padding,
    layout.padding + layout.titleHeight / 2 + 12 * layout.scale
  );

  ctx.fillStyle = "#fafafa";
  ctx.fillRect(layout.padding, headerY, layout.labelWidth + ganttWidth, layout.headerHeight);

  ctx.fillStyle = "#171717";
  ctx.font = `bold ${Math.max(10, 12 * layout.scale)}px Arial, Helvetica, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText("Work item", layout.padding + 12 * layout.scale, headerY + layout.headerHeight / 2);

  drawDateHeaders(ctx, layout, zoomLevel, gridOriginX, headerY);

  const todayX = gridOriginX + differenceInDays(new Date(), layout.minDate) * layout.dayWidth;
  if (todayX >= gridOriginX && todayX <= gridOriginX + ganttWidth) {
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = Math.max(1, 1.5 * layout.scale);
    ctx.beginPath();
    ctx.moveTo(todayX, headerY);
    ctx.lineTo(todayX, layout.canvasHeight - layout.padding);
    ctx.stroke();
  }

  items.forEach((item, index) => {
    const y = rowsY + index * layout.rowHeight;
    ctx.fillStyle = index % 2 === 0 ? "#ffffff" : "#fafafa";
    ctx.fillRect(layout.padding, y, layout.labelWidth + ganttWidth, layout.rowHeight);

    ctx.strokeStyle = "#f0f0f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(layout.padding, y + layout.rowHeight);
    ctx.lineTo(layout.padding + layout.labelWidth + ganttWidth, y + layout.rowHeight);
    ctx.stroke();

    const indent = (item.level ?? 0) * 14 * layout.scale;
    const labelX = layout.padding + 12 * layout.scale + indent;
    const labelMaxWidth = layout.labelWidth - indent - 24 * layout.scale;
    const isDone = item.status === WorkItemStatus.DONE;
    ctx.globalAlpha = isDone ? 0.65 : 1;

    ctx.fillStyle = getTypeBarColor(item.type);
    ctx.font = `bold ${Math.max(9, 11 * layout.scale)}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const keyText = truncateText(ctx, item.key, labelMaxWidth);
    ctx.fillText(keyText, labelX, y + layout.rowHeight / 2 - 7 * layout.scale);

    ctx.fillStyle = "#404040";
    ctx.font = `${Math.max(9, 11 * layout.scale)}px Arial, Helvetica, sans-serif`;
    const titleText = truncateText(ctx, item.title, labelMaxWidth);
    ctx.fillText(titleText, labelX, y + layout.rowHeight / 2 + 8 * layout.scale);

    const bar = calculateBarPosition(item, gridConfig, index);
    if (bar) {
      const barX = gridOriginX + bar.x;
      const barY = y + layout.rowHeight * 0.22;
      const barH = layout.rowHeight * 0.56;
      const barW = Math.max(bar.width, 4 * layout.scale);
      const color = getTypeBarColor(item.type);

      ctx.fillStyle = hexToRgba(color, isDone ? 0.35 : 0.18);
      roundRect(ctx, barX, barY, barW, barH, 6 * layout.scale);
      ctx.fill();

      const progressWidth = Math.max(0, Math.min(barW, (barW * (item.progress ?? 0)) / 100));
      if (progressWidth > 0) {
        ctx.fillStyle = hexToRgba(color, isDone ? 0.85 : 0.95);
        roundRect(ctx, barX, barY, progressWidth, barH, 6 * layout.scale);
        ctx.fill();
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, 1.25 * layout.scale);
      roundRect(ctx, barX, barY, barW, barH, 6 * layout.scale);
      ctx.stroke();

      if (barW > 48 * layout.scale) {
        ctx.fillStyle = "#171717";
        ctx.font = `${Math.max(8, 10 * layout.scale)}px Arial, Helvetica, sans-serif`;
        ctx.textBaseline = "middle";
        const barLabel = truncateText(
          ctx,
          `${item.key} · ${statusLabel(item.status)}`,
          barW - 10 * layout.scale
        );
        ctx.fillText(barLabel, barX + 6 * layout.scale, barY + barH / 2);
      }
    }

    ctx.globalAlpha = 1;
  });

  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    layout.padding,
    headerY,
    layout.labelWidth + ganttWidth,
    layout.headerHeight + Math.max(items.length, 1) * layout.rowHeight
  );

  ctx.beginPath();
  ctx.moveTo(gridOriginX, headerY);
  ctx.lineTo(gridOriginX, layout.canvasHeight - layout.padding);
  ctx.stroke();

  return canvas;
}

export async function downloadTimelinePng(
  items: TimelineItem[],
  zoomLevel: TimelineZoomLevel
): Promise<void> {
  if (items.length === 0) {
    throw new Error("No data to export");
  }

  const canvas = renderTimelineCanvas(items, zoomLevel);
  const blob = await canvasToBlob(canvas, "image/png");
  downloadBlob(blob, getTimelineExportFilename("png"));
}

export async function downloadTimelinePdf(
  items: TimelineItem[],
  zoomLevel: TimelineZoomLevel
): Promise<void> {
  if (items.length === 0) {
    throw new Error("No data to export");
  }

  const [{ jsPDF }, canvas] = await Promise.all([
    import("jspdf"),
    Promise.resolve(renderTimelineCanvas(items, zoomLevel)),
  ]);

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 28;
  const captionHeight = 22;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2 - captionHeight;
  const scale = usableWidth / canvas.width;
  const drawWidth = usableWidth;
  const sourcePageHeight = usableHeight / scale;

  const writeCaption = (pageIndex: number, pageCount: number) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(23, 23, 23);
    pdf.text("Timeline Export", margin, margin + 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(115, 115, 115);
    pdf.text(
      `${format(new Date(), "PPpp")}  ·  ${pageIndex}/${pageCount}`,
      pageWidth - margin,
      margin + 12,
      { align: "right" }
    );
  };

  const pageCount = Math.max(1, Math.ceil(canvas.height / sourcePageHeight));
  let sourceY = 0;

  for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
    if (pageIndex > 1) {
      pdf.addPage();
    }
    writeCaption(pageIndex, pageCount);

    const sliceHeight = Math.min(sourcePageHeight, canvas.height - sourceY);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = Math.max(1, Math.ceil(sliceHeight));
    const sliceCtx = sliceCanvas.getContext("2d");
    if (!sliceCtx) {
      throw new Error("Unable to create PDF slice canvas");
    }
    sliceCtx.fillStyle = "#ffffff";
    sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    sliceCtx.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight
    );

    pdf.addImage(
      sliceCanvas.toDataURL("image/jpeg", 0.86),
      "JPEG",
      margin,
      margin + captionHeight,
      drawWidth,
      sliceHeight * scale
    );
    sourceY += sliceHeight;
  }

  pdf.save(getTimelineExportFilename("pdf"));
}
