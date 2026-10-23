"use client";

import * as React from "react";
import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bold,
  Code,
  Copy,
  Italic,
  Link2,
  MessageSquare,
  Highlighter,
  Palette,
  Sparkles,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import { toast } from "sonner";
import { LinkPanel } from "./link-popover";
import { ColorPanel } from "./color-picker";
import { cn } from "@/lib/utils";

/**
 * Selection floating toolbar (Notion's "bubble"). Shows on text selection,
 * hides on scroll re-anchor, and exposes formatting + link + color + stubs
 * for future AI/comment actions.
 */

interface ToolbarRect {
  x: number;
  y: number;
  above: boolean;
  visible: boolean;
}

export function FloatingToolbar({ editor }: { editor: Editor }) {
  const [rect, setRect] = React.useState<ToolbarRect>({ x: 0, y: 0, above: true, visible: false });
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [colorOpen, setColorOpen] = React.useState(false);
  const [highlightOpen, setHighlightOpen] = React.useState(false);
  const [tick, setTick] = React.useState(0);

  const anyPopoverOpen = linkOpen || colorOpen || highlightOpen;
  const lastRectRef = React.useRef<ToolbarRect | null>(null);

  const computeRect = React.useCallback((): ToolbarRect => {
    // While a popover is open the toolbar must stay put (it hosts the
    // popover) — freeze the last known position instead of hiding.
    if (anyPopoverOpen && lastRectRef.current) {
      return { ...lastRectRef.current, visible: true };
    }
    const { state, view } = editor;
    const { selection } = state;
    const isTextSelection = !selection.empty && selection instanceof TextSelection;
    if (!isTextSelection || !editor.isFocused || anyPopoverOpen) {
      lastRectRef.current = null;
      return { x: 0, y: 0, above: true, visible: false };
    }
    const { from, to } = selection;
    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to);
    const x = Math.min(start.left, end.left) + (Math.abs(end.left - start.left) || 0) / 2;
    const top = Math.min(start.top, end.top);
    const bottom = Math.max(start.bottom, end.bottom);
    const above = top > 76; // leave room for the flip
    const next: ToolbarRect = {
      x: Math.min(Math.max(70, x), window.innerWidth - 70),
      y: above ? top - 10 : bottom + 10,
      above,
      visible: true,
    };
    lastRectRef.current = next;
    return next;
  }, [editor, anyPopoverOpen]);

  // Subscribe to editor + window events.
  React.useEffect(() => {
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setRect(computeRect()));
    };
    editor.on("selectionUpdate", schedule);
    editor.on("transaction", schedule);
    editor.on("blur", schedule);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(raf);
      editor.off("selectionUpdate", schedule);
      editor.off("transaction", schedule);
      editor.off("blur", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [editor, computeRect]);

  // Re-render on mark changes so active states stay fresh.
  React.useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    editor.on("transaction", handler);
    return () => editor.off("transaction", handler);
  }, [editor]);
  void tick;

  if (typeof document === "undefined") return null;

  const isActive = (name: string, attrs?: Record<string, unknown>) => editor.isActive(name, attrs);

  const chainFocus = () => editor.chain().focus();

  const copySelection = async () => {
    const text = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      "\n",
    );
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  return createPortal(
    <AnimatePresence>
      {rect.visible && (
        <motion.div
          key="floating-toolbar"
          initial={{ opacity: 0, scale: 0.96, y: rect.above ? 4 : -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.15, ease: [0.2, 0.8, 0.3, 1] }}
          style={{
            left: rect.x,
            top: rect.y,
            transform: "translateX(-50%)",
          }}
          className="fixed z-[90] flex flex-col items-center gap-2"
          onMouseDown={(e) => {
            // Keep the editor selection alive while clicking the toolbar.
            const target = e.target as HTMLElement;
            if (!target.closest("[data-link-input]")) e.preventDefault();
          }}
        >
          {/* Inline panels (rendered above or below depending on flip) */}
          {(linkOpen || highlightOpen || colorOpen) && (
            <div className={rect.above ? "order-first" : "order-last"}>
              {linkOpen && <LinkPanel editor={editor} onClose={() => setLinkOpen(false)} />}
              {highlightOpen && (
                <ColorPanel editor={editor} mode="background" onClose={() => setHighlightOpen(false)} />
              )}
              {colorOpen && !highlightOpen && (
                <ColorPanel editor={editor} mode="text" onClose={() => setColorOpen(false)} />
              )}
            </div>
          )}

          <div
            className="flex items-center gap-0.5 rounded-xl border border-border/70 bg-popover/95 p-1 shadow-2xl shadow-black/50 backdrop-blur-xl"
            role="toolbar"
            aria-label="Text formatting"
          >
          <TBtn active={isActive("bold")} title="Bold — ⌘B" onClick={() => chainFocus().toggleBold().run()}>
            <Bold size={14.5} />
          </TBtn>
          <TBtn active={isActive("italic")} title="Italic — ⌘I" onClick={() => chainFocus().toggleItalic().run()}>
            <Italic size={14.5} />
          </TBtn>
          <TBtn active={isActive("underline")} title="Underline — ⌘U" onClick={() => chainFocus().toggleUnderline().run()}>
            <UnderlineIcon size={14.5} />
          </TBtn>
          <TBtn active={isActive("strike")} title="Strikethrough — ⌘⇧S" onClick={() => chainFocus().toggleStrike().run()}>
            <Strikethrough size={14.5} />
          </TBtn>
          <TBtn active={isActive("code")} title="Inline code — ⌘E" onClick={() => chainFocus().toggleCode().run()}>
            <Code size={14.5} />
          </TBtn>

          <Divider />

          <TBtn active={linkOpen || isActive("link")} title="Link — ⌘K" onClick={() => { setHighlightOpen(false); setColorOpen(false); setLinkOpen((v) => !v); }}>
            <Link2 size={14.5} />
          </TBtn>

          <TBtn active={highlightOpen || isActive("highlight")} title="Highlight" onClick={() => { setLinkOpen(false); setColorOpen(false); setHighlightOpen((v) => !v); }}>
            <Highlighter size={14.5} />
          </TBtn>

          <TBtn active={colorOpen} title="Text color" onClick={() => { setLinkOpen(false); setHighlightOpen(false); setColorOpen((v) => !v); }}>
            <Palette size={14.5} />
          </TBtn>

          <Divider />

          <TBtn
            title="Comment (coming soon)"
            onClick={() => toast("Comments are on the roadmap", { description: "The extension API is ready for them." })}
          >
            <MessageSquare size={14.5} />
          </TBtn>
          <TBtn title="Copy selection" onClick={copySelection}>
            <Copy size={14.5} />
          </TBtn>
          <TBtn
            title="AI actions (coming soon)"
            onClick={() => toast("AI writing assistant — future-ready ✨", { description: "Plug any LLM into the command layer." })}
            className="text-primary"
          >
            <Sparkles size={14.5} />
          </TBtn>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function TBtn({
  children,
  onClick,
  title,
  active,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "editor-icon-btn h-8 w-8 rounded-lg",
        active && "bg-primary/15 text-primary",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border/80" aria-hidden />;
}
