import {
  Bell,
  CalendarDays,
  CalendarPlus,
  FileText,
  Link2,
  UserRoundPlus,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { AtActionContext } from "../extensions/at-command";
import { formatDateLabel } from "../extensions/mention";
import { fuzzyMatch } from "@/lib/editor/utils";

/**
 * "@" menu registry — dates, people and future-ready entry points.
 * Adding a new "@" action = adding one entry here.
 */

export interface AtItem {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  category: AtCategory;
  icon: LucideIcon;
  action: (ctx: AtActionContext) => void;
}

export type AtCategory = "Dates" | "People" | "More";

export const AT_CATEGORIES: AtCategory[] = ["Dates", "People", "More"];

const PEOPLE_KEY = "aurora-mention-people";

export function getRecentPeople(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PEOPLE_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(list) ? list.slice(0, 5) : [];
  } catch {
    return [];
  }
}

export function recordPerson(name: string) {
  if (typeof window === "undefined" || !name.trim()) return;
  try {
    const list = getRecentPeople();
    const next = [name.trim(), ...list.filter((p) => p !== name.trim())].slice(0, 8);
    window.localStorage.setItem(PEOPLE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — ignore */
  }
}

/** ISO date string offset from today by `days`. */
function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function insertDateMention({ editor, range }: AtActionContext, iso: string) {
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertMention({ kind: "date", label: formatDateLabel(iso), date: iso })
    .run();
}

/** The full item list — People entries are generated from local history. */
export function getAtItems(): AtItem[] {
  const people: AtItem[] = getRecentPeople().map((name) => ({
    id: `person:${name}`,
    title: name,
    description: "Mention this person",
    keywords: ["person", "people", "mention", "member", name.toLowerCase()],
    category: "People" as AtCategory,
    icon: UserRound,
    action: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertMention({ kind: "person", label: name })
        .run();
    },
  }));

  return [
    {
      id: "dateToday",
      title: "Today",
      description: `Insert a date — ${formatDateLabel(isoOffset(0))}`,
      keywords: ["date", "today", "now", "day"],
      category: "Dates",
      icon: CalendarDays,
      action: (ctx) => insertDateMention(ctx, isoOffset(0)),
    },
    {
      id: "dateTomorrow",
      title: "Tomorrow",
      description: `Insert a date — ${formatDateLabel(isoOffset(1))}`,
      keywords: ["date", "tomorrow", "next day"],
      category: "Dates",
      icon: CalendarDays,
      action: (ctx) => insertDateMention(ctx, isoOffset(1)),
    },
    {
      id: "dateYesterday",
      title: "Yesterday",
      description: `Insert a date — ${formatDateLabel(isoOffset(-1))}`,
      keywords: ["date", "yesterday", "last day"],
      category: "Dates",
      icon: CalendarDays,
      action: (ctx) => insertDateMention(ctx, isoOffset(-1)),
    },
    {
      id: "datePick",
      title: "Pick a date…",
      description: "Choose any date from a calendar.",
      keywords: ["date", "calendar", "custom", "schedule", "pick"],
      category: "Dates",
      icon: CalendarPlus,
      action: ({ editor, range, helpers }) => {
        helpers.requestDatePick((iso) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertMention({ kind: "date", label: formatDateLabel(iso), date: iso })
            .run();
        });
      },
    },
    ...people,
    {
      id: "personAdd",
      title: "Mention a person…",
      description: "Add someone by name. They'll appear here next time.",
      keywords: ["person", "people", "mention", "member", "invite", "user", "add"],
      category: "People",
      icon: UserRoundPlus,
      action: ({ editor, range, helpers }) => {
        helpers.requestPersonInput((name) => {
          const trimmed = name.trim();
          if (!trimmed) return;
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertMention({ kind: "person", label: trimmed })
            .run();
          recordPerson(trimmed);
        });
      },
    },
    {
      id: "page",
      title: "Link to page",
      description: "Link another page — coming soon.",
      keywords: ["page", "document", "wiki", "link", "internal"],
      category: "More",
      icon: FileText,
      action: () => {
        // Future-ready: page index arrives with the multi-doc workspace.
        window.dispatchEvent(new CustomEvent("aurora:future-feature", { detail: "Link to page" }));
      },
    },
    {
      id: "link",
      title: "Web link",
      description: "Attach a bookmark — coming soon.",
      keywords: ["link", "url", "bookmark", "web", "href"],
      category: "More",
      icon: Link2,
      action: () => {
        window.dispatchEvent(new CustomEvent("aurora:future-feature", { detail: "Web link bookmarks" }));
      },
    },
    {
      id: "reminder",
      title: "Reminder",
      description: "Get notified about this — coming soon.",
      keywords: ["reminder", "notify", "alert", "todo"],
      category: "More",
      icon: Bell,
      action: () => {
        window.dispatchEvent(new CustomEvent("aurora:future-feature", { detail: "Reminders" }));
      },
    },
  ];
}

/** Filter + group @ items for the menu. */
export function filterAtItems(query: string): { category: string; items: AtItem[] }[] {
  const q = query.trim();
  const items = getAtItems();

  if (!q) {
    return AT_CATEGORIES.map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    }));
  }

  const matched = items.filter(
    (item) =>
      fuzzyMatch(q, item.title) ||
      fuzzyMatch(q, item.description) ||
      item.keywords.some((k) => fuzzyMatch(q, k) || k.startsWith(q.toLowerCase())),
  );

  return AT_CATEGORIES.map((category) => ({
    category,
    items: matched.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);
}

export function flattenAtItems(groups: { items: AtItem[] }[]): AtItem[] {
  return groups.flatMap((g) => g.items);
}
