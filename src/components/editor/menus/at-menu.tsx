"use client";

import * as React from "react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { ArrowLeft, ChevronRight, SearchX, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { atController } from "../extensions/at-command";
import { anchoredMenuStyle } from "./menu-position";
import { cn } from "@/lib/utils";
import type { Editor } from "@tiptap/core";
/* Provider registrations — the @ menu renders whatever is registered here. */
import "../mentions/providers";
import {
  getMentionProviders,
  type MentionMenuItem,
  type MentionPanelKind,
  type MentionProvider,
} from "@/lib/editor/mentions/framework";
import { DateEditorPanel, EMPTY_DATE_DRAFT, type DateDraft, type PanelKeyRouter } from "../mentions/date-editor";
import { nowHHMM } from "@/lib/editor/mentions/date-utils";
import { addPerson, recordPersonUsage } from "@/lib/editor/mentions/workspace";

/**
 * The "@" mention menu — a generic, provider-driven surface.
 * Categories (Dates / People / Pages / More) come from the mention
 * framework registry; the menu only knows how to render groups, run
 * keyboard interactions and host built-in sub-panels (date editor,
 * invite person).
 */

interface MenuState {
  open: boolean;
  props: SuggestionProps<MentionMenuItem> | null;
}

type PanelState = { kind: MentionPanelKind } | null;

const CATEGORY_CHIP: Record<string, string> = {
  dates: "text-[oklch(0.72_0.14_250)]",
  people: "text-[oklch(0.72_0.16_305)]",
  pages: "text-[oklch(0.72_0.15_155)]",
  more: "text-muted-foreground",
};

const MENU_WIDTH = 380;
const MENU_HEIGHT = 360;

