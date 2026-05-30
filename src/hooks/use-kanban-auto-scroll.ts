"use client";

/**
 * useKanbanAutoScroll
 *
 * Provides edge-based horizontal auto-scroll for a Kanban board container
 * while the user is dragging a card.
 *
 * Usage:
 * 1. Attach `scrollRef` to the horizontally scrollable container element.
 * 2. Pass `onDragStart` / `onDragEnd` to <DragDropContext>.
 *
 * The hook listens to global `pointermove` events so it works even when the
 * pointer has left the container boundary (which is exactly what happens when
 * you drag towards the edge of the visible area).
 */

import { useRef, useEffect, useCallback } from "react";

/** Distance from the container edge that triggers scrolling (px). */
const SCROLL_ZONE = 120;
/** Maximum scroll speed (px per animation frame). */
const MAX_SPEED = 16;

export function useKanbanAutoScroll() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const pointerXRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // ── animation loop ────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !isDraggingRef.current) return;

    const rect = el.getBoundingClientRect();
    const px = pointerXRef.current;

    const distLeft = px - rect.left;
    const distRight = rect.right - px;

    if (distLeft < SCROLL_ZONE && distLeft > 0) {
      // scroll left — faster the closer you are
      const speed = MAX_SPEED * (1 - distLeft / SCROLL_ZONE);
      el.scrollLeft -= speed;
    } else if (distRight < SCROLL_ZONE && distRight > 0) {
      // scroll right
      const speed = MAX_SPEED * (1 - distRight / SCROLL_ZONE);
      el.scrollLeft += speed;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ── pointer tracking ───────────────────────────────────────────────────────
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent | MouseEvent) => {
      pointerXRef.current = e.clientX;
    };

    // Use `pointermove` (covers touch + mouse). Fall back to `mousemove`.
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("mousemove", handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("mousemove", handlePointerMove);
    };
  }, []);

  // ── drag lifecycle callbacks ───────────────────────────────────────────────
  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  return {
    /** Attach to the horizontally scrollable container element. */
    scrollRef,
    /** Pass as `onDragStart` to <DragDropContext>. */
    handleDragStart,
    /** Compose with the existing `onDragEnd` handler in <DragDropContext>. */
    handleDragEnd,
  };
}
