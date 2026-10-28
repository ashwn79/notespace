"use client";

import * as React from "react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { Search, SearchX } from "lucide-react";
import { emojiController } from "../extensions/emoji-command";
import { searchEmojis } from "@/lib/editor/emoji-data";
import { anchoredMenuStyle } from "./menu-position";
import { cn } from "@/lib/utils";

/**
 * ":" quick emoji picker. Filters as you type (":smile" → 😄 …), supports
 * full keyboard navigation in the grid, inserts at the caret and closes
 * with Esc. Powered by the same suggestion pipeline as "/" and "@".
 */

const COLS = 8;

interface MenuState {
  open: boolean;
  props: SuggestionProps<{ emoji: string }> | null;
}

export function EmojiMenu() {
  const [state, setState] = React.useState<MenuState>({ open: false, props: null });
  const [dismissed, setDismissed] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [, forceTick] = React.useState(0);
  const gridRef = React.useRef<HTMLDivElement>(null);

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

  const query = state.props?.query ?? "";
  const emojis = React.useMemo(() => searchEmojis(query), [query]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  React.useEffect(() => {
    if (!state.open) return;
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, state.open]);

  const selectEmoji = React.useCallback(
    (emoji: string) => {
      state.props?.command({ emoji });
      setState({ open: false, props: null });
    },
    [state.props],
  );

  const handleKeyDown = React.useCallback(
    (keyProps: SuggestionKeyDownProps): boolean => {
      const event = keyProps.event;
      const count = emojis.length;
      if (!count) {
        if (event.key === "Escape") {
          event.preventDefault();
          setDismissed(true);
          setState((prev) => ({ ...prev, open: false }));
          return true;
        }
        return false;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % count);
        return true;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex((prev) => (prev - 1 + count) % count);
        return true;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => (prev + COLS) % count);
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => (prev - COLS + count) % count);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const entry = emojis[activeIndex];
        if (entry) selectEmoji(entry.c);
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
    [emojis, activeIndex, selectEmoji],
  );

  React.useEffect(() => {
    emojiController.attach({
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
    return () => emojiController.detach();
  }, [handleKeyDown]);

  if (!state.open || dismissed) return null;

  const rect = state.props?.clientRect?.() ?? null;
  const style = anchoredMenuStyle(rect, { width: 344, height: 300 });

  return (
    <div
      role="dialog"
      aria-label="Emoji picker"
      style={style}
      className="fixed z-[95] w-[344px] overflow-hidden rounded-xl border border-border/80 bg-popover/95 text-popover-foreground shadow-2xl shadow-black/40 backdrop-blur-xl animate-pop-in max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0"
    >
      {emojis.length > 0 ? (
        <div
          ref={gridRef}
          role="listbox"
          aria-label="Emoji results"
          className="max-h-[252px] overflow-y-auto overscroll-contain p-2"
        >
          <div className="grid grid-cols-8 gap-0.5">
            {emojis.map((entry, index) => {
              const active = index === activeIndex;
              return (
                <button
                  key={`${entry.c}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  aria-label={entry.n}
                  title={entry.n}
                  data-index={index}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectEmoji(entry.c)}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-lg text-[19px] leading-none transition-transform duration-100 hover:scale-110",
                    active && "scale-110 bg-primary/15 ring-1 ring-primary/40",
                  )}
                >
                  {entry.c}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-muted-foreground">
          <SearchX size={22} className="opacity-50" />
          <p className="text-[13px] font-medium">No emoji matches “{query}”</p>
          <p className="text-xs opacity-80">Try “smile”, “heart”, “fire”, “star”…</p>
        </div>
      )}
      <div className="flex items-center gap-3 border-t border-border/60 bg-muted/30 px-3.5 py-2 text-[11px] text-muted-foreground">
        {emojis.length > 0 ? (
          <>
            <span className="flex items-center gap-1">
              <span className="kbd">↑</span>
              <span className="kbd">↓</span>
              <span className="kbd">←</span>
              <span className="kbd">→</span> navigate
            </span>
            <span className="flex items-center gap-1">
              <span className="kbd">↵</span> insert
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1.5 opacity-80">
            <Search size={11} /> keep typing to search
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          <span className="kbd">esc</span> close
        </span>
      </div>
    </div>
  );
}
