"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline calendar for date mentions — month & year navigation, mouse +
 * keyboard selection (arrows, Enter, PageUp/PageDown via the host router),
 * a Today shortcut and an optional Clear button.
 *
 * Keyboard interaction is *state-driven* (a highlighted cursor date) rather
 * than DOM-focus driven, so the AtMenu can route keys to it while the
 * editor keeps focus — zero focus juggling, zero event leaks. All hot
 * paths go through refs so React StrictMode double-invocation can never
 * double-fire `onSelect`.
 */

export interface CalendarHandle {
  moveCursor: (days: number) => void;
  pickCursor: () => void;
}

interface CalendarProps {
  selected: string | null;
  onSelect: (iso: string) => void;
  /** Range end (End-date feature) — days between selected and rangeEnd tint. */
  rangeEnd?: string | null;
  /** @deprecated Clear is owned by the host panel now. */
  allowClear?: boolean;
  /** @deprecated Clear is owned by the host panel now. */
  onClear?: () => void;
  handleRef?: (handle: CalendarHandle | null) => void;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function isoOf(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function Calendar({
  selected,
  onSelect,
  rangeEnd,
  handleRef,
}: CalendarProps) {
  const todayISO = React.useMemo(() => isoOf(new Date()), []);

  const [view, setView] = React.useState<Date>(() => {
    const base = selected ? new Date(`${selected}T00:00:00`) : new Date();
    return Number.isNaN(base.getTime()) ? new Date() : new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [cursor, setCursor] = React.useState<string>(selected ?? todayISO);

  const cursorRef = React.useRef(cursor);
  const viewRef = React.useRef(view);
  const selectRef = React.useRef(onSelect);
  React.useEffect(() => {
    selectRef.current = onSelect;
  });

  const setCursorSafe = (iso: string) => {
    cursorRef.current = iso;
    setCursor(iso);
  };
  const setViewSafe = (d: Date) => {
    viewRef.current = d;
    setView(d);
  };

  // Jump the visible month to the range end when it moves out of view.
  React.useEffect(() => {
    if (!rangeEnd) return;
    const end = new Date(`${rangeEnd}T00:00:00`);
    if (Number.isNaN(end.getTime())) return;
    const v = viewRef.current;
    if (end.getMonth() !== v.getMonth() || end.getFullYear() !== v.getFullYear()) {
      const sel = selected ? new Date(`${selected}T00:00:00`) : null;
      const selMatches =
        sel && sel.getMonth() === v.getMonth() && sel.getFullYear() === v.getFullYear();
      if (!selMatches) {
        setViewSafe(new Date(end.getFullYear(), end.getMonth(), 1));
      }
    }
  }, [rangeEnd]);

  React.useEffect(() => {
    if (!handleRef) return;
    const handle: CalendarHandle = {
      moveCursor: (days: number) => {
        const base = cursorRef.current ? new Date(`${cursorRef.current}T00:00:00`) : new Date();
        base.setDate(base.getDate() + days);
        const v = viewRef.current;
        if (base.getMonth() !== v.getMonth() || base.getFullYear() !== v.getFullYear()) {
          setViewSafe(new Date(base.getFullYear(), base.getMonth(), 1));
        }
        setCursorSafe(isoOf(base));
      },
      pickCursor: () => selectRef.current(cursorRef.current),
    };
    handleRef(handle);
    return () => handleRef(null);
  }, [handleRef]);

  const shiftMonth = (delta: number) => {
    const v = viewRef.current;
    setViewSafe(new Date(v.getFullYear(), v.getMonth() + delta, 1));
  };

  // Build the 6-week grid for the visible month.
  const cells = React.useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const out: { iso: string; day: number; outside: boolean }[] = [];

    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(view.getFullYear(), view.getMonth(), -i);
      out.push({ iso: isoOf(d), day: d.getDate(), outside: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ iso: isoOf(new Date(view.getFullYear(), view.getMonth(), d)), day: d, outside: false });
    }
    let next = new Date(view.getFullYear(), view.getMonth() + 1, 1);
    while (out.length < 42) {
      out.push({ iso: isoOf(next), day: next.getDate(), outside: true });
      next = new Date(next.getFullYear(), next.getMonth(), next.getDate() + 1);
    }
    return out;
  }, [view]);

  return (
    <div className="w-[252px] select-none">
      {/* Header — Notion layout: month · Today · prev/next */}
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <div className="text-[13px] font-semibold" aria-live="polite">
          {view.toLocaleDateString("en-US", { month: "long" })}{" "}
          <span className="font-normal text-muted-foreground">{view.getFullYear()}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              setCursorSafe(todayISO);
              selectRef.current(todayISO);
            }}
            className="cal-nav-btn px-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            Today
          </button>
          <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)} className="cal-nav-btn" tabIndex={-1}>
            <ChevronLeft size={14} />
          </button>
          <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)} className="cal-nav-btn" tabIndex={-1}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-0.5" aria-hidden>
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-center text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground/70">
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div role="grid" aria-label="Calendar" className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, i) => {
          const isSelected = selected === cell.iso;
          const isCursor = cursor === cell.iso;
          const isToday = cell.iso === todayISO;
          const inRange =
            selected && rangeEnd
              ? cell.iso >= (selected < rangeEnd ? selected : rangeEnd) &&
                cell.iso <= (selected < rangeEnd ? rangeEnd : selected)
              : false;
          return (
            <button
              key={`${cell.iso}-${i}`}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-label={new Date(`${cell.iso}T00:00:00`).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              tabIndex={-1}
              onMouseEnter={() => setCursorSafe(cell.iso)}
              onClick={() => {
                setCursorSafe(cell.iso);
                selectRef.current(cell.iso);
              }}
              className={cn(
                "cal-day",
                cell.outside && "cal-day-outside",
                isToday && "cal-day-today",
                inRange && !isSelected && "cal-day-inrange",
                isCursor && !isSelected && "cal-day-cursor",
                isSelected && "cal-day-selected",
              )}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      {/* Footer hint (Clear lives in the host panel) */}
      <div className="mt-1.5 flex items-center justify-end border-t border-border/50 pt-1.5">
        <span className="text-[10.5px] text-muted-foreground/60">↑↓←→ navigate · ↵ pick</span>
      </div>
    </div>
  );
}
