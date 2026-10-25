/**
 * Date utilities for the mention/date system — parsing, formatting,
 * relative labels and reminder options. All times are treated as local.
 */

export interface MentionDateAttrs {
  /** ISO date `YYYY-MM-DD` (start of range). */
  date: string;
  /** ISO date for the range end (null = single date). */
  endDate: string | null;
  includeTime: boolean;
  /** `HH:mm` 24h, "" = not set yet. */
  startTime: string;
  endTime: string;
  /** Chip label style. */
  format: "relative" | "absolute";
  /** Reminder option id (null = none). */
  reminder: string | null;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function monthShort(month: number): string {
  return MONTHS_SHORT[month] ?? "";
}

function dayDiff(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** `4:20 PM` from `16:20`. Empty input → "". */
export function formatTime(hhmm: string): string {
  if (!hhmm) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return "";
  let hours = Number(m[1]);
  const minutes = m[2];
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

/** "Oct 25, 2026" */
export function formatLongDate(iso: string): string {
  const date = fromISO(iso);
  if (!date) return "";
  return `${monthShort(date.getMonth())} ${date.getDate()}, ${date.getFullYear()}`;
}

/** "October 25, 2026" (absolute chip label / tooltip) */
export function formatFullDate(iso: string): string {
  const date = fromISO(iso);
  if (!date) return "";
  return `${MONTHS_LONG[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** "Oct 25" or "Oct 25, 2025" when not the current year. */
export function formatMediumDate(iso: string): string {
  const date = fromISO(iso);
  if (!date) return "";
  const year = date.getFullYear();
  const base = `${monthShort(date.getMonth())} ${date.getDate()}`;
  return year === new Date().getFullYear() ? base : `${base}, ${year}`;
}

/** Relative single-date label: Today / Tomorrow / weekday / Oct 25. */
export function relativeDayLabel(iso: string): string | null {
  const date = fromISO(iso);
  if (!date) return null;
  const diff = dayDiff(new Date(), date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return WEEKDAYS[date.getDay()];
  if (diff < -1 && diff > -7) return `Last ${WEEKDAYS[date.getDay()]}`;
  return null;
}

/** The chip label for a date mention. */
export function dateChipLabel(attrs: MentionDateAttrs): string {
  if (!attrs?.date) return "Empty";
  const start = attrs.date;
  const end = attrs.endDate;

  if (attrs.format === "absolute") {
    let label = formatFullDate(start);
    if (end) label += ` – ${formatFullDate(end)}`;
    if (attrs.includeTime && attrs.startTime) {
      const t = formatTime(attrs.startTime);
      label += end ? `, ${t}` : ` at ${t}`;
    }
    return label;
  }

  const rel = relativeDayLabel(start);
  const startLabel = rel ?? formatMediumDate(start);
  if (end) {
    const endRel = relativeDayLabel(end);
    const endLabel = endRel ?? formatMediumDate(end);
    if (attrs.includeTime && attrs.startTime) {
      return `${startLabel} at ${formatTime(attrs.startTime)} – ${endLabel}${attrs.endTime ? ` at ${formatTime(attrs.endTime)}` : ""}`;
    }
    return `${startLabel} – ${endLabel}`;
  }
  if (attrs.includeTime && attrs.startTime) {
    return `${startLabel} at ${formatTime(attrs.startTime)}`;
  }
  return startLabel;
}

/** The *opposite* format — used as the chip tooltip. */
export function dateChipTooltip(attrs: MentionDateAttrs): string {
  const flipped: MentionDateAttrs = { ...attrs, format: attrs.format === "relative" ? "absolute" : "relative" };
  return dateChipLabel(flipped);
}

/** Parse loose input like "oct 25 2026", "10/25/2026", "2026-10-25", "today". */
export function parseDateInput(raw: string): string | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;

  if (text === "today" || text === "now") return todayISO();
  if (text === "tomorrow") {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toISO(d);
  }
  if (text === "yesterday") {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toISO(d);
  }

  // ISO
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text)) {
    const [y, m, d] = text.split("-").map(Number);
    return validISO(y, m, d);
  }
  // D/M/Y or D.M.Y or M/D/Y (assume month/day/year, fallback day/month)
  const slash = /^(\d{1,2})[/..](\d{1,2})[/..](\d{2,4})$/.exec(text);
  if (slash) {
    let a = Number(slash[1]);
    let b = Number(slash[2]);
    const year = Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]);
    if (a > 12 && b <= 12) [a, b] = [b, a];
    return validISO(year, a, b);
  }
  // "oct 25 2026" / "25 oct 2026" / "oct 25"
  const words = /^([a-z]{3,})\.?\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?$/.exec(text)
    || /^(\d{1,2})\s+([a-z]{3,})\.?(?:\s*,?\s*(\d{4}))?$/.exec(text);
  if (words) {
    const monthName = MONTHS_LONG.findIndex((m) => m.toLowerCase().startsWith(words[1].slice(0, 3)));
    if (monthName >= 0) {
      const day = Number(words[2] !== undefined && /^\d/.test(words[1]) ? words[1] : words[2]);
      const year = words[3] ? Number(words[3]) : new Date().getFullYear();
      return validISO(year, monthName + 1, day);
    }
  }
  return null;
}

function validISO(year: number, month: number, day: number): string | null {
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime()) || date.getMonth() !== month - 1) return null;
  return toISO(date);
}

export interface ReminderOption {
  id: string;
  label: string;
}

export const REMINDER_OPTIONS: ReminderOption[] = [
  { id: "none", label: "None" },
  { id: "at_time", label: "At time of event" },
  { id: "5m", label: "5 minutes before" },
  { id: "10m", label: "10 minutes before" },
  { id: "15m", label: "15 minutes before" },
  { id: "30m", label: "30 minutes before" },
  { id: "1h", label: "1 hour before" },
  { id: "2h", label: "2 hours before" },
  { id: "1d", label: "1 day before" },
  { id: "2d", label: "2 days before" },
];

export function reminderLabel(id: string | null): string {
  if (!id || id === "none") return "None";
  return REMINDER_OPTIONS.find((option) => option.id === id)?.label ?? "None";
}

/** True when the reminder is active (drives the alarm-clock icon). */
export function hasReminder(attrs: MentionDateAttrs): boolean {
  return Boolean(attrs?.reminder && attrs.reminder !== "none");
}

/** Default attrs for a fresh date mention. */
export function defaultDateAttrs(date?: string): MentionDateAttrs {
  return {
    date: date ?? todayISO(),
    endDate: null,
    includeTime: false,
    startTime: "",
    endTime: "",
    format: "relative",
    reminder: null,
  };
}
