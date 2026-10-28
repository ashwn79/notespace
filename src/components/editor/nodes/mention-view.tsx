"use client";

import * as React from "react";
import type { NodeViewProps } from "@tiptap/core";
import { NodeViewWrapper } from "@tiptap/react";
import { createPortal } from "react-dom";
import { AlarmClock, Bell, CalendarDays, Link2, TriangleAlert } from "lucide-react";
import type { MentionAttrs } from "../extensions/mention";
import { formatDateMentionLabel } from "@/lib/editor/mentions/date-utils";
import { getPerson, getPage, recordPageOpen } from "@/lib/editor/mentions/workspace";
import { useWorkspace } from "@/lib/editor/mentions/use-workspace";
import { PersonAvatar } from "../mentions/providers";
import {
  DateTooltip,
  PagePreviewCard,
  PersonCard,
  useAnchorRect,
} from "../mentions/mention-cards";
import { DateEditorPanel, type DateDraft } from "../mentions/date-editor";
import { openPageInNewTab } from "../mentions/page-viewer";
import { anchoredPopoverStyle } from "../menus/menu-position";
import { cn } from "@/lib/utils";

/**
 * Mention pill node view.
 *
 *  - date    → colored chip; click re-opens the date editor (calendar, time,
 *              reminder, format, relative toggle, copy/delete/duplicate);
 *              hover shows the complementary representation.
 *  - person  → avatar chip; hover/click shows the profile card.
 *  - page    → emoji chip bound to the workspace; the title resolves LIVE
 *              (renames propagate to every mention automatically); missing
 *              pages degrade to "Missing page" instead of crashing.
 *  - others  → neutral future-ready chips.
 *
 * Every pill is selectable, movable, copyable (ProseMirror atom), focusable
 * and fully keyboard operable.
 */

const HOVER_DELAY = 300;
const HOVER_GRACE = 140;

