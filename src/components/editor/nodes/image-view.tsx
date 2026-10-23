"use client";

import * as React from "react";
import type { NodeViewProps } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlignCenter, AlignLeft, Maximize2, X } from "lucide-react";
import type { MediaAlign } from "@/lib/editor/types";
import { cn } from "@/lib/utils";

/**
 * Image block — resizable, alignable, captioned, with a lightbox preview.
 * Resize is pointer-based and commits a single attribute update per gesture
 * (one undo step), keeping history clean.
 */

export function ImageView(props: NodeViewProps) {
  const { node, updateAttributes, editor } = props;
  const { src, alt, width, align } = node.attrs as {
    src: string;
    alt: string;
    width: number;
    align: MediaAlign;
  };

  const [liveWidth, setLiveWidth] = React.useState<number | null>(null);
  const [lightbox, setLightbox] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const dragState = React.useRef<{ startX: number; startPct: number; columnWidth: number } | null>(null);

  const setAlign = (next: MediaAlign) => updateAttributes({ align: next });

  const onResizeStart = (event: React.PointerEvent, direction: 1 | -1) => {
    event.preventDefault();
    event.stopPropagation();
    const column = wrapperRef.current?.closest("[data-editor-column]") as HTMLElement | null;
    const columnWidth = column?.clientWidth ?? wrapperRef.current?.parentElement?.clientWidth ?? 600;
    const currentPct = liveWidth ?? width;
    dragState.current = { startX: event.clientX * direction, startPct: currentPct, columnWidth };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onResizeMove = (event: React.PointerEvent, direction: 1 | -1) => {
    const state = dragState.current;
    if (!state) return;
    const dx = (event.clientX * direction - state.startX) / state.columnWidth;
    const pct = Math.min(100, Math.max(12, state.startPct + dx * 100));
    setLiveWidth(Math.round(pct));
  };

  const onResizeEnd = (event: React.PointerEvent) => {
    if (!dragState.current) return;
    dragState.current = null;
    const finalPct = liveWidth ?? width;
    setLiveWidth(null);
    updateAttributes({ width: finalPct });
    event.stopPropagation();
  };

  const displayWidth = liveWidth ?? width;

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className="image-block group"
      data-align={align}
      data-selected={props.selected ? "true" : undefined}
    >
      <figure
        style={{ width: `${displayWidth}%` }}
        className={cn(
          "relative",
          align === "center" && "mx-auto",
          align === "left" && "mr-auto",
        )}
      >
        {/* The raw img element is intentional: Next Image optimization is
            unnecessary for user-uploaded files served from /uploads. */}
        <img
          src={src}
          alt={alt ?? ""}
          draggable={false}
          loading="lazy"
          onClick={() => setLightbox(true)}
          className="w-full"
        />

        {/* Resize handles */}
        <div
          role="separator"
          aria-label="Resize image"
          onPointerDown={(e) => onResizeStart(e, 1)}
          onPointerMove={(e) => onResizeMove(e, 1)}
          onPointerUp={onResizeEnd}
          className="resize-handle left-[-8px]"
        />
        <div
          role="separator"
          aria-label="Resize image"
          onPointerDown={(e) => onResizeStart(e, -1)}
          onPointerMove={(e) => onResizeMove(e, -1)}
          onPointerUp={onResizeEnd}
          className="resize-handle right-[-8px]"
        />

        {/* Alignment toolbar */}
        <div
          contentEditable={false}
          className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-lg border border-white/10 bg-black/55 p-1 opacity-0 shadow-lg backdrop-blur-md transition-opacity duration-150 group-hover:opacity-100"
        >
          <ToolButton active={align === "left"} onClick={() => setAlign("left")} title="Align left">
            <AlignLeft size={14} />
          </ToolButton>
          <ToolButton active={align === "center"} onClick={() => setAlign("center")} title="Align center">
            <AlignCenter size={14} />
          </ToolButton>
          <ToolButton active={align === "full"} onClick={() => setAlign("full")} title="Full width">
            <Maximize2 size={14} />
          </ToolButton>
        </div>

        <NodeViewContent as="figcaption" data-placeholder="Write a caption…" className="image-caption" />
      </figure>

      {lightbox
        ? createPortal(
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
                onClick={() => setLightbox(false)}
              >
                <motion.img
                  initial={{ scale: 0.94, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.96, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0.8, 0.3, 1] }}
                  src={src}
                  alt={alt ?? ""}
                  className="max-h-[88vh] max-w-full rounded-xl object-contain shadow-2xl"
                />
                <button
                  type="button"
                  aria-label="Close preview"
                  className="editor-icon-btn absolute right-5 top-5 h-10 w-10 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => setLightbox(false)}
                >
                  <X size={18} />
                </button>
              </motion.div>
            </AnimatePresence>,
            document.body,
          )
        : null}
    </NodeViewWrapper>
  );
}

function ToolButton({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/15 hover:text-white",
        active && "bg-white/20 text-white",
      )}
    >
      {children}
    </button>
  );
}
