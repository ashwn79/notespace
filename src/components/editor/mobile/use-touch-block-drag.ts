"use client";

import * as React from "react";
import type { Editor } from "@tiptap/core";
import { getTopLevelBlocks, moveBlocks, type BlockInfo } from "@/lib/editor/utils";

/**
 * Touch long-press → block drag (navigation mode).
 *
 * Gesture state machine:
 *   IDLE → PENDING (finger down, 420 ms timer, ≤12 px slop)
 *        → DRAGGING (timer fired: haptic, ghost, indicator, auto-scroll)
 *        → drop / cancel.
 *
 * Design contracts:
 *  - Armed ONLY in navigation mode (keyboard hidden). Editing mode keeps
 *    the platform's native text-selection gestures untouched.
 *  - The ghost follows the finger through a rAF spring-lerp so the lift
 *    feels physical instead of glued.
 *  - While dragging, non-passive touchmove/touchend preventDefault keeps
 *    the browser from scrolling or synthesizing a tap into the editor
 *    (a tap would re-focus and reopen the keyboard — forbidden mid-drag).
 *  - Drop reuses the desktop `moveBlocks` transaction (page title
 *    protection + undo history included).
 */

const LONG_PRESS_MS = 420;
const SLOP_PX = 12;
const EDGE_ZONE = 88; // auto-scroll zone (px from viewport edge)
const MAX_EDGE_SPEED = 18; // px per frame at the very edge
const SPRING = 0.4; // ghost follow stiffness

interface DragSession {
  info: BlockInfo;
  index: number;
  grabDx: number;
  grabDy: number;
  ghost: HTMLDivElement;
  ghostInner: HTMLDivElement;
  indicator: HTMLDivElement;
  pointerId: number;
  targetX: number;
  targetY: number;
  x: number;
  y: number;
  lastDropIndex: number | null;
}

function haptic(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported — silent */
  }
}

/**
 * Mutate a PM-managed element's attribute WITHOUT triggering a redraw.
 *
 * ProseMirror's DOMObserver watches attribute mutations; a bare
 * setAttribute makes it believe the document changed and it silently
 * REPLACES the node's DOM (killing the marker mid-drag). Stopping the
 * observer around the mutation hides it — the stop/start window is a
 * single synchronous statement, so no user input can be missed.
 */
function setPMAttribute(el: HTMLElement | null | undefined, attr: string, value: string | null, editor: Editor) {
  if (!el) return;
  const observer = editor.view.domObserver;
  observer.stop();
  try {
    if (value === null) el.removeAttribute(attr);
    else el.setAttribute(attr, value);
  } finally {
    observer.start();
  }
}

