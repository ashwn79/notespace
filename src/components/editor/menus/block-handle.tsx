"use client";

import * as React from "react";
import type { Editor } from "@tiptap/core";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  Clipboard,
  CornerUpLeft,
  ArrowDownUp,
  GripVertical,
  ListPlus,
  Plus,
  SquareMousePointer,
  Trash2,
} from "lucide-react";
import {
  blockInfoFromPos,
  currentBlock,
  duplicateBlock,
  extendSelectionToBlock,
  getTopLevelBlocks,
  moveBlockByStep,
  moveBlocks,
  selectBlock,
  type BlockInfo,
} from "@/lib/editor/utils";
import { TURN_INTO_OPTIONS } from "./turn-into";
import { cn } from "@/lib/utils";

/**
 * Block drag handle — the Notion-style ⠿ + ➕ gutter controls.
 *
 * - Hover shows the handle beside the hovered top-level block
 * - Grip click selects the block and opens its action menu
 * - Grip drag moves one block (or the whole multi-block selection)
 * - Plus inserts an empty paragraph below the current block
 */

interface DragPayload {
  indices: number[];
}

export function BlockHandle({
  editor,
  contentRef,
  onOpenSearch,
}: {
  editor: Editor;
  contentRef: React.RefObject<HTMLDivElement | null>;
  onOpenSearch?: () => void;
}) {
  const [visible, setVisible] = React.useState(false);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuAnchor, setMenuAnchor] = React.useState<{ left: number; top: number } | null>(null);
  const [turnIntoOpen, setTurnIntoOpen] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const hoveredBlock = React.useRef<BlockInfo | null>(null);
  const lastMouse = React.useRef({ x: 0, y: 0 });
  const dragPayload = React.useRef<DragPayload | null>(null);
  const indicatorRef = React.useRef<HTMLDivElement>(null);
  const ghostRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const gripRef = React.useRef<HTMLButtonElement>(null);

  const anyOpen = menuOpen || dragging;

  /* ---------------- hover tracking ---------------- */
  React.useEffect(() => {
    const updatePosition = () => {
      if (!hoveredBlock.current?.dom || !contentRef.current) return;
      const rect = hoveredBlock.current.dom.getBoundingClientRect();
      const containerRect = contentRef.current.getBoundingClientRect();
      const column = contentRef.current.querySelector("[data-editor-column]") as HTMLElement | null;
      const columnRect = column?.getBoundingClientRect() ?? rect;
      const tall = rect.height > 120;
      const top = tall
        ? rect.top - containerRect.top + Math.min(rect.height / 2 - 12, 48)
        : rect.top - containerRect.top + 2;
      const left = Math.min(columnRect.left - containerRect.left - 54, -54 + (columnRect.left - containerRect.left));
      setPosition({ top, left: Math.max(left, 0) });
      setVisible(true);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (anyOpen) return;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      const target = e.target as HTMLElement;
      // Don't fight with node-view UI (toolbars, selects…).
      if (target.closest("[data-block-handle-ui]")) return;

      const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
      if (!coords) {
        setVisible(false);
        return;
      }
      const info = blockInfoFromPos(editor, coords.pos);
      if (!info || !info.dom) {
        setVisible(false);
        return;
      }
      const changed = hoveredBlock.current?.pos !== info.pos;
      hoveredBlock.current = info;
      if (changed || !visible) updatePosition();
    };

    const onScroll = () => {
      if (dragging) return;
      updatePosition();
    };

    const el = contentRef.current;
    el?.addEventListener("mousemove", onMouseMove);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      el?.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [editor, contentRef, anyOpen, visible, dragging]);

  /* ---------------- close menu on outside click ---------------- */
  React.useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !gripRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
        setTurnIntoOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setTurnIntoOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  /* ---------------- drag & drop ----------------
   *
   * The drop targets are wired with native listeners on the content
   * container: HTML5 drag events on React elements were never fired here
   * (the drag source is the grip button, so `drop` only lands on elements
   * that opt in via dragover+preventDefault — this effect is that opt-in).
   */
  const computeDropIndex = (clientY: number): number | null => {
    const blocks = getTopLevelBlocks(editor);
    for (const block of blocks) {
      const rect = block.dom?.getBoundingClientRect();
      if (!rect) continue;
      if (clientY < rect.top + rect.height / 2) return block.index;
    }
    return blocks.length;
  };

  const buildGhost = (blocks: BlockInfo[]) => {
    const ghost = document.createElement("div");
    ghost.className = "block-drag-ghost";
    ghost.style.position = "fixed";
    ghost.style.left = "-10000px";
    ghost.style.top = "0";
    for (const block of blocks.slice(0, 4)) {
      if (!block.dom) continue;
      const clone = block.dom.cloneNode(true) as HTMLElement;
      clone.removeAttribute("data-node-view-wrapper");
      ghost.appendChild(clone);
    }
    if (!blocks.length) ghost.textContent = "Block";
    document.body.appendChild(ghost);
    ghostRef.current = ghost;
  };

  const onDragStart = (e: React.DragEvent) => {
    const anchor = hoveredBlock.current;
    if (!anchor) return;
    // The page title is anchored to the top of the page — it never moves.
    if (anchor.node.type.name === "pageTitle") return;

    // Multi-block: drag everything the selection covers.
    const { selection } = editor.state;
    let blocks: BlockInfo[] = [];
    if (!selection.empty) {
      const all = getTopLevelBlocks(editor);
      blocks = all.filter((b) => b.to > selection.from && b.pos < selection.to);
    }
    if (blocks.length <= 1) blocks = [anchor];

    const indices = blocks.map((b) => b.index);
    dragPayload.current = { indices };
    setDragging(true);
    setMenuOpen(false);

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-aurora-blocks", JSON.stringify(indices));
    e.dataTransfer.setData("text/plain", "");
    buildGhost(blocks);
    if (ghostRef.current) {
      e.dataTransfer.setDragImage(ghostRef.current, 24, 16);
    }

    // Select the dragged range for context.
    if (blocks.length === 1) selectBlock(editor, anchor);
  };

  const positionIndicator = (clientY: number) => {
    const dropIndex = computeDropIndex(clientY);
    const indicator = indicatorRef.current;
    if (!indicator || dropIndex === null || !contentRef.current) return;

    const blocks = getTopLevelBlocks(editor);
    const contentRect = contentRef.current.getBoundingClientRect();
    let y: number;
    if (dropIndex >= blocks.length) {
      const last = blocks[blocks.length - 1];
      const rect = last?.dom?.getBoundingClientRect();
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

  const endDrag = React.useCallback(() => {
    dragPayload.current = null;
    setDragging(false);
    if (indicatorRef.current) indicatorRef.current.style.opacity = "0";
    ghostRef.current?.remove();
    ghostRef.current = null;
  }, []);

  // Attach the drop-zone listeners once — handlers read state via refs.
  React.useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const onDragOver = (e: DragEvent) => {
      if (!dragPayload.current) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      positionIndicator(e.clientY);
    };

    const onDrop = (e: DragEvent) => {
      if (!dragPayload.current) return;
      e.preventDefault();
      const dropIndex = computeDropIndex(e.clientY);
      if (dropIndex !== null) {
        moveBlocks(editor, dragPayload.current.indices, dropIndex);
      }
      endDrag();
    };

    const onDragEnd = () => endDrag();

    el.addEventListener("dragover", onDragOver);
    el.addEventListener("drop", onDrop);
    document.addEventListener("dragend", onDragEnd);
    document.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("drop", onDrop);
      document.removeEventListener("dragend", onDragEnd);
      document.removeEventListener("drop", onDrop);
    };
     
  }, [editor, contentRef, endDrag]);

  /* ---------------- actions ---------------- */
  const openMenu = () => {
    const anchor = hoveredBlock.current;
    const grip = gripRef.current;
    if (!anchor || !grip) return;
    selectBlock(editor, anchor);
    const rect = grip.getBoundingClientRect();
    const width = 232;
    setMenuAnchor({
      left: Math.min(rect.left + 34, window.innerWidth - width - 12),
      top: Math.min(rect.top - 6, window.innerHeight - 400),
    });
    setMenuOpen(true);
    setTurnIntoOpen(false);
  };

  const addBlockBelow = () => {
    const info = currentBlock(editor) ?? hoveredBlock.current;
    if (!info) return;
    editor
      .chain()
      .focus()
      .insertContentAt(info.to, { type: "paragraph" }, { updateSelection: true })
      .run();
  };

  const withMenuClose = (fn: () => void) => () => {
    setMenuOpen(false);
    setTurnIntoOpen(false);
    fn();
  };

  const closeMenu = React.useCallback(() => {
    setMenuOpen(false);
    setTurnIntoOpen(false);
  }, []);

  const runMenuAction = React.useCallback(
    (id: string) => {
      switch (id) {
        case "duplicate":
          duplicateBlock(editor);
          break;
        case "select": {
          const block = hoveredBlock.current;
          if (block) selectBlock(editor, block);
          break;
        }
        case "moveUp":
          moveBlockByStep(editor, -1);
          break;
        case "moveDown":
          moveBlockByStep(editor, 1);
          break;
        case "delete":
          editor.chain().focus().deleteSelection().run();
          break;
      }
    },
    [editor],
  );

  return (
    <>
      <div
        className={cn(
          "block-handle hidden lg:flex",
          visible && !dragging && "visible",
        )}
        style={position}
        data-block-handle-ui
      >
        <button
          type="button"
          title="Insert block below"
          aria-label="Insert block below"
          onClick={addBlockBelow}
        >
          <Plus size={15} />
        </button>
        <button
          ref={gripRef}
          type="button"
          title="Drag to move · Click for options"
          aria-label="Block options"
          draggable
          onDragStart={onDragStart}
          onDragEnd={endDrag}
          onClick={openMenu}
        >
          <GripVertical size={15} />
        </button>
      </div>

      {/* Block action menu */}
      <AnimatePresence>
        {menuOpen && (
          <BlockMenu
            ref={menuRef}
            editor={editor}
            hoveredBlock={hoveredBlock}
            turnIntoOpen={turnIntoOpen}
            onTurnIntoToggle={() => setTurnIntoOpen((v) => !v)}
            onClose={closeMenu}
            onAction={runMenuAction}
            style={menuAnchor ?? { left: 0, top: 0 }}
          />
        )}
      </AnimatePresence>

      {/* Drop indicator */}
      {createPortal(
        <div ref={indicatorRef} className="drop-indicator" style={{ opacity: 0 }} aria-hidden />,
        document.body,
      )}
    </>
  );
}

