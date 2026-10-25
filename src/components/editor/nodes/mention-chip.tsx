"use client";

import * as React from "react";
import type { NodeViewProps } from "@tiptap/core";
import { NodeViewWrapper } from "@tiptap/react";
import { createPortal } from "react-dom";
import { AlarmClock, CalendarDays, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type MentionDateAttrs,
  dateChipLabel,
  dateChipTooltip,
  hasReminder,
} from "@/lib/editor/dates";
import { DatePanel } from "../panels/date-panel";
import type { MentionAttrs } from "../extensions/mention";

/**
 * Inline mention chips — date / person / page. Typographically neutral:
 * the chip inherits font size & line height and sits on the text baseline,
 * so inserting a chip never changes the paragraph's layout metrics.
 */

export function MentionChipView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const attrs = node.attrs as MentionAttrs;
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);
  const chipRef = React.useRef<HTMLSpanElement>(null);

  const openPanelAtChip = React.useCallback(() => {
    const rect = chipRef.current?.getBoundingClientRect();
    if (rect) setAnchorRect(new DOMRect(rect.left, rect.bottom, rect.width, 0));
  }, []);

  // Fresh "Pick a date" chips open their panel automatically once.
  React.useEffect(() => {
    if (attrs.openPanel && attrs.mentionType === "date") {
      openPanelAtChip();
      setPanelOpen(true);
      updateAttributes({ openPanel: false });
    }
     
  }, []);

  const togglePanel = () => {
    openPanelAtChip();
    setPanelOpen((v) => !v);
  };

  if (attrs.mentionType === "date") {
    const dateAttrs = attrs as unknown as MentionDateAttrs;
    const reminder = hasReminder(dateAttrs);
    return (
      <NodeViewWrapper as="span" className="mention-wrapper">
        <span
          ref={chipRef}
          role="button"
          tabIndex={0}
          data-mention-chip="date"
          data-selected={selected ? "true" : undefined}
          aria-label={`Date: ${dateChipLabel(dateAttrs)}. ${dateChipTooltip(dateAttrs)}`}
          title={dateChipTooltip(dateAttrs)}
          onClick={togglePanel}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              togglePanel();
            }
          }}
          className="mention-chip mention-chip-date"
        >
          {reminder ? <AlarmClock className="chip-icon" aria-hidden /> : <CalendarDays className="chip-icon" aria-hidden />}
          <span className="chip-label">{dateChipLabel(dateAttrs)}</span>
        </span>

        {panelOpen && anchorRect && (
          <DatePanel
            attrs={dateAttrs}
            anchorRect={anchorRect}
            onChange={(patch) => updateAttributes(patch)}
            onClear={() => {
              setPanelOpen(false);
              deleteNode();
            }}
            onClose={() => setPanelOpen(false)}
          />
        )}
      </NodeViewWrapper>
    );
  }

  if (attrs.mentionType === "person") {
    return (
      <NodeViewWrapper as="span" className="mention-wrapper">
        <span
          ref={chipRef}
          data-mention-chip="person"
          data-selected={selected ? "true" : undefined}
          title={`Mentioned ${attrs.name}`}
          className="mention-chip mention-chip-person"
        >
          <span className="chip-avatar" style={{ background: avatarHue(attrs.name) }} aria-hidden>
            {initials(attrs.name)}
          </span>
          <span className="chip-label">{attrs.name || "Person"}</span>
        </span>
      </NodeViewWrapper>
    );
  }

  // Page chip
  const isCurrentPage = attrs.pageId === "current";
  return (
    <NodeViewWrapper as="span" className="mention-wrapper">
      <span
        ref={chipRef}
        data-mention-chip="page"
        data-selected={selected ? "true" : undefined}
        role="link"
        tabIndex={0}
        title={isCurrentPage ? "This page" : `Page: ${attrs.title}`}
        onClick={() => {
          if (isCurrentPage) {
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            // Stub pages in this single-document demo — surfaced honestly.
            import("sonner").then(({ toast }) => toast.info(`"${attrs.title}" is a stub page in this demo`));
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLElement).click();
        }}
        className={cn("mention-chip mention-chip-page", !isCurrentPage && "cursor-default")}
      >
        <FileText className="chip-icon" aria-hidden />
        <span className="chip-label">{attrs.title || "Untitled page"}</span>
      </span>
    </NodeViewWrapper>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Deterministic pleasant hue per person name. */
function avatarHue(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  const hue = 265 + (hash % 80); // violet→fuchsia family fits the theme
  return `linear-gradient(135deg, oklch(0.62 0.16 ${hue}), oklch(0.55 0.18 ${(hue + 40) % 360}))`;
}
