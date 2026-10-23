"use client";

import * as React from "react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { ChevronRight } from "lucide-react";
import { slashController } from "../extensions/slash-command";
import {
  filterSlashItems,
  flattenSlashItems,
  recordRecent,
  type SlashItem,
} from "./slash-items";
import { cn } from "@/lib/utils";

/**
 * The "/" command palette. Notion-style: categorized, fuzzy-filtered,
 * fully keyboard driven, with recent items pinned on top.
 */

interface MenuState {
  open: boolean;
  props: SuggestionProps<SlashItem> | null;
}

export function SlashMenu() {
  const [state, setState] = React.useState<MenuState>({ open: false, props: null });
  const [dismissed, setDismissed] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [, forceTick] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Keep the menu glued to the caret while scrolling / resizing.
  React.useEffect(() => {
    if (!state.open) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => forceTick((t) => t + 1));
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [state.open]);

  const query = state.props?.query?.replace(/^\//, "") ?? "";
  const groups = React.useMemo(() => filterSlashItems(query), [query]);
  const items = React.useMemo(() => flattenSlashItems(groups), [groups]);

  // Flat index where each group starts (for aria/active lookups).
  const groupStarts = React.useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    for (const group of groups) {
      starts.push(acc);
      acc += group.items.length;
    }
    return starts;
  }, [groups]);

  React.useEffect(() => {
    setActiveIndex((prev) => (prev >= items.length ? 0 : prev));
  }, [items.length]);

  // Scroll active item into view.
  React.useEffect(() => {
    if (!state.open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, state.open]);

  const selectItem = React.useCallback(
    (item: SlashItem) => {
      recordRecent(item.id);
      state.props?.command(item);
      setState({ open: false, props: null });
    },
    [state.props],
  );

  // Keyboard handling — stable identity per items/selection change; the
  // attach effect re-registers whenever it changes.
  const handleKeyDown = React.useCallback(
    (keyProps: SuggestionKeyDownProps): boolean => {
      const event = keyProps.event;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (items.length) setActiveIndex((prev) => (prev + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (items.length) setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const item = items[activeIndex];
        if (item) selectItem(item);
        return true;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDismissed(true);
        setState((prev) => ({ ...prev, open: false }));
        return true;
      }
      return false;
    },
    [items, activeIndex, selectItem],
  );

  React.useEffect(() => {
    slashController.attach({
      onStart: (props) => {
        setDismissed(false);
        setActiveIndex(0);
        setState({ open: true, props });
      },
      onUpdate: (props) => {
        setDismissed(false);
        setState((prev) => ({ open: true, props }));
      },
      onExit: () => {
        setState({ open: false, props: null });
      },
      onKeyDown: handleKeyDown,
    });
    return () => slashController.detach();
  }, [handleKeyDown]);

  if (!state.open || dismissed || items.length === 0) return null;

  const rect = state.props?.clientRect?.();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  let style: React.CSSProperties = {};
  if (isMobile) {
    style = { left: 0, right: 0, bottom: 0, top: "auto", maxWidth: "100%" };
  } else if (rect) {
    const menuHeight = 336;
    const flip = rect.bottom + menuHeight + 16 > window.innerHeight;
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - 352);
    style = flip
      ? { left, bottom: window.innerHeight - rect.top + 8, top: "auto" }
      : { left, top: rect.bottom + 8 };
  }

  return (
    <div
      role="dialog"
      aria-label="Block insertion menu"
      style={style}
      className="fixed z-[95] w-[344px] overflow-hidden rounded-xl border border-border/80 bg-popover/95 text-popover-foreground shadow-2xl shadow-black/40 backdrop-blur-xl animate-pop-in max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0"
    >
      <div
        ref={listRef}
        role="listbox"
        aria-label="Commands"
        className="max-h-[300px] overflow-y-auto overscroll-contain p-1.5"
      >
        {groups.map((group, groupIndex) => {
          const start = groupStarts[groupIndex] ?? 0;
          return (
            <div key={group.category} role="group" aria-label={group.category}>
              <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                {group.category}
              </div>
              {group.items.map((item) => {
                const index = start + group.items.indexOf(item);
                const active = index === activeIndex;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-index={index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectItem(item)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-100",
                      active ? "bg-accent text-accent-foreground" : "text-foreground/90",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/60 transition-colors",
                        active && "border-primary/30 bg-primary/15 text-primary",
                      )}
                    >
                      <Icon size={17} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium leading-5">{item.title}</span>
                      <span className="block truncate text-xs leading-4 text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                    {item.shortcut ? (
                      <span className="kbd shrink-0 opacity-70">{item.shortcut.replace("Mod-Alt-", "⌥")}</span>
                    ) : (
                      <ChevronRight
                        size={14}
                        className={cn("shrink-0 text-muted-foreground transition-opacity", active ? "opacity-60" : "opacity-0")}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 border-t border-border/60 bg-muted/30 px-3.5 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="kbd">↑</span>
          <span className="kbd">↓</span> navigate
        </span>
        <span className="flex items-center gap-1">
          <span className="kbd">↵</span> select
        </span>
        <span className="flex items-center gap-1">
          <span className="kbd">esc</span> dismiss
        </span>
      </div>
    </div>
  );
}