/** Static item descriptors — behavior is resolved at click time via onAction. */
const BLOCK_MENU_ITEMS = [
  { id: "duplicate", label: "Duplicate", icon: Clipboard, shortcut: "⌘D", danger: false },
  { id: "select", label: "Select block", icon: SquareMousePointer, shortcut: undefined, danger: false },
  { id: "moveUp", label: "Move up", icon: CornerUpLeft, shortcut: "⌥↑", danger: false },
  { id: "moveDown", label: "Move down", icon: ArrowDownUp, shortcut: "⌥↓", danger: false },
  { id: "delete", label: "Delete", icon: Trash2, shortcut: "⌫", danger: true },
] as const;

const BlockMenu = React.forwardRef<
  HTMLDivElement,
  {
    editor: Editor;
    hoveredBlock: React.RefObject<BlockInfo | null>;
    turnIntoOpen: boolean;
    onTurnIntoToggle: () => void;
    onClose: () => void;
    onAction: (id: string) => void;
    style: React.CSSProperties;
  }
>(function BlockMenu(
  { editor, turnIntoOpen, onTurnIntoToggle, onClose, onAction, style },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.96, y: 2 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.13, ease: [0.2, 0.8, 0.3, 1] }}
      style={{ width: 232, ...style }}
      className="fixed z-[100] rounded-xl border border-border/80 bg-popover/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
      role="menu"
      aria-label="Block options"
      data-block-handle-ui
      onMouseDown={(e) => e.preventDefault()}
    >
      {BLOCK_MENU_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            onClick={() => {
              onAction(item.id);
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors duration-100",
              item.danger ? "text-red-400 hover:bg-red-500/10" : "text-foreground/90 hover:bg-muted",
            )}
          >
            <Icon size={14.5} />
            <span className="flex-1">{item.label}</span>
            {"shortcut" in item && item.shortcut && <span className="kbd opacity-70">{item.shortcut}</span>}
          </button>
        );
      })}

      <div className="mx-2 my-1 h-px bg-border/70" role="separator" />

      {/* Turn into flyout */}
      <div className="relative">
        <button
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          onClick={onTurnIntoToggle}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-foreground/90 transition-colors duration-100 hover:bg-muted"
        >
          <ListPlus size={14.5} />
          <span className="flex-1">Turn into</span>
          <ChevronRight size={13} className="text-muted-foreground" />
        </button>
        {turnIntoOpen && (
          <div
            className="absolute left-[calc(100%-6px)] top-0 z-10 max-h-[330px] w-52 overflow-y-auto rounded-xl border border-border/80 bg-popover/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
            role="menu"
            aria-label="Turn into"
          >
            {TURN_INTO_OPTIONS.map((option) => {
              const OptionIcon = option.icon;
              const active = option.isActive(editor);
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    option.run(editor);
                    onClose();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors duration-100 hover:bg-muted",
                    active && "bg-primary/10 text-primary",
                  )}
                >
                  <OptionIcon size={14.5} />
                  <span className="flex-1">{option.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
});
