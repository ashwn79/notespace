"use client";

import * as React from "react";
import type { Editor } from "@tiptap/core";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, CaseSensitive, Replace, ReplaceAll, X } from "lucide-react";
import { SearchReplaceKey } from "../extensions/search-replace";
import { cn } from "@/lib/utils";

/**
 * Find & replace panel — instant highlight matches, count, keyboard loop,
 * single & replace-all. Matches are rendered by the search-replace extension.
 */
export function SearchPanel({
  editor,
  open,
  onClose,
}: {
  editor: Editor;
  open: boolean;
  onClose: () => void;
}) {
  const [term, setTerm] = React.useState("");
  const [replacement, setReplacement] = React.useState("");
  const [caseSensitive, setCaseSensitive] = React.useState(false);
  const [matchCount, setMatchCount] = React.useState(0);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [showReplace, setShowReplace] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Sync plugin state → panel.
  React.useEffect(() => {
    const update = () => {
      const s = SearchReplaceKey.getState(editor.state);
      if (!s) return;
      setMatchCount(s.matches.length);
      setActiveIndex(s.activeIndex < 0 ? 0 : s.activeIndex + 1);
    };
    editor.on("transaction", update);
    return () => editor.off("transaction", update);
  }, [editor]);

  // Push term → plugin (debounced for instant-but-stable results).
  React.useEffect(() => {
    const t = window.setTimeout(() => {
      editor.commands.setSearchTerm(term, caseSensitive);
    }, 140);
    return () => window.clearTimeout(t);
  }, [term, caseSensitive, editor]);

  // Reset when closed. (Skipped on first mount — the plugin state is
  // already empty, and dispatching before the view settles can race
  // editor initialization under StrictMode.)
  const everOpened = React.useRef(false);
  React.useEffect(() => {
    if (!open) {
      if (everOpened.current) {
        editor.commands.setSearchTerm("");
        setTerm("");
        setReplacement("");
      }
      return;
    }
    everOpened.current = true;
    window.setTimeout(() => inputRef.current?.focus(), 60);
  }, [open, editor]);

  // Global Escape to close (works even when the panel isn't focused).
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const scrollToActive = () => {
    requestAnimationFrame(() => {
      document
        .querySelector(".search-match-active")
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };

  const goNext = () => {
    editor.commands.gotoMatch(1);
    scrollToActive();
  };
  const goPrev = () => {
    editor.commands.gotoMatch(-1);
    scrollToActive();
  };

  const replaceOne = () => {
    editor.commands.replaceActiveMatch(replacement);
    scrollToActive();
  };

  const replaceAll = () => {
    const count = matchCount;
    editor.commands.replaceAllMatches(replacement);
    if (count > 0) {
      // toast? keep silent — panel count updates.
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) goPrev();
      else goNext();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.16, ease: [0.2, 0.8, 0.3, 1] }}
          className="fixed left-1/2 top-3 z-[96] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 rounded-xl border border-border/80 bg-popover/95 p-2.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
          role="dialog"
          aria-label="Search and replace"
          onKeyDown={onKeyDown}
        >
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search document…"
                className="h-9 w-full rounded-lg border border-border bg-muted/40 pl-3 pr-24 text-[13.5px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                <button
                  type="button"
                  title="Match case"
                  aria-pressed={caseSensitive}
                  onClick={() => setCaseSensitive((v) => !v)}
                  className={cn(
                    "editor-icon-btn h-6 w-6 rounded-md",
                    caseSensitive && "bg-primary/15 text-primary",
                  )}
                >
                  <CaseSensitive size={13} />
                </button>
                <span className="min-w-14 text-center text-[11px] tabular-nums text-muted-foreground">
                  {term ? `${activeIndex || (matchCount ? 1 : 0)} / ${matchCount}` : "0 / 0"}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="editor-icon-btn"
              title="Previous match (Shift+Enter)"
              disabled={!matchCount}
              onClick={goPrev}
            >
              <ArrowUp size={15} />
            </button>
            <button
              type="button"
              className="editor-icon-btn"
              title="Next match (Enter)"
              disabled={!matchCount}
              onClick={goNext}
            >
              <ArrowDown size={15} />
            </button>
            <button
              type="button"
              className="editor-icon-btn"
              title={showReplace ? "Hide replace" : "Show replace"}
              aria-pressed={showReplace}
              onClick={() => setShowReplace((v) => !v)}
            >
              <Replace size={15} />
            </button>
            <button type="button" className="editor-icon-btn" title="Close (Esc)" onClick={onClose}>
              <X size={15} />
            </button>
          </div>

          {showReplace && (
            <div className="mt-2 flex items-center gap-2 animate-fade-slide-up">
              <input
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                placeholder="Replace with…"
                className="h-9 flex-1 rounded-lg border border-border bg-muted/40 px-3 text-[13.5px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
              />
              <button
                type="button"
                onClick={replaceOne}
                disabled={!matchCount}
                className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-foreground/90 transition-colors hover:bg-muted disabled:opacity-40"
              >
                <Replace size={12} /> Replace
              </button>
              <button
                type="button"
                onClick={replaceAll}
                disabled={!matchCount}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <ReplaceAll size={12} /> All
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
