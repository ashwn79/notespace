"use client";

import * as React from "react";
import {
  CalendarDays,
  CalendarPlus,
  CalendarClock,
  Clock3,
  FilePlus2,
  FileText,
  Bell,
  Link2,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";
import {
  registerMentionProvider,
  scoreCandidate,
  type MentionCategoryId,
  type MentionInsertContext,
  type MentionMenuItem,
} from "@/lib/editor/mentions/framework";
import {
  addPage,
  getPeople,
  getPages,
  recordPageOpen,
  recordPersonUsage,
  relativeTime,
} from "@/lib/editor/mentions/workspace";
import { formatFull, relativeLabel } from "@/lib/editor/mentions/date-utils";
import { fuzzyMatch } from "@/lib/editor/utils";

/**
 * The @ mention providers. Each one is a self-contained registration —
 * adding a new entity type means writing one provider, nothing else.
 */

/* --------------------------------------------------------------- helpers */

function replaceRange(ctx: MentionInsertContext) {
  return ctx.editor.chain().focus().deleteRange(ctx.range);
}

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function futureFeature(label: string) {
  window.dispatchEvent(new CustomEvent("aurora:future-feature", { detail: label }));
}

/* ----------------------------------------------------------- avatars etc */

export function PersonAvatar({
  name,
  hue,
  size = 28,
}: {
  name: string;
  hue: number;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden
      className="mention-avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `oklch(0.55 ${Math.min(0.16, 0.05 + (hue % 40) / 400)} ${hue})`,
      }}
    >
      {initials || "?"}
    </span>
  );
}

export function PageGlyph({ icon, size = 28 }: { icon: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/60"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      {icon}
    </span>
  );
}

/* -------------------------------------------------------------- 1. DATES */

function dateItems(): MentionMenuItem[] {
  const mk = (
    id: string,
    title: string,
    subtitle: string,
    icon: LucideIcon,
    run: (ctx: MentionInsertContext) => void,
    panel?: MentionMenuItem["panel"],
  ): MentionMenuItem => ({
    id,
    title,
    subtitle,
    categoryId: "dates" as MentionCategoryId,
    keywords: ["date", "day", "calendar", title.toLowerCase()],
    icon,
    run,
    panel,
  });

  const insertOffset = (days: number) => (ctx: MentionInsertContext) => {
    replaceRange(ctx).insertDateMention({ date: isoOffset(days) }).run();
  };

  return [
    mk("date-today", "Today", `Insert today — ${formatFull(new Date())}`, CalendarDays, insertOffset(0)),
    mk("date-tomorrow", "Tomorrow", `Insert ${relativeLabel(isoOffset(1))} — ${formatFull(new Date(Date.now() + 864e5))}`, CalendarDays, insertOffset(1)),
    mk("date-yesterday", "Yesterday", `Insert ${relativeLabel(isoOffset(-1))} — ${formatFull(new Date(Date.now() - 864e5))}`, CalendarDays, insertOffset(-1)),
    mk("date-pick", "Pick a date…", "Open the calendar and choose any date", CalendarPlus, () => {}, "date"),
    mk("date-pick-time", "Pick date & time…", "Calendar with a time picker", CalendarClock, () => {}, "datetime"),
    mk("date-relative", "Relative date…", "Show as Today, Tomorrow, in 3 days…", Clock3, () => {}, "relative"),
  ];
}

registerMentionProvider({
  id: "dates",
  label: "Dates",
  order: 0,
  search: ({ query }) => {
    const items = dateItems();
    if (!query.trim()) return items;
    return items
      .map((item) => ({ item, score: scoreCandidate(query, { title: item.title, keywords: item.keywords }) }))
      .filter((r): r is { item: MentionMenuItem; score: number } => r.score !== null)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
      .map((r) => ({ ...r.item, score: r.score }));
  },
});

/* ------------------------------------------------------------- 2. PEOPLE */