export function AtMenu({ editor }: { editor: Editor | null }) {
  const [state, setState] = React.useState<MenuState>({ open: false, props: null });
  const [dismissed, setDismissed] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [panel, setPanel] = React.useState<PanelState>(null);
  const [, forceTick] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const panelRouter = React.useRef<PanelKeyRouter | null>(null);

  // Keep the menu glued to the caret while scrolling / resizing.
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

  /* ------------------------------------------------------ search (registry) */
  const groups = React.useMemo(() => {
    const out: { provider: MentionProvider; items: MentionMenuItem[] }[] = [];
    for (const provider of getMentionProviders()) {
      try {
        const items = provider.search({ query, editor: editor as Editor });
        if (items.length) out.push({ provider, items });
      } catch {
        /* a broken provider must never take the menu down */
      }
    }
    /* Cross-category relevance gate: when one category has a strong match
       (exact/prefix), weak fuzzy matches elsewhere are noise — drop them so
       the strong category surfaces instead of hiding below the fold. */
    if (query.trim()) {
      let best = 0;
      for (const g of out) for (const item of g.items) best = Math.max(best, item.score ?? 0);
      if (best >= 700) {
        const floor = best - 320;
        for (const g of out) g.items = g.items.filter((i) => (i.score ?? 0) >= floor);
      }
    }
    return out.filter((g) => g.items.length > 0);
  }, [query, editor]);

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

  React.useEffect(() => {
    setActiveIndex((prev) => (prev >= items.length ? 0 : prev));
  }, [items.length]);

  React.useEffect(() => {
    if (!state.open || panel) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, state.open, panel]);

  const close = React.useCallback(() => {
    setState({ open: false, props: null });
    setPanel(null);
    panelRouter.current = null;
  }, []);

  const openPanel = React.useCallback((kind: MentionPanelKind) => {
    panelRouter.current = null;
    setPanel({ kind });
  }, []);

  const selectItem = React.useCallback(
    (item: MentionMenuItem) => {
      if (item.panel) {
        openPanel(item.panel);
        return;
      }
      state.props?.command(item);
      close();
    },
    [state.props, close, openPanel],
  );

  /* ----------------------------------------------------------- keyboard */
  const handleKeyDown = React.useCallback(
    (keyProps: SuggestionKeyDownProps): boolean => {
      const event = keyProps.event;

      /* Sub-panel open → route keys into the panel first. */
      if (panel) {
        if (panelRouter.current?.handleKey(event)) return true;
        // Swallow everything else so typing can't corrupt the document
        // while the date editor / invite form is up.
        event.preventDefault();
        return true;
      }

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
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        /* Mod+Enter — open the selected item without inserting. */
        event.preventDefault();
        const item = items[activeIndex];
        const props = state.props;
        if (item?.open && props) {
          props.editor.chain().focus().deleteRange(props.range).run();
          item.open({ editor: props.editor, range: props.range });
          close();
        }
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
        setDismissed(true);
        setState((prev) => ({ ...prev, open: false }));
        setPanel(null);
        return true;
      }
      return false;
    },
    [items, activeIndex, selectItem, close, panel, state.props],
  );

  React.useEffect(() => {
    atController.attach({
      onStart: (props) => {
        setDismissed(false);
        setActiveIndex(0);
        setPanel(null);
        setState({ open: true, props });
      },
      onUpdate: (props) => {
        setDismissed(false);
        setState((prev) => ({ open: true, props }));
      },
      onExit: () => {
        setState({ open: false, props: null });
        setPanel(null);
        panelRouter.current = null;
      },
      onKeyDown: handleKeyDown,
    });
    return () => atController.detach();
  }, [handleKeyDown]);

  if (!state.open || dismissed) return null;

  const rect = state.props?.clientRect?.() ?? null;
  const style = anchoredMenuStyle(rect, { width: MENU_WIDTH, height: panel ? 420 : MENU_HEIGHT });
  const hasResults = items.length > 0;

  /* ------------------------------------------------------- sub-panels */
  if (panel?.kind === "date" || panel?.kind === "datetime" || panel?.kind === "relative") {
    const initial: DateDraft =
      panel.kind === "datetime"
        ? { ...EMPTY_DATE_DRAFT, time: nowHHMM() }
        : panel.kind === "relative"
          ? { ...EMPTY_DATE_DRAFT, format: "relative" }
          : EMPTY_DATE_DRAFT;

    return (
      <div
        role="dialog"
        aria-label="Pick a date"
        style={style}
        className="fixed z-[95] max-h-[calc(100vh-20px)] overflow-y-auto overscroll-contain w-[312px] rounded-xl border border-border/80 bg-popover/95 text-popover-foreground shadow-2xl shadow-black/40 backdrop-blur-xl animate-pop-in max-md:hidden"
      >
        <div className="flex items-center gap-1.5 border-b border-border/60 px-2.5 py-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <button
            type="button"
            aria-label="Back to mention menu"
            onClick={() => setPanel(null)}
            className="flex h-5 w-5 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft size={13} />
          </button>
          Pick a date
          {query ? <span className="ml-auto font-normal normal-case">“@{query}”</span> : null}
        </div>
        <DateEditorPanel
          initial={initial}
          mode="insert"
          onRouter={(router) => (panelRouter.current = router)}
          onClose={() => {
            setPanel(null);
            panelRouter.current = null;
          }}
          onApply={(draft) => {
            const props = state.props;
            if (!props || !draft.date) return;
            props.editor
              .chain()
              .focus()
              .deleteRange(props.range)
              .insertDateMention({
                date: draft.date,
                endDate: draft.endDate,
                time: draft.time,
                format: draft.format,
                reminder: draft.reminder,
              })
              .run();
            close();
          }}
        />
      </div>
    );
  }

  if (panel?.kind === "invite") {
    return (
      <InvitePanel
        style={style}
        query={query}
        onBack={() => setPanel(null)}
        onDone={(name) => {
          const props = state.props;
          if (!props || !name) return;
          const person = addPerson(name);
          props.editor
            .chain()
            .focus()
            .deleteRange(props.range)
            .insertPersonMention({ personId: person.id, label: person.name })
            .run();
          recordPersonUsage(person.id);
          toast.success(`${person.name} added to the directory`);
          close();
        }}
      />
    );
  }

  /* --------------------------------------------------------- main list */
  return (
    <div
      role="dialog"
      aria-label="Mention menu"
      style={style}
      className="fixed z-[95] max-h-[calc(100vh-20px)] overflow-hidden w-[380px] max-md:w-full rounded-xl border border-border/80 bg-popover/95 text-popover-foreground shadow-2xl shadow-black/40 backdrop-blur-xl animate-pop-in max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0"
    >
      <div
        ref={listRef}
        role="listbox"
        aria-label="Mention items"
        className="max-h-[318px] overflow-y-auto overscroll-contain p-1.5"
      >
        {!hasResults ? (
          <div className="px-2 py-6 text-center">
            <SearchX size={20} className="mx-auto mb-2 text-muted-foreground/60" />
            <p className="text-[13px] font-medium text-foreground/80">
              No results for “@{query}”
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Try a date, person or page name.</p>
          </div>
        ) : (
          groups.map((group, groupIndex) => {
            const start = groupStarts[groupIndex] ?? 0;
            return (
              <div key={group.provider.id} role="group" aria-label={group.provider.label}>
                <div className="flex items-center gap-2 px-2.5 pb-1 pt-2">
                  <span className={cn("text-[10.5px] font-semibold uppercase tracking-[0.08em]", CATEGORY_CHIP[group.provider.id])}>
                    {group.provider.label}
                  </span>
                  <span className="h-px flex-1 bg-border/60" />
                </div>
                {group.items.map((item, idx) => {
                  const index = start + idx;
                  const active = index === activeIndex;
                  return (
                    <MentionRow
                      key={item.id}
                      item={item}
                      index={index}
                      active={active}
                      onHover={() => setActiveIndex(index)}
                      onSelect={() => selectItem(item)}
                    />
                  );
                })}
              </div>
            );
          })
        )}

        {/* Category empty states (e.g. people) */}
        {!hasResults &&
          getMentionProviders()
            .filter((p) => p.emptyState)
            .map((p) => (
              <div
                key={`empty-${p.id}`}
                role="group"
                aria-label={p.label}
                className="mx-1 mb-1 flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                  <UserRoundPlus size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">{p.emptyState!.message}</span>
                  <span className="block text-xs text-muted-foreground">{p.label}</span>
                </span>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (p.emptyState?.panel) openPanel(p.emptyState.panel);
                    else p.emptyState?.action?.({
                      editor: editor as Editor,
                      range: state.props!.range,
                    });
                  }}
                  className="shrink-0 rounded-lg bg-primary/15 px-2.5 py-1 text-[11.5px] font-semibold text-primary transition-colors hover:bg-primary/25"
                >
                  {p.emptyState!.actionLabel}
                </button>
              </div>
            ))}
      </div>

      <div className="flex items-center gap-3 border-t border-border/60 bg-muted/30 px-3.5 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="kbd">↑</span>
          <span className="kbd">↓</span> navigate
        </span>
        <span className="flex items-center gap-1">
          <span className="kbd">↵</span> insert
        </span>
        <span className="hidden items-center gap-1 sm:flex">
          <span className="kbd">⌘↵</span> open
        </span>
        <span className="flex items-center gap-1">
          <span className="kbd">esc</span> dismiss
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ row */

