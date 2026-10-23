"use client";

import * as React from "react";
import type { NodeViewProps } from "@tiptap/core";
import { NodeViewWrapper } from "@tiptap/react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import katex from "katex";
import { Check, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline & block math node views. Rendering uses KaTeX; clicking a node opens
 * a floating editor with live preview. Empty nodes auto-open their editor.
 */

function renderKatex(latex: string, displayMode: boolean): { html: string; error: string | null } {
  try {
    const html = katex.renderToString(latex || "", {
      throwOnError: true,
      displayMode,
      strict: false,
      trust: false,
      output: "html",
    });
    return { html, error: null };
  } catch (error) {
    return { html: "", error: error instanceof Error ? error.message : "Invalid LaTeX" };
  }
}

function MathEditor({
  initialLatex,
  anchorRect,
  displayMode,
  onSave,
  onDelete,
  onClose,
}: {
  initialLatex: string;
  anchorRect: DOMRect;
  displayMode: boolean;
  onSave: (latex: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = React.useState(initialLatex);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const { html, error } = renderKatex(value, displayMode);

  // Position: below the anchor, flipping up when near the bottom.
  const panelWidth = 360;
  const left = Math.min(Math.max(12, anchorRect.left), window.innerWidth - panelWidth - 12);
  const flip = anchorRect.bottom + 320 > window.innerHeight;
  const style: React.CSSProperties = flip
    ? { left, bottom: window.innerHeight - anchorRect.top + 10 }
    : { left, top: anchorRect.bottom + 10 };

  const commit = () => {
    if (value.trim()) onSave(value.trim());
    else onDelete();
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.16, ease: [0.2, 0.8, 0.3, 1] }}
      style={{ width: panelWidth, ...style }}
      className="fixed z-[110] rounded-xl border border-border bg-popover p-3 shadow-2xl shadow-black/50"
      role="dialog"
      aria-label="Edit LaTeX"
    >
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
          e.stopPropagation();
        }}
        placeholder="e.g. \\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}"
        rows={3}
        className="w-full resize-none rounded-lg border border-border bg-muted/40 p-2.5 font-mono text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50"
      />
      <div className="mt-2 min-h-10 overflow-x-auto rounded-lg bg-muted/40 px-3 py-1.5 text-center">
        {error ? (
          <span className="math-error text-xs">{error}</span>
        ) : (
          <span dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={commit}
          className="flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Check size={12} /> Save
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={12} /> Cancel
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </motion.div>,
    document.body,
  );
}

function useMathEditor(props: NodeViewProps, displayMode: boolean) {
  const { node, updateAttributes, deleteNode } = props;
  const [editing, setEditing] = React.useState(false);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const autoOpened = React.useRef(false);

  const latex = (node.attrs.latex as string) ?? "";

  React.useEffect(() => {
    if (!autoOpened.current && latex === "") {
      autoOpened.current = true;
      setRect(wrapperRef.current?.getBoundingClientRect() ?? null);
      setEditing(true);
    }
  }, [latex]);

  const open = () => {
    setRect(wrapperRef.current?.getBoundingClientRect() ?? null);
    setEditing(true);
  };

  const view = displayMode ? (
    <NodeViewWrapper ref={wrapperRef} className={cn("math-block-view group", props.selected && "is-selected")}>
      <div contentEditable={false} onDoubleClick={open} onClick={open}>
        {renderKatexDisplay(latex, displayMode)}
      </div>
    </NodeViewWrapper>
  ) : (
    <NodeViewWrapper
      ref={wrapperRef}
      as="span"
      className={cn("math-inline-view", props.selected && "is-selected")}
    >
      <span contentEditable={false} onClick={open}>
        {renderKatexDisplay(latex, displayMode)}
      </span>
    </NodeViewWrapper>
  );

  const editor = editing && rect
    ? (
      <MathEditor
        initialLatex={latex}
        anchorRect={rect}
        displayMode={displayMode}
        onSave={(next) => {
          updateAttributes({ latex: next });
          setEditing(false);
        }}
        onDelete={() => {
          deleteNode();
          setEditing(false);
        }}
        onClose={() => setEditing(false)}
      />
    )
    : null;

  return { view, editor };
}

function renderKatexDisplay(latex: string, displayMode: boolean): React.ReactNode {
  const { html, error } = renderKatex(latex, displayMode);
  if (error) {
    return <span className="math-error">{latex || "Empty equation — click to edit"}</span>;
  }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export function InlineMathView(props: NodeViewProps) {
  const { view, editor } = useMathEditor(props, false);
  return (
    <>
      {view}
      {editor}
    </>
  );
}

export function BlockMathView(props: NodeViewProps) {
  const { view, editor } = useMathEditor(props, true);
  return (
    <>
      {view}
      {editor}
    </>
  );
}
