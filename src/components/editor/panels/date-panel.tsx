"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  type MentionDateAttrs,
  type ReminderOption,
  REMINDER_OPTIONS,
  dateChipLabel,
  formatLongDate,
  formatTime,
  fromISO,
  parseDateInput,
  reminderLabel,
  toISO,
  todayISO,
} from "@/lib/editor/dates";

/**
 * Notion-style date panel (matches the reference design):
 *
 *   [ Oct 25, 2026 ]  ( + [ Oct 27, 2026 ] when a range is set )
 *   Oct 2026          Today          <  >
 *   Su Mo Tu We Th Fr Sa
 *   … calendar grid with range shading …
 *   ─────────────────────────────
 *   End date                    [ ]
 *   Date format        Relative >
 *   Include time                [ ]
 *   Remind                  None >
 *   ─────────────────────────────
 *   Clear
 */

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface DatePanelProps {
  attrs: MentionDateAttrs;
  onChange: (patch: Partial<MentionDateAttrs>) => void;
  onClear: () => void;
  onClose: () => void;
  anchorRect: DOMRect;
}

export function DatePanel({ attrs, onChange, onClear, onClose, anchorRect }: DatePanelProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = React.useState(470);
  const initial = fromISO(attrs.date ?? todayISO()) ?? new Date();
  const [viewMonth, setViewMonth] = React.useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [editing, setEditing] = React.useState<"start" | "end">("start");
  const [expanded, setExpanded] = React.useState<"format" | "remind" | null>(null);
  const [startText, setStartText] = React.useState(() => formatLongDate(attrs.date ?? ""));
  const [endText, setEndText] = React.useState(() => (attrs.endDate ? formatLongDate(attrs.endDate) : ""));

  const isRange = Boolean(attrs.endDate);

  // Track the real panel height (rows/submenus change it) for placement.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setMeasuredHeight(el.offsetHeight || 470);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    setStartText(formatLongDate(attrs.date ?? ""));
    setEndText(attrs.endDate ? formatLongDate(attrs.endDate) : "");
  }, [attrs.date, attrs.endDate]);

  /* Outside click / Escape */
  React.useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  const patchAndSync = (patch: Partial<MentionDateAttrs>) => {
    onChange(patch);
    if (patch.date !== undefined) setViewMonth(monthOf(patch.date));
    if (patch.endDate !== undefined && patch.endDate) setViewMonth(monthOf(patch.endDate));
  };

  const commitText = (which: "start" | "end") => {
    const raw = which === "start" ? startText : endText;
    const parsed = parseDateInput(raw);
    if (parsed) {
      if (which === "start") {
        patchAndSync({ date: parsed });
      } else {
        const current = attrs.date;
        patchAndSync({ endDate: parsed < current ? current : parsed });
      }
    } else {
      setStartText(formatLongDate(attrs.date ?? ""));
      setEndText(attrs.endDate ? formatLongDate(attrs.endDate) : "");
    }
  };

  const pickDay = (iso: string) => {
    if (!isRange || editing === "start") {
      setEditing(isRange ? "end" : "start");
      patchAndSync({ date: iso });
      if (isRange && attrs.endDate && attrs.endDate < iso) {
        onChange({ date: iso, endDate: iso });
      }
    } else {
      // Editing the range end — swap when it lands before the start.
      if (iso < attrs.date) {
        patchAndSync({ date: iso, endDate: attrs.date });
      } else {
        patchAndSync({ endDate: iso });
      }
      setEditing("start");
    }
  };

  const toggleEndDate = (checked: boolean) => {
    if (checked) {
      setEditing("end");
      patchAndSync({ endDate: attrs.date });
    } else {
      setEditing("start");
      patchAndSync({ endDate: null, endTime: "" });
    }
  };

  const toggleIncludeTime = (checked: boolean) => {
    patchAndSync({
      includeTime: checked,
      startTime: checked && !attrs.startTime ? "09:00" : attrs.startTime,
    });
  };

  /* ---------------- calendar grid ---------------- */
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstCell = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstCell.getDay());
  const weeks: (string | null)[][] = [];
  for (let w = 0; w < 6; w += 1) {
    const row: (string | null)[] = [];
    for (let d = 0; d < 7; d += 1) {
      const cell = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + w * 7 + d);
      row.push(toISO(cell));
    }
    weeks.push(row);
  }
  const today = todayISO();

  /* ---------------- positioning ---------------- */
  const width = 332;
  let style: React.CSSProperties;
  const left = Math.min(Math.max(12, anchorRect.left), window.innerWidth - width - 12);
  const vh = window.innerHeight;
  const spaceBelow = vh - anchorRect.bottom;
  const spaceAbove = anchorRect.top;

  if (spaceBelow >= measuredHeight + 12 || spaceBelow >= spaceAbove) {
    // Below (clamped so it never leaves the viewport).
    style = { left, top: Math.min(anchorRect.bottom + 8, Math.max(8, vh - measuredHeight - 8)) };
  } else {
    // Flipped above the anchor (also clamped).
    style = { left, top: Math.max(8, anchorRect.top - measuredHeight - 8) };
  }

  return createPortal(
    <motion.div
      ref={ref}
      role="dialog"
      aria-label="Date options"
      initial={{ opacity: 0, y: 4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.15, ease: [0.2, 0.8, 0.3, 1] }}
      style={{ width, ...style }}
      className="fixed z-[110] rounded-xl border border-border/80 bg-popover p-3 text-popover-foreground shadow-2xl shadow-black/50 backdrop-blur-xl animate-pop-in"
    >
      {/* Date text fields */}
      <div className={cn("grid gap-2", isRange && "grid-cols-2")}>
        <DateField
          value={startText}
          active={editing === "start"}
          ariaLabel="Start date"
          onChange={(v) => setStartText(v)}
          onCommit={() => commitText("start")}
          onFocus={() => setEditing("start")}
        />
        {isRange && (
          <DateField
            value={endText}
            active={editing === "end"}
            ariaLabel="End date"
            onChange={(v) => setEndText(v)}
            onCommit={() => commitText("end")}
            onFocus={() => setEditing("end")}
          />
        )}
      </div>

      {/* Time fields */}
      {attrs.includeTime && (
        <div className={cn("mt-2 grid gap-2", isRange && "grid-cols-2")}>
          <label className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/30 px-2.5 py-1.5 text-xs">
            <ClockIcon />
            <input
              type="time"
              aria-label="Start time"
              value={attrs.startTime}
              onChange={(e) => onChange({ startTime: e.target.value })}
              className="w-full bg-transparent text-[13px] outline-none [color-scheme:dark]"
            />
          </label>
          {isRange && (
            <label className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/30 px-2.5 py-1.5 text-xs">
              <ClockIcon />
              <input
                type="time"
                aria-label="End time"
                value={attrs.endTime}
                onChange={(e) => onChange({ endTime: e.target.value })}
                className="w-full bg-transparent text-[13px] outline-none [color-scheme:dark]"
              />
            </label>
          )}
        </div>
      )}

      {/* Month header */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-[14px] font-semibold tracking-tight">
          {monthLabel(year, month)}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setEditing("start");
              patchAndSync({ date: today });
            }}
            className="rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setViewMonth(new Date(year, month - 1, 1))}
            className="editor-icon-btn h-7 w-7"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setViewMonth(new Date(year, month + 1, 1))}
            className="editor-icon-btn h-7 w-7"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Weekday row */}
      <div className="mt-1.5 grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground" aria-hidden>
        {WEEKDAYS.map((day) => (
          <span key={day} className="py-1">{day}</span>
        ))}
      </div>

      {/* Day grid */}
      <div
        className="grid grid-cols-7 gap-y-0.5"
        role="grid"
        aria-label="Calendar"
        onKeyDown={onGridKeyDown}
      >
        {weeks.flat().map((iso, index) => {
          if (!iso) return <span key={index} />;
          const date = fromISO(iso)!;
          const outside = date.getMonth() !== month;
          const isStart = iso === attrs.date;
          const isEnd = isRange && iso === attrs.endDate;
          const inRange = isRange && iso > attrs.date && (attrs.endDate ?? "") > iso;
          const isToday = iso === today;

          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              aria-selected={isStart || isEnd}
              aria-label={formatLongDate(iso)}
              tabIndex={index === 0 ? 0 : -1}
              onClick={() => pickDay(iso)}
              className={cn(
                "relative mx-auto flex h-8 w-9 items-center justify-center rounded-lg text-[13px] tabular-nums transition-colors duration-75",
                "hover:bg-accent hover:text-accent-foreground",
                outside && "text-muted-foreground/45",
                inRange && "rounded-none bg-primary/20 text-foreground hover:bg-primary/30",
                isToday && !isStart && !isEnd && "font-semibold text-primary",
                (isStart || isEnd) && "rounded-lg bg-primary font-semibold text-primary-foreground hover:bg-primary",
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="my-2.5 h-px bg-border/60" role="separator" />

      {/* Option rows */}
      <PanelRow label="End date">
        <Switch checked={isRange} onCheckedChange={toggleEndDate} aria-label="Toggle end date" />
      </PanelRow>
      <PanelRow
        label="Date format"
        value={attrs.format === "relative" ? "Relative" : "Absolute"}
        onClick={() => setExpanded(expanded === "format" ? null : "format")}
      />
      {expanded === "format" && (
        <div className="mb-1 ml-1 space-y-0.5 rounded-lg bg-muted/40 p-1">
          <SubOption
            label="Relative"
            hint="Today, Tomorrow, Mon…"
            active={attrs.format === "relative"}
            onClick={() => {
              onChange({ format: "relative" });
              setExpanded(null);
            }}
          />
          <SubOption
            label="Absolute"
            hint="October 25, 2026"
            active={attrs.format === "absolute"}
            onClick={() => {
              onChange({ format: "absolute" });
              setExpanded(null);
            }}
          />
        </div>
      )}
      <PanelRow label="Include time">
        <Switch checked={attrs.includeTime} onCheckedChange={toggleIncludeTime} aria-label="Toggle time" />
      </PanelRow>
      <PanelRow
        label="Remind"
        value={reminderLabel(attrs.reminder)}
        onClick={() => setExpanded(expanded === "remind" ? null : "remind")}
      />
      {expanded === "remind" && (
        <div className="mb-1 max-h-52 space-y-0.5 overflow-y-auto rounded-lg bg-muted/40 p-1 smooth-scroll">
          {REMINDER_OPTIONS.map((option: ReminderOption) => (
            <SubOption
              key={option.id}
              label={option.label}
              active={(attrs.reminder ?? "none") === option.id}
              onClick={() => {
                onChange({ reminder: option.id === "none" ? null : option.id });
                setExpanded(null);
              }}
            />
          ))}
        </div>
      )}

      <div className="my-1 h-px bg-border/60" role="separator" />

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg px-2 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Clear
        </button>
        <span className="pr-1 text-[11px] text-muted-foreground/70" aria-live="polite">
          {dateChipLabel(attrs)}
        </span>
      </div>
    </motion.div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */

function DateField({
  value,
  active,
  ariaLabel,
  onChange,
  onCommit,
  onFocus,
}: {
  value: string;
  active: boolean;
  ariaLabel: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onFocus: () => void;
}) {
  return (
    <input
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onFocus={onFocus}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit();
        }
      }}
      className={cn(
        "h-9 w-full rounded-lg border bg-muted/30 px-2.5 text-[13.5px] font-medium outline-none transition-colors",
        active ? "border-primary ring-2 ring-primary/25" : "border-border/70 hover:border-border",
      )}
    />
  );
}

function PanelRow({
  label,
  value,
  onClick,
  children,
}: {
  label: string;
  value?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const content = (
    <>
      <span className="text-[13.5px]">{label}</span>
      <span className="flex-1" />
      {value !== undefined && (
        <span className="flex items-center gap-0.5 text-[13px] text-muted-foreground">
          {value}
          <ChevronRight size={13} className="opacity-70" />
        </span>
      )}
      {children}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/50"
      >
        {content}
      </button>
    );
  }
  return <div className="flex w-full items-center px-2 py-2">{content}</div>;
}

function SubOption({ label, hint, active, onClick }: { label: string; hint?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-muted",
        active && "text-primary",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-primary" : "bg-transparent")} />
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </button>
  );
}

function ClockIcon() {
  return <Clock size={13} className="shrink-0 text-muted-foreground" aria-hidden />;
}

function monthLabel(year: number, month: number): string {
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month]} ${year}`;
}

function monthOf(iso: string): Date {
  const date = fromISO(iso);
  if (!date) return new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Arrow-key grid navigation across the 7-column calendar. */
function onGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
  const target = event.target as HTMLElement;
  if (!target.matches("button[role='gridcell']")) return;
  const deltas: Record<string, number> = {
    ArrowRight: 1,
    ArrowLeft: -1,
    ArrowDown: 7,
    ArrowUp: -7,
  };
  const delta = deltas[event.key];
  if (delta === undefined) return;
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button[role='gridcell']"));
  const index = buttons.indexOf(target as HTMLButtonElement);
  if (index < 0) return;
  event.preventDefault();
  const nextIndex = Math.max(0, Math.min(buttons.length - 1, index + delta));
  buttons[nextIndex]?.focus();
}
