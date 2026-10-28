"use client";

import * as React from "react";
import type { Editor } from "@tiptap/core";
import { blockInfoFromPos, getTopLevelBlocks, moveBlocks } from "@/lib/editor/utils";

/**
 * Long-press block drag & drop — the Navigation-mode counterpart of the
 * desktop ⠿ grip drag.
 *
 * It is armed ONLY while the editor is unfocused (navigation mode), so the
 * native long-press text-selection gesture of Editing mode is never
 * intercepted. A ~430ms stationary hold lifts the block as a floating ghost
 * (with haptics); the finger then drives a drop indicator with edge
 * auto-scroll; release commits the move through the same moveBlocks()
 * pipeline the desktop grip uses.
 */

const LONG_PRESS_MS = 430;
const MOVE_SLOP_PX = 9;
const EDGE_PX = 72;
const SCROLL_SPEED = 12;
/** How far below the finger the ghost's top edge may sit (tall blocks). */
const GRAB_DEPTH_PX = 48;

interface DragState {
  index: number;
  ghost: HTMLElement;
  grabDX: number;
  grabDY: number;
}

export function useTouchBlockDnd({
  editor,
  contentRef,
  scrollRef,
  enabled,
}: {
  editor: Editor;
  contentRef: React.RefObject<HTMLDivElement | null>;
  scrollRef: React.RefObject<HTMLElement | null>;
  enabled: boolean;
}) {
  React.useEffect(() => {
    if (!enabled) return;
    const content = contentRef.current;
    if (!content) return;

    let timer = 0;
    let drag: DragState | null = null;
    let indicator: HTMLElement | null = null;
    let veil: HTMLElement | null = null;
    let scrollRaf = 0;
    const last = { x: 0, y: 0 };
    const start = { x: 0, y: 0 };

    const vibrate = (ms: number) => {
      try {
        navigator.vibrate?.(ms);
      } catch {
        /* haptics unsupported — ignore */
      }
    };

    const computeDropIndex = (clientY: number): number | null => {
      const blocks = getTopLevelBlocks(editor);
      for (const block of blocks) {
        const rect = block.dom?.getBoundingClientRect();
        if (!rect) continue;
        if (clientY < rect.top + rect.height / 2) return block.index;
      }
      return blocks.length;
    };

    const positionIndicator = (clientY: number) => {
      if (!indicator) return;
      const dropIndex = computeDropIndex(clientY);
      if (dropIndex === null) return;
      const blocks = getTopLevelBlocks(editor);
      const contentRect = content.getBoundingClientRect();
      let y: number;
      if (dropIndex >= blocks.length) {
        const lastBlock = blocks[blocks.length - 1];
        const rect = lastBlock?.dom?.getBoundingClientRect();
        y = rect ? rect.bottom : contentRect.bottom;
      } else {
        const rect = blocks[dropIndex]?.dom?.getBoundingClientRect();
        y = rect ? rect.top : clientY;
      }
      indicator.style.top = `${y - 1}px`;
      indicator.style.left = `${contentRect.left + 8}px`;
      indicator.style.width = `${contentRect.width - 16}px`;
      indicator.style.opacity = "1";
    };

    /*
     * Visual feedback lives OUTSIDE the editable DOM (document.body, like
     * the drop indicator): mutating PM-owned nodes — e.g. adding a class to
     * the source block — gets picked up by ProseMirror's DOMObserver, which
     * flushes the change back and re-renders the node out from under us.
     * The lifted block is instead veiled by a translucent overlay that
     * tracks its rect.
     */
    const positionVeil = () => {
      if (!veil || !drag) return;
      const el = getTopLevelBlocks(editor)[drag.index]?.dom;
      const rect = el?.getBoundingClientRect();
      if (!rect) return;
      veil.style.top = `${rect.top}px`;
      veil.style.left = `${rect.left}px`;
      veil.style.width = `${rect.width}px`;
      veil.style.height = `${rect.height}px`;
      veil.style.opacity = "1";
    };

    const beginDrag = (x: number, y: number, target: HTMLElement) => {
      const coords = editor.view.posAtCoords({ left: x, top: y });
      if (!coords) return;
      const info = blockInfoFromPos(editor, coords.pos);
      if (!info?.dom) return;
      // The page title is anchored to the top of the page — it never moves.
      if (info.node.type.name === "pageTitle") return;
      const sourceEl = info.dom as HTMLElement;
      const rect = sourceEl.getBoundingClientRect();

      const ghost = document.createElement("div");
      ghost.className = "mobile-drag-ghost";
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      ghost.style.width = `${Math.min(rect.width, window.innerWidth - 24)}px`;
      const clone = sourceEl.cloneNode(true) as HTMLElement;
      clone.removeAttribute("data-node-view-wrapper");
      ghost.appendChild(clone);
      document.body.appendChild(ghost);

      indicator = document.createElement("div");
      indicator.className = "drop-indicator";
      indicator.style.opacity = "0";
      document.body.appendChild(indicator);

      veil = document.createElement("div");
      veil.className = "mobile-drag-veil";
      veil.style.opacity = "0";
      document.body.appendChild(veil);

      vibrate(12);
      drag = {
        index: info.index,
        ghost,
        grabDX: x - rect.left,
        grabDY: Math.min(y - rect.top, GRAB_DEPTH_PX),
      };
      positionIndicator(y);
      positionVeil();
      if (!scrollRaf) scrollRaf = requestAnimationFrame(autoScrollStep);
    };

    const positionGhost = (x: number, y: number) => {
      if (!drag) return;
      const left = Math.min(Math.max(x - drag.grabDX, 8), window.innerWidth - 40);
      drag.ghost.style.left = `${left}px`;
      drag.ghost.style.top = `${Math.max(y - drag.grabDY, 8)}px`;
    };

    // Auto-scroll near the scroll container's edges while dragging.
    const autoScrollStep = () => {
      if (!drag) {
        scrollRaf = 0;
        return;
      }
      const scroller = scrollRef.current;
      if (scroller) {
        const rect = scroller.getBoundingClientRect();
        let dy = 0;
        if (last.y < rect.top + EDGE_PX) dy = -SCROLL_SPEED;
        else if (last.y > rect.bottom - EDGE_PX) dy = SCROLL_SPEED;
        if (dy !== 0) {
          scroller.scrollTop += dy;
          positionIndicator(last.y);
          positionVeil();
        }
      }
      scrollRaf = requestAnimationFrame(autoScrollStep);
    };

    const cleanup = (commit: boolean) => {
      if (timer) {
        clearTimeout(timer);
        timer = 0;
      }
      if (scrollRaf) {
        cancelAnimationFrame(scrollRaf);
        scrollRaf = 0;
      }
      if (drag) {
        if (commit) {
          const dropIndex = computeDropIndex(last.y);
          if (dropIndex !== null) moveBlocks(editor, [drag.index], dropIndex);
          vibrate(8);
        }
        drag.ghost.remove();
        drag = null;
      }
      if (indicator) {
        indicator.remove();
        indicator = null;
      }
      if (veil) {
        veil.remove();
        veil = null;
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || drag) {
        clearTimeout(timer);
        timer = 0;
        return;
      }
      const t = e.touches[0];
      const target = t.target as HTMLElement;
      // Never fight interactive node-view UI (buttons, selects, checkboxes…).
      if (
        target.closest(
          "button, select, input, textarea, a[href], [data-block-handle-ui], [contenteditable=false]",
        )
      ) {
        return;
      }
      start.x = t.clientX;
      start.y = t.clientY;
      last.x = t.clientX;
      last.y = t.clientY;
      timer = window.setTimeout(() => beginDrag(last.x, last.y, target), LONG_PRESS_MS);
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      last.x = t.clientX;
      last.y = t.clientY;
      if (!drag) {
        // Finger moved before the hold matured — it's a scroll, cancel.
        if (timer && Math.hypot(t.clientX - start.x, t.clientY - start.y) > MOVE_SLOP_PX) {
          clearTimeout(timer);
          timer = 0;
        }
        return;
      }
      e.preventDefault(); // the document is a canvas while a block is lifted
      positionGhost(t.clientX, t.clientY);
      positionIndicator(t.clientY);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!drag) {
        clearTimeout(timer);
        timer = 0;
        return;
      }
      e.preventDefault(); // keep the release from focusing the editor
      cleanup(true);
    };

    const onTouchCancel = () => cleanup(false);

    content.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: false });
    window.addEventListener("touchcancel", onTouchCancel);

    return () => {
      cleanup(false);
      content.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [editor, contentRef, scrollRef, enabled]);
}
