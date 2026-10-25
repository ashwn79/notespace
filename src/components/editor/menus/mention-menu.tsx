"use client";

import * as React from "react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { CalendarDays, UserRound, FileText, type LucideIcon } from "lucide-react";
import { mentionController, type MentionMenuItem } from "../extensions/mention";
import { fuzzyMatch } from "@/lib/editor/utils";
import { cn } from "@/lib/utils";

/**
 * The "@" mention menu — People / Dates / Page links, fuzzy-filtered and
 * fully keyboard driven. Selecting an item inserts the matching chip.
 */

interface MenuState {
  open: boolean;
  props: SuggestionProps<MentionMenuItem> | null;
}

const GROUP_ICONS: Record<MentionMenuItem["group"], LucideIcon> = {
  People: UserRound,
  Dates: CalendarDays,
  Pages: FileText,
};

export function MentionMenu() {
  const [state, setState] = React.useState<MenuState>({ open: false, props: null });
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [, forceTick] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

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

  const query = state.props?.query?.replace(/^@/, "") ?? "";
  const groups = React.useMemo(() => buildMentionItems(query), [query]);
  const items = React.useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const groupStarts = React.useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    for (const group of groups) {
      starts.push(acc);
      acc += group.items.length;
    }
    return starts;
  }, [groups]);

  // Best match first — reset the highlight whenever the query changes.
  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  React.useEffect(() => {
    if (!state.open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, state.open]);

  const selectItem = React.useCallback(
    (item: MentionMenuItem) => {
      state.props?.command(item);
      setState({ open: false, props: null });
    },
    [state.props],
  );

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
        setState((prev) => ({ ...prev, open: false }));
        return true;
      }
      return false;
    },
    [items, activeIndex, selectItem],
  );

  React.useEffect(() => {
    mentionController.attach({
      onStart: (props) => {
        setActiveIndex(0);
        setState({ open: true, props });
      },
      onUpdate: (props) => setState((prev) => ({ open: true, props })),
      onExit: () => setState({ open: false, props: null }),
      onKeyDown: handleKeyDown,
    });
    return () => mentionController.detach();
  }, [handleKeyDown]);

  if (!state.open || items.length === 0) return null;

  const rect = state.props?.clientRect?.();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  let style: React.CSSProperties = {};
  if (isMobile) {
    style = { left: 0, right: 0, bottom: 0, top: "auto", maxWidth: "100%" };
  } else if (rect) {
    const menuHeight = 320;
    const flip = rect.bottom + menuHeight + 16 > window.innerHeight;
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - 332);
    style = flip
      ? { left, bottom: window.innerHeight - rect.top + 8, top: "auto" }
      : { left, top: rect.bottom + 8 };
  }

  return (
    <div
      role="dialog"
      aria-label="Mention menu"
      style={style}
      className="fixed z-[95] w-[324px] overflow-hidden rounded-xl border border-border/80 bg-popover/95 text-popover-foreground shadow-2xl shadow-black/40 backdrop-blur-xl animate-pop-in max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0"
    >
      <div
        ref={listRef}
        role="listbox"
        aria-label="Mention targets"
        className="max-h-[280px] overflow-y-auto overscroll-contain p-1.5"
      >
        {groups.map((group, groupIndex) => {
          const start = groupStarts[groupIndex] ?? 0;
          const GroupIcon = GROUP_ICONS[group.group];
          return (
            <div key={group.group} role="group" aria-label={group.group}>
              <div className="flex items-center gap-1.5 px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                <GroupIcon size={11} />
                {group.group}
              </div>
              {group.items.map((item) => {
                const index = start + group.items.indexOf(item);
                const active = index === activeIndex;
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
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors duration-100",
                      active ? "bg-accent text-accent-foreground" : "text-foreground/90",
                    )}
                  >
                    {item.emoji ? (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/60 text-[15px]">
                        {item.emoji}
                      </span>
                    ) : (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/60 text-foreground/80">
                        <GroupIcon size={13.5} strokeWidth={1.8} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium leading-5">{item.label}</span>
                      {item.hint && (
                        <span className="block truncate text-[11px] leading-4 text-muted-foreground">{item.hint}</span>
                      )}
                    </span>
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

/* ------------------------------------------------------------------ */

const PEOPLE: { name: string; role: string }[] = [
  { name: "Alex Rivera", role: "Design lead" },
  { name: "Priya Sharma", role: "Engineering" },
  { name: "Sam Chen", role: "Product" },
  { name: "Maya Patel", role: "Marketing" },
];

const PAGES: { title: string; pageId: string }[] = [
  { title: "This page", pageId: "current" },
  { title: "Getting started", pageId: "page-getting-started" },
  { title: "Product roadmap", pageId: "page-roadmap" },
  { title: "Meeting notes", pageId: "page-meeting-notes" },
];

/** Build the ranked mention menu for the current query. */
export function buildMentionItems(query: string): { group: MentionMenuItem["group"]; items: MentionMenuItem[] }[] {
  const q = query.trim().toLowerCase();

  const dateItems: MentionMenuItem[] = [
    {
      id: "date-today",
      group: "Dates",
      label: "Today",
      emoji: "📅",
      keywords: ["today", "now"],
      apply: (editor, range) => insertDate(editor, range, shiftDays(0)),
    },
    {
      id: "date-tomorrow",
      group: "Dates",
      label: "Tomorrow",
      emoji: "🌅",
      keywords: ["tomorrow"],
      apply: (editor, range) => insertDate(editor, range, shiftDays(1)),
    },
    {
      id: "date-yesterday",
      group: "Dates",
      label: "Yesterday",
      emoji: "🕓",
      keywords: ["yesterday"],
      apply: (editor, range) => insertDate(editor, range, shiftDays(-1)),
    },
    {
      id: "date-picker",
      group: "Dates",
      label: "Pick a date & reminders…",
      emoji: "🗓️",
      hint: "Calendar, time, end date, alerts",
      keywords: ["date", "calendar", "remind", "reminder", "time", "pick"],
      apply: (editor, range) => {
        editor.chain().focus().deleteRange(range).insertMention({ mentionType: "date", openPanel: true }).run();
      },
    },
  ];

  const personItems: MentionMenuItem[] = PEOPLE.map((person) => ({
    id: `person-${person.name.toLowerCase().replace(/\s+/g, "-")}`,
    group: "People" as const,
    label: person.name,
    hint: person.role,
    keywords: [person.name.toLowerCase(), person.role.toLowerCase()],
    apply: (editor: import("@tiptap/core").Editor, range: import("@tiptap/core").Range) => {
      editor.chain().focus().deleteRange(range).insertMention({ mentionType: "person", name: person.name }).run();
    },
  }));

  if (q && !PEOPLE.some((p) => fuzzyMatch(q, p.name) || fuzzyMatch(q, p.role))) {
    personItems.unshift({
      id: "person-new",
      group: "People",
      label: `Add “${query.trim()}”`,
      hint: "Mention a new person",
      keywords: ["add", "new", "person"],
      apply: (editor, range) => {
        editor.chain().focus().deleteRange(range).insertMention({ mentionType: "person", name: query.trim() }).run();
      },
    });
  }

  const pageItems: MentionMenuItem[] = PAGES.map((page) => ({
    id: `page-${page.pageId}`,
    group: "Pages" as const,
    label: page.title,
    keywords: [page.title.toLowerCase(), "page", "link"],
    apply: (editor: import("@tiptap/core").Editor, range: import("@tiptap/core").Range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertMention({ mentionType: "page", title: page.title === "This page" ? docTitleFallback(editor) : page.title, pageId: page.pageId })
        .run();
    },
  }));

  const all: [MentionMenuItem["group"], MentionMenuItem[]][] = [
    ["People", personItems],
    ["Dates", dateItems],
    ["Pages", pageItems],
  ];

  if (!q) return all.map(([group, items]) => ({ group, items }));

  const score = (item: MentionMenuItem): number => {
    const label = item.label.toLowerCase();
    if (label === q) return 0;
    if (label.startsWith(q)) return 1;
    if (item.keywords.some((k) => k === q)) return 2;
    if (item.keywords.some((k) => k.startsWith(q))) return 3;
    if (label.includes(q)) return 4;
    if (item.keywords.some((k) => k.includes(q))) return 5;
    if (fuzzyMatch(q, item.label)) return 6;
    return 100;
  };

  const ranked = all
    .map(([group, items]) => ({
      group,
      items: items
        .map((item) => ({ item, s: score(item) }))
        .filter((entry) => entry.s < 100)
        .sort((a, b) => a.s - b.s)
        .map((entry) => entry.item),
    }))
    .filter((group) => group.items.length > 0);

  return ranked;
}

function docTitleFallback(editor: import("@tiptap/core").Editor): string {
  const first = editor.state.doc.firstChild;
  if (first?.type.name === "pageTitle" && first.textContent.trim()) return first.textContent.trim();
  return "Untitled";
}

function insertDate(editor: import("@tiptap/core").Editor, range: import("@tiptap/core").Range, iso: string) {
  editor.chain().focus().deleteRange(range).insertMention({ mentionType: "date", date: iso }).run();
}

function shiftDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
