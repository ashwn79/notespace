"use client";

import * as React from "react";
import type { Editor } from "@tiptap/core";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  SquarePlus,
  SquareMinus,
  Columns2,
  Rows2,
  Table as TableIcon,
  Trash2,
} from "lucide-react";

/**
 * Floating mini-toolbar for tables. Appears above the active table and
 * exposes row/column operations + header toggle + delete.
 */
export function TableMenu({ editor }: { editor: Editor }) {
  const [rect, setRect] = React.useState<{ top: number; left: number } | null>(null);
  const [tick, setTick] = React.useState(0);
  void tick;

  React.useEffect(() => {
    const update = () => {
      if (!editor.isActive("table") || !editor.isFocused) {
        setRect(null);
        return;
      }
      const { state, view } = editor;
      const { $from } = state.selection;
      let tablePos = -1;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        if ($from.node(depth).type.name === "table") {
          tablePos = $from.before(depth);
          break;
        }
      }
      if (tablePos < 0) {
        setRect(null);
        return;
      }
      const dom = view.nodeDOM(tablePos) as HTMLElement | null;
      if (!dom) {
        setRect(null);
        return;
      }
      const tableRect = dom.getBoundingClientRect();
      setRect({
        top: Math.max(64, tableRect.top - 44),
        left: Math.max(12, Math.min(tableRect.right - 260, tableRect.left)),
      });
    };
    const schedule = () => requestAnimationFrame(update);
    editor.on("selectionUpdate", schedule);
    editor.on("transaction", schedule);
    editor.on("focus", schedule);
    editor.on("blur", schedule);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    update();
    return () => {
      editor.off("selectionUpdate", schedule);
      editor.off("transaction", schedule);
      editor.off("focus", schedule);
      editor.off("blur", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [editor]);

  React.useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    editor.on("transaction", handler);
    return () => editor.off("transaction", handler);
  }, [editor]);

  if (!rect || typeof document === "undefined") return null;

  const canRow = editor.can().addRowAfter();
  const canCol = editor.can().addColumnAfter();

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        style={{ top: rect.top, left: rect.left }}
        className="fixed z-[88] flex items-center gap-0.5 rounded-xl border border-border/70 bg-popover/95 p-1 shadow-2xl shadow-black/40 backdrop-blur-xl"
        role="toolbar"
        aria-label="Table tools"
        onMouseDown={(e) => e.preventDefault()}
      >
        <Btn title="Insert row below" disabled={!canRow} onClick={() => editor.chain().focus().addRowAfter().run()}>
          <Rows2 size={14} />
        </Btn>
        <Btn title="Insert column right" disabled={!canCol} onClick={() => editor.chain().focus().addColumnAfter().run()}>
          <Columns2 size={14} />
        </Btn>
        <Btn title="Delete row" danger onClick={() => editor.chain().focus().deleteRow().run()}>
          <SquareMinus size={14} />
        </Btn>
        <Btn title="Delete column" danger onClick={() => editor.chain().focus().deleteColumn().run()}>
          <SquareMinus size={14} />
        </Btn>
        <Btn
          title="Toggle header row"
          active={editor.isActive("tableHeader")}
          onClick={() => editor.chain().focus().toggleHeaderRow().run()}
        >
          <TableIcon size={14} />
        </Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn title="Delete table" danger onClick={() => editor.chain().focus().deleteTable().run()}>
          <Trash2 size={14} />
        </Btn>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

function Btn({
  children,
  onClick,
  title,
  disabled,
  danger,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`editor-icon-btn h-8 w-8 rounded-lg disabled:cursor-not-allowed disabled:opacity-35 ${
        danger ? "hover:bg-red-500/10 hover:text-red-400" : ""
      } ${active ? "bg-primary/15 text-primary" : ""}`}
    >
      {children}
    </button>
  );
}