export function MentionView(props: NodeViewProps) {
  const { node, selected, updateAttributes, deleteNode, editor, getPos } = props;
  const attrs = node.attrs as MentionAttrs;
  const workspace = useWorkspace();

  const anchorRef = React.useRef<HTMLSpanElement>(null);
  const [hoverOpen, setHoverOpen] = React.useState(false);
  const [pinned, setPinned] = React.useState(false);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const enterTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const person = attrs.kind === "person" ? getPerson(attrs.personId) : null;
  const page = attrs.kind === "page" ? getPage(attrs.pageId) : null;
  const pageMissing = attrs.kind === "page" && !page;

  const startHover = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    if (enterTimer.current) clearTimeout(enterTimer.current);
    enterTimer.current = setTimeout(() => setHoverOpen(true), HOVER_DELAY);
  };
  const endHover = () => {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setHoverOpen(false), HOVER_GRACE);
  };

  React.useEffect(
    () => () => {
      if (enterTimer.current) clearTimeout(enterTimer.current);
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    [],
  );

  /* Outside pointerdown closes popovers (pill + portal cards are protected). */
  React.useEffect(() => {
    if (!editorOpen && !pinned) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (anchorRef.current?.contains(target)) return;
      if (target.closest("[data-mention-pop]")) return;
      setEditorOpen(false);
      setPinned(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [editorOpen, pinned]);

  /* ---------------------------------------------------------- actions */

  const activate = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (attrs.kind === "page") {
      // ⌘/Ctrl+Click (mouse or keyboard) opens the page in a new tab.
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        if (attrs.pageId) openPageInNewTab(attrs.pageId);
        return;
      }
      e.preventDefault();
      if (attrs.pageId) {
        recordPageOpen(attrs.pageId);
        window.dispatchEvent(new CustomEvent("aurora:open-page", { detail: attrs.pageId }));
      }
      return;
    }
    if (attrs.kind === "date") {
      e.preventDefault();
      setEditorOpen(true);
      return;
    }
    if (attrs.kind === "person") {
      e.preventDefault();
      setPinned((p) => !p);
      return;
    }
    e.preventDefault();
    window.dispatchEvent(
      new CustomEvent("aurora:future-feature", {
        detail: attrs.kind === "link" ? "Web bookmarks" : "Reminders",
      }),
    );
  };

  const applyDate = (draft: DateDraft) => {
    // "Clear" in the date panel removes the pill entirely.
    if (!draft.date) {
      deleteNode();
      setEditorOpen(false);
      return;
    }
    updateAttributes({
      date: draft.date,
      endDate: draft.endDate ?? null,
      time: draft.time,
      format: draft.format,
      reminder: draft.reminder,
      label: formatDateMentionLabel(draft),
    });
  };

  /* --------------------------------------------------------- rendering */

  const common = {
    ref: anchorRef,
    tabIndex: 0,
    role: attrs.kind === "page" ? "link" : "button",
    "aria-selected": selected || undefined,
    onMouseEnter: startHover,
    onMouseLeave: endHover,
    onClick: activate,
    onDoubleClick: attrs.kind === "date" ? () => setEditorOpen(true) : undefined,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        activate(e);
      }
    },
  };

  /* Date pill */
  if (attrs.kind === "date") {
    const label = formatDateMentionLabel(attrs);
    const hasReminder = Boolean(attrs.reminder) && attrs.reminder !== "none";
    const DateIcon = hasReminder ? AlarmClock : CalendarDays;
    return (
      <NodeViewWrapper
        as="span"
        {...common}
        className={cn("mention", selected && "is-selected", editorOpen && "is-open")}
        data-mention-kind="date"
        aria-haspopup="dialog"
        aria-expanded={editorOpen}
        aria-label={`Date: ${label}`}
        title={undefined}
      >
        <DateIcon size={12.5} className="mention-icon" aria-hidden />
        <span className="mention-label">{label}</span>
        <DateTooltip
          anchorRef={anchorRef}
          open={hoverOpen && !editorOpen}
          attrs={attrs}
        />
        {editorOpen ? (
          createPortal(
            <DatePopoverShell anchorRef={anchorRef} onClose={() => setEditorOpen(false)}>
              <DateEditorPanel
                initial={{
                  date: attrs.date,
                  endDate: attrs.endDate,
                  time: attrs.time,
                  format: attrs.format,
                  reminder: attrs.reminder,
                }}
                mode="edit"
                onApply={applyDate}
                onDelete={() => {
                  deleteNode();
                }}
                onClose={() => setEditorOpen(false)}
              />
            </DatePopoverShell>,
            document.body,
          )
        ) : null}
      </NodeViewWrapper>
    );
  }

  /* Person pill */
  if (attrs.kind === "person") {
    const name = person?.name ?? attrs.label ?? "Unknown";
    return (
      <NodeViewWrapper
        as="span"
        {...common}
        className={cn("mention", selected && "is-selected")}
        data-mention-kind="person"
        aria-label={`Person: ${name}${person?.role ? `, ${person.role}` : ""}`}
      >
        <PersonAvatar name={name} hue={person?.hue ?? 265} size={15} />
        <span className="mention-label">{name}</span>
        <PersonCard
          anchorRef={anchorRef}
          open={(hoverOpen || pinned) && !pageMissing}
          person={person}
          fallbackName={name}
          onClose={() => setPinned(false)}
          onMouseEnter={() => {
            if (leaveTimer.current) clearTimeout(leaveTimer.current);
          }}
          onMouseLeave={() => setHoverOpen(false)}
        />
      </NodeViewWrapper>
    );
  }

  /* Page pill */
  if (attrs.kind === "page") {
    const title = page?.title ?? attrs.label ?? "Untitled";
    return (
      <NodeViewWrapper
        as="span"
        {...common}
        className={cn("mention", selected && "is-selected", pageMissing && "is-broken")}
        data-mention-kind="page"
        aria-label={pageMissing ? "Missing page" : `Page: ${title}`}
      >
        {pageMissing ? (
          <TriangleAlert size={12.5} className="mention-icon" aria-hidden />
        ) : (
          <span className="mention-page-icon" aria-hidden>
            {page!.icon}
          </span>
        )}
        <span className="mention-label">{pageMissing ? "Missing page" : title}</span>
        <PagePreviewCard
          anchorRef={anchorRef}
          open={hoverOpen && !!page}
          page={page}
          fallbackTitle={title}
          onClose={() => setHoverOpen(false)}
          onMouseEnter={() => {
            if (leaveTimer.current) clearTimeout(leaveTimer.current);
          }}
          onMouseLeave={() => setHoverOpen(false)}
        />
      </NodeViewWrapper>
    );
  }

  /* Future-ready kinds */
  const Icon = attrs.kind === "reminder" ? Bell : Link2;
  const label = attrs.label || (attrs.kind === "reminder" ? "Reminder" : "Link");
  return (
    <NodeViewWrapper
      as="span"
      {...common}
      className={cn("mention", selected && "is-selected")}
      data-mention-kind={attrs.kind}
      aria-label={label}
    >
      <Icon size={12.5} className="mention-icon" aria-hidden />
      <span className="mention-label">{label}</span>
    </NodeViewWrapper>
  );
}

/* ----------------------------------------------- date popover positioning */

function DatePopoverShell({
  anchorRef,
  onClose,
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const rect = useAnchorRect(anchorRef, true);
  const style = anchoredPopoverStyle(rect, { width: 316, height: 520, gap: 8 });

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      data-mention-pop
      role="dialog"
      aria-label="Edit date"
      style={style}
      className="fixed z-[105] max-h-[calc(100vh-16px)] overflow-y-auto overscroll-contain rounded-xl border border-border/80 bg-popover/95 text-popover-foreground shadow-2xl shadow-black/40 backdrop-blur-xl animate-pop-in max-md:hidden"
    >
      {children}
    </div>
  );
}