function MentionRow({
  item,
  index,
  active,
  onHover,
  onSelect,
}: {
  item: MentionMenuItem;
  index: number;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  const Icon = item.icon;
  const leading = item.renderLeading ? (
    item.renderLeading()
  ) : Icon ? (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/60 transition-colors",
        active && "border-primary/30 bg-primary/15 text-primary",
      )}
    >
      <Icon size={15} strokeWidth={1.9} />
    </span>
  ) : null;

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      data-index={index}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors duration-100",
        active ? "bg-accent text-accent-foreground" : "text-foreground/90",
      )}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium leading-5">{item.title}</span>
        <span className="block truncate text-[11.5px] leading-4 text-muted-foreground">{item.subtitle}</span>
      </span>
      {item.shortcut ? (
        <span className="kbd shrink-0 opacity-70">{item.shortcut}</span>
      ) : (
        <ChevronRight
          size={13}
          className={cn("shrink-0 text-muted-foreground transition-opacity", active ? "opacity-60" : "opacity-0")}
        />
      )}
    </button>
  );
}

/* --------------------------------------------------------- invite panel */

function InvitePanel({
  style,
  query,
  onBack,
  onDone,
}: {
  style: React.CSSProperties;
  query: string;
  onBack: () => void;
  onDone: (name: string) => void;
}) {
  const [name, setName] = React.useState(query.trim());
  const [role, setRole] = React.useState("");

  return (
    <div
      role="dialog"
      aria-label="Invite person"
      style={style}
      className="fixed z-[95] max-h-[calc(100vh-20px)] overflow-y-auto overscroll-contain w-[312px] rounded-xl border border-border/80 bg-popover/95 text-popover-foreground shadow-2xl shadow-black/40 backdrop-blur-xl animate-pop-in max-md:hidden"
    >
      <div className="flex items-center gap-1.5 border-b border-border/60 px-2.5 py-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <button
          type="button"
          aria-label="Back to mention menu"
          onClick={onBack}
          className="flex h-5 w-5 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft size={13} />
        </button>
        Invite person
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onDone(name.trim());
        }}
        className="space-y-2.5 p-3"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name…"
          aria-label="Person name"
          autoFocus
          className="h-9 w-full rounded-lg border border-border bg-muted/40 px-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
        />
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Role (optional)…"
          aria-label="Person role"
          className="h-9 w-full rounded-lg border border-border bg-muted/40 px-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onBack}
            className="h-8 rounded-lg px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="h-8 rounded-lg bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add &amp; mention
          </button>
        </div>
      </form>
    </div>
  );
}