export function useTouchBlockDrag({
  editor,
  containerRef,
  scrollRef,
  enabled,
}: {
  editor: Editor;
  containerRef: React.RefObject<HTMLElement | null>;
  scrollRef: React.RefObject<HTMLElement | null>;
  enabled: boolean;
}): { dragging: boolean } {
  const [dragging, setDragging] = React.useState(false);

  const sessionRef = React.useRef<DragSession | null>(null);
  const pendingRef = React.useRef<{
    timer: number;
    startX: number;
    startY: number;
    pointerId: number;
  } | null>(null);
  const rafRef = React.useRef(0);
  const enabledRef = React.useRef(enabled);
  const editorRef = React.useRef(editor);

  // Keep latest values reachable from imperative gesture handlers
  // (registered once) without re-subscribing on every render.
  React.useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  React.useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  /* ------------------------------------------------- drag session helpers */

  const computeDropIndex = (clientY: number): number | null => {
    const blocks = getTopLevelBlocks(editorRef.current);
    for (const block of blocks) {
      const rect = block.dom?.getBoundingClientRect();
      if (!rect) continue;
      if (clientY < rect.top + rect.height / 2) return block.index;
    }
    return blocks.length;
  };

  const clearIndicator = (session: DragSession) => {
    session.indicator.style.opacity = "0";
  };

  const updateIndicator = (session: DragSession) => {
    const container = containerRef.current;
    if (!container) return;
    const dropIndex = computeDropIndex(session.targetY);
    session.lastDropIndex = dropIndex;
    if (dropIndex === null) {
      clearIndicator(session);
      return;
    }
    const blocks = getTopLevelBlocks(editorRef.current);
    const contentRect = container.getBoundingClientRect();
    let y: number;
    if (dropIndex >= blocks.length) {
      const last = blocks[blocks.length - 1];
      const rect = last?.dom?.getBoundingClientRect();
      y = rect ? rect.bottom : contentRect.bottom;
    } else {
      const rect = blocks[dropIndex]?.dom?.getBoundingClientRect();
      y = rect ? rect.top : session.targetY;
    }
    session.indicator.style.top = `${y - 1}px`;
    session.indicator.style.left = `${contentRect.left + 10}px`;
    session.indicator.style.width = `${contentRect.width - 20}px`;
    session.indicator.style.opacity = "1";
  };

  /** rAF loop: ghost spring + edge auto-scroll + indicator refresh. */
  const runFrame = (session: DragSession) => {
    // Spring-lerp the ghost toward the finger.
    session.x += (session.targetX - session.x) * SPRING;
    session.y += (session.targetY - session.y) * SPRING;
    session.ghost.style.transform = `translate3d(${session.x}px, ${session.y}px, 0)`;

    // Auto-scroll near viewport edges (leaves room for the toolbar sheet).
    const scroller = scrollRef.current;
    const topZone = EDGE_ZONE;
    const bottomZone = window.innerHeight - EDGE_ZONE;
    if (session.targetY < topZone) {
      const speed = MAX_EDGE_SPEED * (1 - session.targetY / topZone);
      scroller?.scrollBy({ top: -speed });
      // Keep the pointer target in sync with the scrolled content.
      session.targetY -= speed;
    } else if (session.targetY > bottomZone) {
      const speed = MAX_EDGE_SPEED * (1 - (window.innerHeight - session.targetY) / EDGE_ZONE);
      scroller?.scrollBy({ top: speed });
      session.targetY += speed;
    }

    updateIndicator(session);
    rafRef.current = requestAnimationFrame(() => runFrame(session));
  };

  const buildGhost = (info: BlockInfo, grabX: number, grabY: number): DragSession["ghost"] => {
    const ghost = document.createElement("div");
    ghost.className = "touch-drag-ghost";
    const inner = document.createElement("div");
    inner.className = "touch-drag-ghost-inner";
    if (info.dom) {
      const clone = info.dom.cloneNode(true) as HTMLElement;
      clone.removeAttribute("data-node-view-wrapper");
      clone.removeAttribute("data-touch-drag-source");
      clone.classList.remove("block-selected");
      inner.appendChild(clone);
    } else {
      inner.textContent = info.node.type.name;
    }
    ghost.appendChild(inner);

    const rect = info.dom?.getBoundingClientRect();
    const width = Math.max(180, Math.min(rect?.width ?? 320, window.innerWidth - 48));
    ghost.style.width = `${width}px`;
    // Pre-position so the first frame doesn't flash at 0,0.
    ghost.style.transform = `translate3d(${grabX}px, ${grabY}px, 0)`;
    document.body.appendChild(ghost);
    return ghost;
  };

  const endSession = React.useCallback((drop: boolean) => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    cancelAnimationFrame(rafRef.current);

    if (drop && session.lastDropIndex !== null) {
      moveBlocks(editorRef.current, [session.index], session.lastDropIndex);
      haptic(8);
    }

    session.ghost.remove();
    session.indicator.remove();
    const source = containerRef.current?.querySelector("[data-touch-drag-source]");
    setPMAttribute(source as HTMLElement | null, "data-touch-drag-source", null, editorRef.current);
    document.body.classList.remove("touch-block-dragging");
    setDragging(false);
  }, [containerRef]);

  /* ------------------------------------------------------- gesture wiring */

  React.useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const cancelPending = () => {
      if (!pendingRef.current) return;
      window.clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;
    };

    const fireLongPress = (startX: number, startY: number, pointerId: number) => {
      pendingRef.current = null;
      const ed = editorRef.current;
      const pos = ed.view.posAtCoords({ left: startX, top: startY });
      if (!pos) return;
      // Re-resolve the block at fire time (the pointer may sit on a
      // non-draggable fixture).
      const blocks = getTopLevelBlocks(ed);
      let info: BlockInfo | null = null;
      const hit = pos.pos;
      for (const block of blocks) {
        if (hit >= block.pos && hit <= block.to) {
          info = block;
          break;
        }
      }
      if (!info || info.dom?.hasAttribute("data-page-title") || info.node.type.name === "pageTitle") return;

      haptic(12);
      // Kill any native selection the hold may have produced.
      window.getSelection()?.removeAllRanges();
      document.body.classList.add("touch-block-dragging");

      const rect = info.dom?.getBoundingClientRect();
      const grabDx = rect ? Math.min(Math.max(0, startX - rect.left), rect.width) : 24;
      const grabDy = rect ? Math.min(startY - rect.top, rect.height / 2) : 20;

      const ghost = buildGhost(info, startX - grabDx, startY - grabDy);
      const indicator = document.createElement("div");
      indicator.className = "drop-indicator";
      indicator.style.opacity = "0";
      document.body.appendChild(indicator);

      if (info.dom) setPMAttribute(info.dom, "data-touch-drag-source", "true", ed);

      sessionRef.current = {
        info,
        index: info.index,
        grabDx,
        grabDy,
        ghost,
        ghostInner: ghost.firstElementChild as HTMLDivElement,
        indicator,
        pointerId,
        targetX: startX - grabDx,
        targetY: startY - grabDy,
        x: startX - grabDx,
        y: startY - grabDy,
        lastDropIndex: info.index,
      };
      requestAnimationFrame(() => ghost.firstElementChild?.classList.add("is-lifted"));
      setDragging(true);
      rafRef.current = requestAnimationFrame(() => runFrame(sessionRef.current!));
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !enabledRef.current) return;
      if (sessionRef.current) return;
      const target = e.target as HTMLElement;
      // Never hijack interactive chrome (buttons, checkboxes, links, inputs,
      // node-view toolbars, column grips…).
      if (
        target.closest(
          "button, a, input, select, textarea, label, [data-block-handle-ui], [data-no-touch-drag], audio, video",
        )
      ) {
        return;
      }
      const ed = editorRef.current;
      const pos = ed.view.posAtCoords({ left: e.clientX, top: e.clientY });
      if (!pos) return;
      // Cheap pre-check: resolve the top-level block now and refuse the
      // page title (it is anchored to the top of the page).
      const blocks = getTopLevelBlocks(ed);
      const hit = blocks.find((b) => pos.pos >= b.pos && pos.pos <= b.to);
      if (!hit || hit.node.type.name === "pageTitle") return;

      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startY = e.clientY;
      const timer = window.setTimeout(() => fireLongPress(startX, startY, pointerId), LONG_PRESS_MS);
      pendingRef.current = { timer, startX, startY, pointerId };
    };

    const onPointerMove = (e: PointerEvent) => {
      const pending = pendingRef.current;
      if (pending && e.pointerId === pending.pointerId) {
        const moved = Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY);
        if (moved > SLOP_PX) cancelPending(); // scrolling / native selection gesture
        return;
      }
      const session = sessionRef.current;
      if (session && e.pointerId === session.pointerId) {
        session.targetX = e.clientX - session.grabDx;
        session.targetY = e.clientY - session.grabDy;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (pendingRef.current?.pointerId === e.pointerId) cancelPending();
      const session = sessionRef.current;
      if (session && e.pointerId === session.pointerId) endSession(true);
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (pendingRef.current?.pointerId === e.pointerId) cancelPending();
      if (sessionRef.current?.pointerId === e.pointerId) endSession(false);
    };

    /* Long-press / drag must never open the custom context menu, and while
       a drag is live the browser must not scroll or synthesize clicks. */
    const onContextMenuCapture = (e: MouseEvent) => {
      if (pendingRef.current || sessionRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (sessionRef.current) e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (sessionRef.current) e.preventDefault();
    };
    const onWheel = (e: WheelEvent) => {
      if (sessionRef.current) e.preventDefault();
    };

    container.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerCancel);
    document.addEventListener("contextmenu", onContextMenuCapture, true);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: false });
    document.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelPending();
      // Safety: if the effect tears down mid-drag, drop nothing — clean up.
      if (sessionRef.current) endSession(false);
      container.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerCancel);
      document.removeEventListener("contextmenu", onContextMenuCapture, true);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("wheel", onWheel);
    };
  }, [enabled, containerRef, endSession]);

  return { dragging };
}
