"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CalendarClock, Mail, MessageSquare, SquareCheckBig } from "lucide-react";
import { toast } from "sonner";
import { anchoredPopoverStyle } from "../menus/menu-position";
import {
  dateTooltipLines,
  formatFull,
  formatTime,
  parseISODate,
} from "@/lib/editor/mentions/date-utils";
import { relativeTime, type WorkspacePage, type WorkspacePerson } from "@/lib/editor/mentions/workspace";
import { useWorkspace } from "@/lib/editor/mentions/use-workspace";
import { PersonAvatar } from "./providers";
import { cn } from "@/lib/utils";

/**
 * Hover surfaces for mention pills — profile cards, page previews and
 * date tooltips. All portal into <body> and use the shared popover
 * positioning (flip + clamp), so they can never clip at the viewport edge.
 */

export function useAnchorRect(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  React.useEffect(() => {
    if (!active) {
      setRect(null);
      return;
    }
    const measure = () => setRect(ref.current?.getBoundingClientRect() ?? null);
    measure();
    let raf = 0;
    const tick = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", tick, true);
    window.addEventListener("resize", tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", tick, true);
      window.removeEventListener("resize", tick);
    };
  }, [active, ref]);
  return rect;
}

/* ------------------------------------------------------------ date tooltip */

export function DateTooltip({
  anchorRef,
  open,
  attrs,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  attrs: { date: string | null; time?: string | null; format?: string; reminder?: string | null };
}) {
  const rect = useAnchorRect(anchorRef, open);
  if (!open || !rect) return null;
  const { title, subtitle } = dateTooltipLines(attrs as never);
  const style = anchoredPopoverStyle(rect, { width: 232, height: 56, gap: 6 });
  return createPortal(
    <div
      role="tooltip"
      style={style}
      className="mention-pop pointer-events-none fixed z-[100] w-[232px] animate-pop-in"
    >
      <p className="truncate text-[12.5px] font-semibold">{title}</p>
      {subtitle ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</p> : null}
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------- person card */

export function PersonCard({
  anchorRef,
  open,
  person,
  fallbackName,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  person: WorkspacePerson | null;
  fallbackName: string;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const rect = useAnchorRect(anchorRef, open);
  const name = person?.name ?? fallbackName ?? "Unknown person";

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !rect) return null;
  const style = anchoredPopoverStyle(rect, { width: 264, height: 168, gap: 8 });

  return createPortal(
    <div
      role="dialog"
      aria-label={`Profile — ${name}`}
      data-mention-pop
      style={style}
      className="mention-pop fixed z-[100] w-[264px] animate-pop-in p-3"
      onKeyDown={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-center gap-2.5">
        <PersonAvatar name={name} hue={person?.hue ?? 265} size={38} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold leading-5">
            {name}
            {person?.status && person.status !== "offline" ? (
              <span
                aria-hidden
                className={cn("mention-status-dot is-static", person.status === "online" ? "is-online" : "is-away")}
              />
            ) : null}
          </p>
          <p className="truncate text-[11.5px] text-muted-foreground">
            {person?.role ?? "Workspace member"}
            {person?.status ? ` · ${person.status}` : ""}
          </p>
        </div>
      </div>
      {person?.email ? (
        <p className="mt-2 flex items-center gap-1.5 truncate text-[11.5px] text-muted-foreground">
          <Mail size={12} className="shrink-0" />
          {person.email}
        </p>
      ) : null}
      <div className="mt-2.5 flex gap-1.5 border-t border-border/50 pt-2.5">
        <button
          type="button"
          onClick={() => {
            toast(`Message to ${name} — coming soon`, { description: "Chat integration lands with the collab layer." });
            onClose();
          }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/15 px-2 py-1.5 text-[11.5px] font-semibold text-primary transition-colors hover:bg-primary/25"
        >
          <MessageSquare size={12} /> Message
        </button>
        <button
          type="button"
          onClick={() => {
            toast(`Assign ${name} — coming soon`, { description: "Task assignment arrives with the Tasks entity." });
            onClose();
          }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/70 px-2 py-1.5 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <SquareCheckBig size={12} /> Assign
        </button>
      </div>
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------- page card */

export function PagePreviewCard({
  anchorRef,
  open,
  page,
  fallbackTitle,
  missing,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  page: WorkspacePage | null;
  fallbackTitle: string;
  missing?: boolean;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const rect = useAnchorRect(anchorRef, open);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !rect) return null;
  const title = page?.title ?? fallbackTitle ?? "Untitled page";
  const style = anchoredPopoverStyle(rect, { width: 280, height: 150, gap: 8 });

  return createPortal(
    <div
      role="dialog"
      aria-label={`Page preview — ${title}`}
      data-mention-pop
      style={style}
      className="mention-pop fixed z-[100] w-[280px] animate-pop-in p-3"
      onKeyDown={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {missing || !page ? (
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">⚠</span>
          <div>
            <p className="text-[13px] font-semibold">Missing page</p>
            <p className="text-[11.5px] text-muted-foreground">This page no longer exists.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/60 text-[17px]">
              {page.icon}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold leading-5">{title}</p>
              <p className="truncate text-[11px] text-muted-foreground">{[...page.path, page.title].join(" › ")}</p>
            </div>
          </div>
          {page.excerpt ? (
            <p className="mt-2 line-clamp-2 text-[11.5px] leading-4 text-muted-foreground">{page.excerpt}</p>
          ) : null}
          <p className="mt-2 flex items-center gap-1.5 border-t border-border/50 pt-2 text-[10.5px] text-muted-foreground/80">
            <CalendarClock size={11} />
            Edited {relativeTime(page.editedAt)} · click to open
          </p>
        </>
      )}
    </div>,
    document.body,
  );
}

/* -------------------------------------------------- person profile dialog */

export function PersonProfileDialog({
  personId,
  fallbackName,
  onClose,
}: {
  personId: string;
  fallbackName?: string;
  onClose: () => void;
}) {
  const workspace = useWorkspace();
  const person = workspace.people.find((p) => p.id === personId) ?? null;
  const name = person?.name ?? fallbackName ?? "Unknown person";

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px] animate-pop-in"
      onClick={onClose}
      role="dialog"
      aria-label={`Profile — ${name}`}
    >
      <div
        className="w-[320px] rounded-2xl border border-border/80 bg-popover/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <PersonAvatar name={name} hue={person?.hue ?? 265} size={48} />
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-[15px] font-semibold leading-6">
              {name}
              {person?.status && person.status !== "offline" ? (
                <span
                  aria-hidden
                  className={cn("mention-status-dot is-static", person.status === "online" ? "is-online" : "is-away")}
                />
              ) : null}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {person?.role ?? "Workspace member"}
              {person?.status ? ` · ${person.status}` : ""}
            </p>
          </div>
        </div>
        {person?.email ? (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1.5 text-[12px] text-muted-foreground">
            <Mail size={12} className="shrink-0" />
            {person.email}
          </p>
        ) : null}
        <div className="mt-3 flex gap-1.5">
          <button
            type="button"
            onClick={() => {
              toast(`Message to ${name} — coming soon`);
              onClose();
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/15 px-2 py-2 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/25"
          >
            <MessageSquare size={13} /> Message
          </button>
          <button
            type="button"
            onClick={() => {
              toast(`Assign ${name} — coming soon`);
              onClose();
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/70 px-2 py-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <SquareCheckBig size={13} /> Assign
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Shared date pill tooltip helper (formatted text, both directions). */
export function describeDate(attrs: {
  date: string | null;
  time?: string | null;
  format?: string;
}): string {
  const d = attrs.date ? parseISODate(attrs.date) : null;
  if (!d || !attrs.date) return "Pick a date";
  const timeSuffix = attrs.time ? ` • ${formatTime(attrs.time)}` : "";
  return `${formatFull(d)}${timeSuffix}`;
}
