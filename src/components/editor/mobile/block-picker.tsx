"use client";

import * as React from "react";
import type { Editor } from "@tiptap/core";
import { AnimatePresence, motion } from "framer-motion";
import { Search, SearchX } from "lucide-react";
import {
  filterSlashItems,
  recordRecent,
  type SlashItem,
} from "../menus/slash-items";
import type { SlashActionHelpers } from "../extensions/slash-command";
import { cn } from "@/lib/utils";

/**
 * Mobile block picker — replaces the keyboard area when the user taps ➕.
 *
 * The sheet's height is frozen at the keyboard footprint it inherited, so
 * swapping keyboard ⇄ panel never shifts the document. `bottom` is
 * computed by the parent: screen-anchored during the swap (revealed as
 * the keyboard retreats), and lifted above the keyboard while the search
 * field has the keyboard open.
 */

export function BlockPicker({
  editor,
  helpers,
  open,
  height,
  bottom,
  onSearchFocusChange,
  onClose,
  onPick,
}: {
  editor: Editor;
  helpers: SlashActionHelpers;
  open: boolean;
  /** Frozen sheet height (px) — the height the keyboard used to occupy. */
  height: number;
  /** CSS `bottom` for the sheet (parent computes the swap geometry). */
  bottom: number;
  /** The search field re-opens the keyboard — the parent lifts the sheet
   * (and the toolbar above it) while it holds focus. */
  onSearchFocusChange?: (focused: boolean) => void;
  onClose: () => void;
  /** Called after a block was inserted; decides refocus (parent). */
  onPick: (item: SlashItem) => void;
}) {
  const [query, setQuery] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Commit-once-per-gesture flag shared by the pointerup + click paths.
  const pickedInGesture = React.useRef(false);

  // The search keyboard can drop the sheet's lift the moment the input
  // blurs — which happens at POINTERDOWN on an item. Delay the reported
  // blur slightly so the sheet stays visually still until the tap gesture
  // has fully landed (pointer capture below makes delivery robust anyway).
  const blurTimer = React.useRef<number | null>(null);
  const reportSearchFocus = React.useCallback(
    (focused: boolean) => {
      if (blurTimer.current !== null) {
        window.clearTimeout(blurTimer.current);
        blurTimer.current = null;
      }
      if (focused) {
        onSearchFocusChange?.(true);
        return;
      }
      blurTimer.current = window.setTimeout(() => {
        blurTimer.current = null;
        onSearchFocusChange?.(false);
      }, 220);
    },
    [onSearchFocusChange],
  );

  React.useEffect(
    () => () => {
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
    },
    [],
  );

  React.useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const groups = React.useMemo(() => filterSlashItems(query), [query]);

  const commitPick = React.useCallback(
    (item: SlashItem) => {
      if (pickedInGesture.current) return;
      pickedInGesture.current = true;
      recordRecent(item.id);
      // The selection survived the blur — insert at the exact caret the
      // user left off.
      const range = {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      };
      item.action({ editor, range, ...helpers });
      onPick(item);
    },
    [editor, helpers, onPick],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="block-picker"
          initial={{ y: height }}
          animate={{ y: 0 }}
          exit={{ y: height }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.3, 1] }}
          style={{ bottom, height }}
          className="block-picker-sheet"
          role="dialog"
          aria-label="Insert block"
        >
          {/* Search — ready now, not just future: filters with the same
              ranking engine as the desktop slash menu. */}
          <div className="px-3 pb-2 pt-3">
            <div className="flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-muted/50 px-3">
              <Search size={15} className="shrink-0 text-muted-foreground" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => reportSearchFocus(true)}
                onBlur={() => reportSearchFocus(false)}
                placeholder="Search blocks…"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Search blocks"
                className="h-full w-full bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/70"
              />
            </div>
          </div>

          <div ref={scrollRef} className="block-picker-scroll">
            {groups.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <SearchX size={22} aria-hidden />
                <p className="text-[13px]">No blocks match “{query}”</p>
              </div>
            )}

            {groups.map((group) => (
              <section key={group.category} aria-label={group.category} className="mb-1.5">
                <h3 className="px-1 pb-1.5 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/80">
                  {group.category}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        /* Pointer capture holds the whole gesture on this
                         * item even if the sheet moves beneath the finger
                         * (search-blur can drop the keyboard lift mid-tap);
                         * without it the browser re-targets the click to
                         * the document and the pick silently dead-ends. */
                        onPointerDown={(e) => {
                          pickedInGesture.current = false;
                          const el = e.currentTarget;
                          el.dataset.gx = String(e.clientX);
                          el.dataset.gy = String(e.clientY);
                          try {
                            el.setPointerCapture(e.pointerId);
                          } catch {
                            /* older engines without pointer capture */
                          }
                        }}
                        onPointerUp={(e) => {
                          const el = e.currentTarget;
                          const dx = e.clientX - Number(el.dataset.gx ?? e.clientX);
                          const dy = e.clientY - Number(el.dataset.gy ?? e.clientY);
                          // Moved well beyond tap slop → that was a scroll
                          // on the list, not a pick.
                          if (Math.hypot(dx, dy) <= 12) commitPick(item);
                        }}
                        onClick={() => commitPick(item)}
                        className={cn(
                          "block-picker-item",
                        )}
                      >
                        <span className="block-picker-item-icon">
                          <Icon size={16} strokeWidth={1.9} />
                        </span>
                        <span className="min-w-0 truncate text-[13.5px] font-medium">
                          {item.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* Drag handle affordance + close row */}
          <div className="flex items-center justify-center border-t border-border/60 pb-[max(env(safe-area-inset-bottom),10px)] pt-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close block menu"
              className="flex h-7 w-16 items-center justify-center rounded-full bg-muted/70 text-muted-foreground transition-colors active:bg-muted"
            >
              <span className="h-1 w-9 rounded-full bg-current" aria-hidden />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