registerMentionProvider({
  id: "people",
  label: "People",
  order: 1,
  emptyState: {
    message: "No people found",
    actionLabel: "Invite person",
    panel: "invite",
  },
  search: ({ query }) => {
    const q = query.trim();
    const people = getPeople();

    const scored = people
      .map((person) => {
        const score = scoreCandidate(q, {
          title: person.name,
          aliases: [person.role ?? "", person.email ?? ""].filter(Boolean),
          keywords: ["person", "people", "mention", "member", "user"],
          lastUsedAt: person.lastUsedAt,
          usageCount: person.usageCount,
        });
        return { person, score };
      })
      .filter((r): r is { person: (typeof people)[number]; score: number } => r.score !== null)
      .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name));

    const items: MentionMenuItem[] = scored.map(({ person, score }) => ({
      id: `person:${person.id}`,
      title: person.name,
      subtitle: [person.role, person.email].filter(Boolean).join(" · ") || "People",
      categoryId: "people",
      keywords: ["person", "people", person.name.toLowerCase()],
      score,
      renderLeading: () => (
        <React.Fragment>
          <span className="relative inline-flex shrink-0">
            <PersonAvatar name={person.name} hue={person.hue} />
            {person.status && person.status !== "offline" ? (
              <span
                aria-hidden
                className={`mention-status-dot absolute -bottom-0.5 -right-0.5 ${
                  person.status === "online" ? "is-online" : "is-away"
                }`}
              />
            ) : null}
          </span>
        </React.Fragment>
      ),
      run: (ctx) => {
        replaceRange(ctx).insertPersonMention({ personId: person.id, label: person.name }).run();
        recordPersonUsage(person.id);
      },
      open: (ctx) => {
        window.dispatchEvent(new CustomEvent("aurora:show-person", { detail: person.id }));
      },
    }));

    // "Invite person…" rides along whenever a query matched nobody.
    if (q && !fuzzyMatch(q, "invite person") && items.length === 0) return items;
    if (q && items.length > 0) return items;
    return [
      ...items,
      {
        id: "person-invite",
        title: "Invite person",
        subtitle: "Add someone new to the directory",
        categoryId: "people",
        keywords: ["invite", "add", "person", "new", "member"],
        icon: UserRoundPlus,
        panel: "invite",
        run: () => {},
      },
    ];
  },
});

/* -------------------------------------------------------------- 3. PAGES */

registerMentionProvider({
  id: "pages",
  label: "Pages",
  order: 2,
  search: ({ editor, query }) => {
    const q = query.trim();
    const pages = getPages();

    const scored = pages
      .map((page) => {
        const score = scoreCandidate(q, {
          title: page.title,
          aliases: [...page.aliases, ...page.path],
          keywords: ["page", "document", "wiki", "link", "internal"],
          lastUsedAt: page.openedAt ?? page.editedAt,
          favorite: page.favorite,
          pinned: page.pinned,
          usageCount: page.usageCount,
        });
        return { page, score };
      })
      .filter((r): r is { page: (typeof pages)[number]; score: number } => r.score !== null)
      .sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title))
      .slice(0, 6);

    return scored.map(({ page, score }) => ({
      id: `page:${page.id}`,
      title: page.title,
      subtitle: [...page.path, page.title].join(" › "),
      categoryId: "pages" as MentionCategoryId,
      keywords: ["page", "document", ...page.aliases],
      score,
      renderLeading: () => <PageGlyph icon={page.icon} />,
      run: (ctx: MentionInsertContext) => {
        replaceRange(ctx).insertPageMention({ pageId: page.id, label: page.title }).run();
        recordPageOpen(page.id);
      },
      open: () => {
        recordPageOpen(page.id);
        window.dispatchEvent(new CustomEvent("aurora:open-page", { detail: page.id }));
      },
    }));
  },
});

/* --------------------------------------------------------------- 4. MORE */

registerMentionProvider({
  id: "more",
  label: "More",
  order: 3,
  search: ({ query }) => {
    const items: MentionMenuItem[] = [
      {
        id: "page-new",
        title: "New page",
        subtitle: "Create a page and link to it",
        categoryId: "more",
        keywords: ["page", "new", "create", "document"],
        icon: FilePlus2,
        run: (ctx) => {
          const name = query.trim()
            ? query.trim().replace(/\b\w/g, (c) => c.toUpperCase())
            : "Untitled";
          const page = addPage(name);
          replaceRange(ctx).insertPageMention({ pageId: page.id, label: page.title }).run();
        },
      },
      {
        id: "more-link",
        title: "Web bookmark",
        subtitle: "Save a URL as a mention — coming soon",
        categoryId: "more",
        keywords: ["link", "url", "bookmark", "web"],
        icon: Link2,
        run: () => futureFeature("Web bookmarks"),
      },
      {
        id: "more-reminder",
        title: "Reminder",
        subtitle: "Standalone reminder — coming soon",
        categoryId: "more",
        keywords: ["reminder", "notify", "alert", "todo"],
        icon: Bell,
        run: () => futureFeature("Reminders"),
      },
    ];

    const q = query.trim();
    if (!q) return items;
    return items
      .map((item) => ({ item, score: scoreCandidate(q, { title: item.title, keywords: item.keywords }) }))
      .filter((r): r is { item: MentionMenuItem; score: number } => r.score !== null)
      .sort((a, b) => b.score - a.score)
      .map((r) => ({ ...r.item, score: r.score }));
  },
});

/* ------------------------------------------------------------ page utils */

/** Breadcrumb string for a page mention ("Workspace › Projects › Roadmap"). */
export function pageBreadcrumb(title: string, path: string[]): string {
  return [...path, title].join(" › ");
}
