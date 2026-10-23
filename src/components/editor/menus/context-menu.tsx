"use client";

import * as React from "react";
import type { Editor } from "@tiptap/core";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  Clipboard,
  ClipboardPaste,
  Copy,
  CornerUpLeft,
  ArrowDownUp,
  ListPlus,
  MessageSquare,
  SquareMousePointer,
  Scissors,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  blockInfoFromPos,
  duplicateBlock,
  extendSelectionToBlock,
  moveBlockByStep,
  selectBlock,
} from "@/lib/editor/utils";
import { TURN_INTO_OPTIONS } from "./turn-into";
import { cn } from "@/lib/utils";

/**
 * Right-click context menu with block operations and a "Turn into" flyout.
 */

export interface ContextMenuState {
  x: number;
  y: number;
  pos: number;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }> | null;
  shortcut?: string;
  danger?: boolean;
  submenu?: boolean;
  run?: () => void;
}

export function ContextMenu({
  editor,
  state,
  onClose,
}: {
  editor: Editor;
  state: ContextMenuState | null;
  onClose: () => void;
}) {
  const [turnIntoOpen, setTurnIntoOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close on outside interaction / Esc / scroll.
  React.useEffect(() => {
    if (!state) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [state, onClose]);

  if (!state || typeof document === "undefined") return null;

  const info = blockInfoFromPos(editor, state.pos);

  const withClose = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const copyText = async () => {
    const text = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      "\n",
    );
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  const pasteText = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) editor.chain().focus().insertContent(text).run();
    } catch {
      toast.error("Clipboard permission denied — use ⌘V instead");
    }
  };

  const cutText = async () => {
    await copyText();
    editor.chain().focus().deleteSelection().run();
  };

  const activeTurnInto = TURN_INTO_OPTIONS.find((o) => o.isActive(editor));

  const items: MenuItem[] = [
    { id: "cut", label: "Cut", icon: Scissors, run: withClose(() => void cutText()) },
    { id: "copy", label: "Copy", icon: Copy, run: withClose(() => void copyText()) },
    { id: "paste", label: "Paste", icon: ClipboardPaste, run: withClose(() => void pasteText()) },
    { id: "sep1", label: "", icon: null },
    { id: "duplicate", label: "Duplicate", icon: Clipboard, run: withClose(() => duplicateBlock(editor)) },
    {
      id: "select",
      label: "Select block",
      icon: SquareMousePointer,
      run: withClose(() => info && selectBlock(editor, info)),
    },
    {
      id: "turnInto",
      label: "Turn into",
      icon: ListPlus,
      submenu: true,
    },
    { id: "moveUp", label: "Move up", icon: CornerUpLeft, shortcut: "⌥↑", run: withClose(() => moveBlockByStep(editor, -1)) },
    { id: "moveDown", label: "Move down", icon: ArrowDownUp, shortcut: "⌥↓", run: withClose(() => moveBlockByStep(editor, 1)) },
    { id: "sep2", label: "", icon: null },
    {
      id: "comment",
      label: "Comment",
      icon: MessageSquare,
      run: withClose(() => toast("Comments are on the roadmap", { description: "The extension API is ready for them." })),
    },
    { id: "delete", label: "Delete", icon: Trash2, danger: true, shortcut: "⌫", run: withClose(() => editor.chain().focus().deleteSelection().run()) },
  ];

  const width = 232;
  const height = 420;
  const left = Math.min(state.x, window.innerWidth - width - 12);
  const top = Math.min(state.y, window.innerHeight - height - 12);

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.97, y: 2 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.13, ease: [0.2, 0.8, 0.3, 1] }}
        style={{ left, top, width }}
        className="fixed z-[100] rounded-xl border border-border/80 bg-popover/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
        role="menu"
        aria-label="Block context menu"
        onMouseDown={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {items.map((item) => {
          if (item.id.startsWith("sep")) {
            return <div key={item.id} className="mx-2 my-1 h-px bg-border/70" role="separator" />;
          }
          const Icon = item.icon;
          const isOpen = item.submenu && turnIntoOpen;
          return (
            <div key={item.id} className="relative">
              <button
                type="button"
                role="menuitem"
                aria-haspopup={item.submenu ? "menu" : undefined}
                onMouseEnter={() => setTurnIntoOpen(Boolean(item.submenu))}
                onClick={() => {
                  if (item.submenu) setTurnIntoOpen((v) => !v);
                  else item.run?.();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors duration-100",
                  item.danger ? "text-red-400 hover:bg-red-500/10" : "text-foreground/90 hover:bg-muted",
                  isOpen && "bg-muted",
                )}
              >
                {Icon ? <Icon size={14.5} /> : <span className="w-[14.5px]" />}
                <span className="flex-1">{item.label}</span>
                {item.shortcut && <span className="kbd opacity-70">{item.shortcut}</span>}
                {item.submenu && <ChevronRight size={13} className="text-muted-foreground" />}
              </button>

              {item.submenu && turnIntoOpen && (
                <div
                  className="absolute left-[calc(100%-6px)] top-0 z-10 max-h-[320px] w-52 overflow-y-auto rounded-xl border border-border/80 bg-popover/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
                  role="menu"
                  aria-label="Turn into"
                >
                  {TURN_INTO_OPTIONS.map((option) => {
                    const OptionIcon = option.icon;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="menuitem"
                        onClick={withClose(() => option.run(editor))}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors duration-100 hover:bg-muted",
                          option.isActive(editor) && "bg-primary/10 text-primary",
                        )}
                      >
                        <OptionIcon size={14.5} />
                        <span className="flex-1">{option.label}</span>
                        {activeTurnInto?.id === option.id && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

// Re-export for potential selection extension (shift+click) flows elsewhere.
export { extendSelectionToBlock };
