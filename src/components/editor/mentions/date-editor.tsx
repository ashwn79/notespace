"use client";

import * as React from "react";
import { CalendarDays, ChevronRight, Clock3, Trash2 } from "lucide-react";
import { Calendar, type CalendarHandle } from "./calendar";
import { TimePicker } from "./time-picker";
import { Switch } from "@/components/ui/switch";
import {
  REMINDER_OPTIONS,
  formatDateMentionLabel,
  type DateFormat,
} from "@/lib/editor/mentions/date-utils";
import type { MentionReminder } from "../extensions/mention";
import { cn } from "@/lib/utils";

/**
 * The date editor — Notion-style panel (matches the reference design):
 *
 *   ┌──────────────────────────────┐
 *   │ [ Oct 25, 2026 ] [ Oct 27 ]  │  ← date inputs (active one rings blue)
 *   │  October 2026   Today  < >   │
 *   │  Su Mo Tu We Th Fr Sa        │
 *   │  … day grid w/ range tint …  │
 *   │  End date              ⬤—   │
 *   │  Date format       Relative ›│
 *   │  Include time          ⬤—   │
 *   │  Remind                None ›│
 *   │  ──────────────────────────  │
 *   │  Clear                       │
 *   └──────────────────────────────┘
 *
 * One panel, two hosts: the @ menu's "Pick date…" sub-panel (keyboard routed)
 * and the popover that opens when clicking an inserted date pill. Every change
 * applies live — the stored ISO date only changes when the user picks a day;
 * format / reminder switches are pure display metadata.
 */

export interface DateDraft {
  date: string | null;
  endDate: string | null;
  time: string | null;
  format: DateFormat;
  reminder: MentionReminder | null;
}

/** Keys the host should forward to `keyRouter.handleKey`. */
export interface PanelKeyRouter {
  handleKey: (e: KeyboardEvent | React.KeyboardEvent) => boolean;
}

const FORMAT_OPTIONS: { value: Exclude<DateFormat, "auto">; label: string; sample: string }[] = [
  { value: "relative", label: "Relative", sample: "Today" },
  { value: "full", label: "Full", sample: "Oct 25, 2026" },
  { value: "short", label: "Short", sample: "Oct 25" },
  { value: "weekday", label: "Weekday", sample: "Friday" },
  { value: "iso", label: "ISO", sample: "2026-10-25" },
];

const REMINDER_SHORT: Partial<Record<MentionReminder, string>> = {
  at_time: "At time",
  m5: "5 min before",
  m10: "10 min before",
  m15: "15 min before",
  m30: "30 min before",
  h1: "1 hour before",
  h2: "2 hours before",
  d1: "1 day before",
  d2: "2 days before",
  w1: "1 week before",
};

interface DateEditorPanelProps {
  initial: DateDraft;
  /** insert = choosing from the menu; edit = reworking an existing pill. */
  mode?: "insert" | "edit";
  onApply: (draft: DateDraft) => void;
  onClose?: () => void;
  onDelete?: () => void;
  /** Menu mode: expose a key router so arrow keys reach the calendar. */
  onRouter?: (router: PanelKeyRouter | null) => void;
  className?: string;
}

