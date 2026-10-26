import type { MentionReminder } from "@/components/editor/extensions/mention";

/**
 * Date mention formatting — every display rule of the @-date feature:
 * full / ISO / weekday / short / relative labels, 12h & 24h times,
 * reminder labels, and the tooltip "other representation" logic.
 *
 * All storage stays canonical: `date` is `YYYY-MM-DD`, `time` is `HH:mm`
 * (24-hour). Display is derived, so toggling formats never loses data.
 */

export type DateFormat = "auto" | "full" | "iso" | "weekday" | "short" | "relative";

export interface DateMentionAttrs {
  date: string | null;
  endDate: string | null;
  time: string | null;
  format: DateFormat;
  reminder: MentionReminder | null;
}

/* ------------------------------------------------------------- primitives */

export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toISODate(d: Date): string {
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mo}-${day}`;
}

export function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Whole-day difference `d - today` (negative = past). */
export function dayDiffFromToday(iso: string): number | null {
  const d = parseISODate(iso);
  if (!d) return null;
  const day = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / day);
}

/* --------------------------------------------------------------- formats */

export function formatFull(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatWeekday(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

export function formatISO(d: Date): string {
  return toISODate(d);
}

/**
 * Range label — "Oct 25 – 27, 2026" (same month), "Oct 25 – Nov 2, 2026"
 * (same year), "Dec 30, 2025 – Jan 2, 2026" (crossing years).
 */
export function formatRange(startISO: string, endISO: string): string {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if (!start || !end) return endISO ? `${startISO} – ${endISO}` : formatFull(start ?? new Date());
  if (startISO > endISO) return formatFull(start);
  if (start.getFullYear() !== end.getFullYear()) {
    return `${formatFull(start)} – ${formatFull(end)}`;
  }
  if (start.getMonth() === end.getMonth()) {
    const month = start.toLocaleDateString("en-US", { month: "short" });
    return `${month} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  const startShort = formatShort(start);
  return `${startShort} – ${formatFull(end)}`;
}

/**
 * Relative label — Today / Tomorrow / Yesterday / Next <weekday> /
 * N days ago / in N days / N weeks later / N weeks ago. Returns `null`
 * when the date is too far away to read naturally.
 */
export function relativeLabel(iso: string): string | null {
  const diff = dayDiffFromToday(iso);
  if (diff === null) return null;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const d = parseISODate(iso);
  if (!d) return null;
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  if (diff >= 2 && diff <= 6) return `Next ${weekday}`;
  if (diff <= -2 && diff >= -6) return `Last ${weekday}`;
  if (Math.abs(diff) < 14) return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
  const weeks = Math.round(Math.abs(diff) / 7);
  if (weeks * 7 === Math.abs(diff) && weeks <= 8) {
    return diff > 0 ? `${weeks} weeks later` : `${weeks} weeks ago`;
  }
  return diff > 0 ? `in ${Math.abs(diff)} days` : `${-diff} days ago`;
}

/* ------------------------------------------------------------------ time */

const TIME_PREF_KEY = "aurora-clock";

export function prefers12Hour(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(TIME_PREF_KEY) !== "24";
}

export function setClockPreference(use12h: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TIME_PREF_KEY, use12h ? "12" : "24");
}

/** "15:45" → "3:45 PM" (12h) or "15:45" (24h). */
export function formatTime(hhmm: string, use12h = prefers12Hour()): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const min = m[2];
  if (!use12h) return `${String(h).padStart(2, "0")}:${min}`;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${suffix}`;
}

export function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* -------------------------------------------------------------- reminders */

export interface ReminderOption {
  value: MentionReminder;
  label: string;
}

export const REMINDER_OPTIONS: ReminderOption[] = [
  { value: "none", label: "No reminder" },
  { value: "at_time", label: "At time of event" },
  { value: "m5", label: "5 minutes before" },
  { value: "m10", label: "10 minutes before" },
  { value: "m15", label: "15 minutes before" },
  { value: "m30", label: "30 minutes before" },
  { value: "h1", label: "1 hour before" },
  { value: "h2", label: "2 hours before" },
  { value: "d1", label: "1 day before" },
  { value: "d2", label: "2 days before" },
  { value: "w1", label: "1 week before" },
];

export function reminderLabel(value: MentionReminder | null | undefined): string | null {
  if (!value || value === "none") return null;
  return REMINDER_OPTIONS.find((o) => o.value === value)?.label ?? null;
}

/* ------------------------------------------------------ mention rendering */

const DAY_SEPARATOR = " • ";

/** The pill label for a date mention, honoring its format + relative flag. */
export function formatDateMentionLabel(attrs: {
  date: string | null;
  endDate?: string | null;
  time?: string | null;
  format?: DateFormat;
}): string {
  const iso = attrs.date;
  if (!iso) return "Pick a date";
  const d = parseISODate(iso);
  if (!d) return iso;

  const timeSuffix = attrs.time ? `${DAY_SEPARATOR}${formatTime(attrs.time)}` : "";
  const withTime = (base: string) => `${base}${timeSuffix}`;

  // Ranges always render as an absolute range (relative reads are for single days).
  if (attrs.endDate) return withTime(formatRange(iso, attrs.endDate));

  if (attrs.format === "relative") return withTime(relativeLabel(iso) ?? formatFull(d));
  if (attrs.format === "iso") return withTime(attrs.time ? `${iso} ${attrs.time}` : iso);
  if (attrs.format === "weekday") return withTime(formatWeekday(d));
  if (attrs.format === "short") return withTime(formatShort(d));
  return withTime(formatFull(d));
}

/**
 * Tooltip content — the *other* representation:
 * relative display → full date; absolute display → relative label
 * (falling back to the full date when no natural relative exists).
 * The reminder rides along as the second line.
 */
export function dateTooltipLines(attrs: {
  date: string | null;
  endDate?: string | null;
  time?: string | null;
  format?: DateFormat;
  reminder?: MentionReminder | null;
}): { title: string; subtitle?: string } {
  const iso = attrs.date;
  if (!iso) return { title: "Pick a date" };
  const d = parseISODate(iso);
  if (!d) return { title: iso };

  const timeSuffix = attrs.time ? ` • ${formatTime(attrs.time)}` : "";
  if (attrs.endDate) {
    return { title: `${formatRange(iso, attrs.endDate)}${timeSuffix}` };
  }

  const rel = relativeLabel(iso);
  const full = attrs.time ? `${formatFull(d)} • ${formatTime(attrs.time)}` : formatFull(d);
  const title = attrs.format === "relative" ? full : rel ?? full;
  const reminder = reminderLabel(attrs.reminder);
  return { title, subtitle: reminder ? `⏰ ${reminder}` : undefined };
}

/** ISO + time combined, for "Copy ISO date". */
export function fullISO(iso: string, time: string | null | undefined): string {
  return time ? `${iso}T${time}:00` : iso;
}