export function DateEditorPanel({
  initial,
  mode = "insert",
  onApply,
  onClose,
  onDelete,
  onRouter,
  className,
}: DateEditorPanelProps) {
  const [date, setDate] = React.useState<string | null>(initial.date);
  const [endDate, setEndDate] = React.useState<string | null>(initial.endDate);
  const [time, setTime] = React.useState<string | null>(initial.time);
  const [format, setFormat] = React.useState<DateFormat>(initial.format);
  const [reminder, setReminder] = React.useState<MentionReminder | null>(initial.reminder);
  const [flyout, setFlyout] = React.useState<"format" | "reminder" | null>(null);
  /** End-date mode armed (toggle on) — a range is being picked. */
  const [rangeArmed, setRangeArmed] = React.useState(initial.endDate !== null);
  /** Range phase: false = choosing the start day, true = choosing the end day. */
  const [pickingEnd, setPickingEnd] = React.useState(false);

  const calendarHandle = React.useRef<CalendarHandle | null>(null);
  const pickedOnce = React.useRef(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const endDateOn = endDate !== null || rangeArmed;

  const commit = React.useCallback(
    (patch: Partial<DateDraft>) => {
      onApply({
        date: patch.date !== undefined ? patch.date : date,
        endDate: patch.endDate !== undefined ? patch.endDate : endDate,
        time: patch.time !== undefined ? patch.time : time,
        format: patch.format !== undefined ? patch.format : format,
        reminder: patch.reminder !== undefined ? patch.reminder : reminder,
      });
    },
    [onApply, date, endDate, time, format, reminder],
  );

  /* ------------------------------------------------ day picking */
  const pickDay = (iso: string) => {
    pickedOnce.current = true;
    if (endDateOn) {
      if (!pickingEnd) {
        // Choosing the start day (restarts any existing range).
        setDate(iso);
        setEndDate(null);
        setPickingEnd(true);
        commit({ date: iso, endDate: null });
        return;
      }
      // Choosing the end day; clicking earlier than the start restarts it.
      if (date && iso < date) {
        setDate(iso);
        setEndDate(null);
        commit({ date: iso, endDate: null });
        return;
      }
      setEndDate(iso);
      setPickingEnd(false);
      commit({ endDate: iso });
      return;
    }
    setDate(iso);
    commit({ date: iso });
  };

  const setEndDateOn = (on: boolean) => {
    setRangeArmed(on);
    setEndDate(null);
    setPickingEnd(false);
    commit({ endDate: null });
  };

  /* --------------------------------------------- keyboard routing (menu) */
  React.useEffect(() => {
    if (!onRouter) return;
    const router: PanelKeyRouter = {
      handleKey: (e) => {
        const key = e.key;
        if (key === "Escape") {
          e.preventDefault();
          onClose?.();
          return true;
        }
        if (key === "ArrowLeft") {
          e.preventDefault();
          pickedOnce.current = false;
          calendarHandle.current?.moveCursor(-1);
          return true;
        }
        if (key === "ArrowRight") {
          e.preventDefault();
          pickedOnce.current = false;
          calendarHandle.current?.moveCursor(1);
          return true;
        }
        if (key === "ArrowUp") {
          e.preventDefault();
          pickedOnce.current = false;
          calendarHandle.current?.moveCursor(-7);
          return true;
        }
        if (key === "ArrowDown") {
          e.preventDefault();
          pickedOnce.current = false;
          calendarHandle.current?.moveCursor(7);
          return true;
        }
        if (key === "PageUp") {
          e.preventDefault();
          calendarHandle.current?.moveCursor(-30);
          return true;
        }
        if (key === "PageDown") {
          e.preventDefault();
          calendarHandle.current?.moveCursor(30);
          return true;
        }
        if (key === "Enter") {
          if (!date || !pickedOnce.current) {
            calendarHandle.current?.pickCursor();
            pickedOnce.current = true;
            return true;
          }
          e.preventDefault();
          return true;
        }
        if (key === "Tab") {
          e.preventDefault();
          return true;
        }
        return false;
      },
    };
    onRouter(router);
    return () => onRouter(null);
  }, [onRouter, onClose, date]);

  /* ------------------------------------------------------ popover keys */
  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const inField = target.tagName === "INPUT" || target.tagName === "SELECT";
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (flyout) setFlyout(null);
      else onClose?.();
      return;
    }
    if (inField) return;
    if (e.key === "Enter" && target.tagName !== "BUTTON") {
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      calendarHandle.current?.moveCursor(e.key === "ArrowLeft" ? -1 : 1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      calendarHandle.current?.moveCursor(e.key === "ArrowUp" ? -7 : 7);
    }
  };

  /* Close flyouts on outside click within the popover host */
  React.useEffect(() => {
    if (!flyout) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setFlyout(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [flyout]);

  const formatLabel =
    FORMAT_OPTIONS.find((o) => o.value === format)?.label ?? "Full";
  const reminderValue =
    reminder && reminder !== "none" ? REMINDER_SHORT[reminder] ?? reminder : "None";

  return (
    <div
      ref={rootRef}
      className={cn("relative w-[300px] p-2.5", className)}
      role="dialog"
      aria-label={mode === "edit" ? "Edit date" : "Insert date"}
      onKeyDown={onPanelKeyDown}
    >
      {/* Date inputs */}
      <div className="mb-2.5 flex items-center gap-2">
        <DateInput
          value={date ? formatDateMentionLabel({ date, time, format: format === "relative" ? "full" : format }) : null}
          active={endDateOn ? !pickingEnd : true}
          placeholder="Pick a date"
        />
        {endDateOn ? (
          <DateInput
            value={endDate ? formatDateMentionLabel({ date: endDate, time: null, format: format === "relative" ? "full" : format }) : null}
            active={pickingEnd}
            placeholder="End date"
          />
        ) : null}
      </div>

      {/* Calendar */}
      <Calendar
        selected={date}
        rangeEnd={endDateOn ? endDate : null}
        onSelect={pickDay}
        handleRef={(h) => (calendarHandle.current = h)}
      />

      {/* Options */}
      <div className="mt-2 border-t border-border/50 pt-1">
        <Row label="End date">
          <Switch
            checked={endDateOn}
            onCheckedChange={setEndDateOn}
            aria-label="End date"
            className="scale-[0.82]"
          />
        </Row>

        <Row label="Date format">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setFlyout(flyout === "format" ? null : "format")}
            className="dt-value-btn"
            aria-haspopup="menu"
            aria-expanded={flyout === "format"}
          >
            {format === "relative" ? "Relative" : formatLabel}
            <ChevronRight size={13} className="text-muted-foreground/70" />
          </button>
        </Row>
        {time !== null ? (
          <div className="pl-3 pr-1 pb-1.5">
            <TimePicker value={time} onChange={(next) => { setTime(next); commit({ time: next }); }} />
          </div>
        ) : null}

        <Row label="Include time">
          <Switch
            checked={time !== null}
            onCheckedChange={(on) => {
              const next = on ? time ?? autoTime() : null;
              setTime(next);
              commit({ time: next });
            }}
            aria-label="Include time"
            className="scale-[0.82]"
          />
        </Row>

        <Row label="Remind">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setFlyout(flyout === "reminder" ? null : "reminder")}
            className="dt-value-btn"
            aria-haspopup="menu"
            aria-expanded={flyout === "reminder"}
          >
            {reminderValue}
            <ChevronRight size={13} className="text-muted-foreground/70" />
          </button>
        </Row>
      </div>

      {/* Clear */}
      <div className="mt-1.5 flex items-center border-t border-border/50 pt-1.5">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setDate(null);
            setEndDate(null);
            if (mode === "edit") {
              commit({ date: null, endDate: null });
            }
          }}
          disabled={!date}
          className="rounded-md px-2 py-1 text-[13px] text-foreground/85 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          Clear
        </button>
        {mode === "edit" && onDelete ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={onDelete}
            className="editor-icon-btn ml-auto h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Delete date"
            aria-label="Delete date"
          >
            <Trash2 size={13.5} />
          </button>
        ) : null}
      </div>

      {/* Format flyout */}
      {flyout === "format" ? (
        <Flyout title="Date format" onClose={() => setFlyout(null)}>
          {FORMAT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              tabIndex={-1}
              onClick={() => {
                setFormat(option.value);
                commit({ format: option.value });
                setFlyout(null);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-muted",
                format === option.value && "text-primary",
              )}
            >
              <span>{option.label}</span>
              <span className="text-[11px] text-muted-foreground">{option.sample}</span>
            </button>
          ))}
        </Flyout>
      ) : null}

      {/* Reminder flyout */}
      {flyout === "reminder" ? (
        <Flyout title="Remind" onClose={() => setFlyout(null)}>
          {REMINDER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              tabIndex={-1}
              onClick={() => {
                const next = (option.value === "none" ? null : option.value) as MentionReminder | null;
                setReminder(next);
                commit({ reminder: next });
                setFlyout(null);
              }}
              className={cn(
                "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-muted",
                (reminder ?? "none") === option.value && "text-primary",
              )}
            >
              {option.label}
            </button>
          ))}
        </Flyout>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function DateInput({
  value,
  active,
  placeholder,
}: {
  value: string | null;
  active: boolean;
  placeholder: string;
}) {
  return (
    <div
      className={cn(
        "dt-input flex h-8 min-w-0 flex-1 items-center overflow-hidden rounded-md px-2.5 text-[13px]",
        active && "is-active",
      )}
      aria-live="polite"
    >
      {value ? (
        <span className="truncate">{value}</span>
      ) : (
        <span className="truncate text-muted-foreground/60">{placeholder}</span>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-[34px] items-center justify-between gap-2 rounded-md px-2 text-[13px]">
      <span className="text-foreground/90">{label}</span>
      {children}
    </div>
  );
}

function Flyout({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="menu"
      aria-label={title}
      className="absolute inset-x-2.5 top-[104px] z-10 max-h-[330px] overflow-y-auto rounded-lg border border-border/80 bg-popover/98 p-1.5 shadow-2xl shadow-black/45 backdrop-blur-xl animate-pop-in"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="px-2 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
        {title}
      </div>
      {children}
    </div>
  );
}

function autoTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Shared draft for menu-driven insert flows. */
export const EMPTY_DATE_DRAFT: DateDraft = {
  date: null,
  endDate: null,
  time: null,
  format: "auto",
  reminder: null,
};
