"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { prettyShortcut } from "@/lib/editor/utils";

/**
 * Keyboard shortcut cheat sheet (⌘/).
 */

interface ShortcutGroup {
  title: string;
  items: { keys: string; label: string }[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: "Formatting",
    items: [
      { keys: prettyShortcut("Mod-B"), label: "Bold" },
      { keys: prettyShortcut("Mod-I"), label: "Italic" },
      { keys: prettyShortcut("Mod-U"), label: "Underline" },
      { keys: prettyShortcut("Mod-Shift-S"), label: "Strikethrough" },
      { keys: prettyShortcut("Mod-E"), label: "Inline code" },
      { keys: prettyShortcut("Mod-K"), label: "Insert link" },
      { keys: prettyShortcut("Mod-Shift-E"), label: "Code block" },
    ],
  },
  {
    title: "Blocks",
    items: [
      { keys: prettyShortcut("Mod-Alt-1") + "…" + prettyShortcut("Mod-Alt-6"), label: "Headings 1–6" },
      { keys: prettyShortcut("Mod-Shift-7"), label: "Numbered list" },
      { keys: prettyShortcut("Mod-Shift-8"), label: "Bulleted list" },
      { keys: prettyShortcut("Mod-Shift-9"), label: "To-do list" },
      { keys: prettyShortcut("Mod-Shift-B"), label: "Quote" },
      { keys: prettyShortcut("Tab") + " / " + prettyShortcut("Shift-Tab"), label: "Indent / outdent list item" },
    ],
  },
  {
    title: "Editing",
    items: [
      { keys: prettyShortcut("Mod-Z"), label: "Undo" },
      { keys: prettyShortcut("Mod-Shift-Z"), label: "Redo" },
      { keys: prettyShortcut("Mod-D"), label: "Duplicate block" },
      { keys: prettyShortcut("Alt-ArrowUp") + " / " + prettyShortcut("Alt-ArrowDown"), label: "Move block up / down" },
      { keys: prettyShortcut("Enter"), label: "New block" },
      { keys: prettyShortcut("Shift-Enter"), label: "Line break within block" },
      { keys: prettyShortcut("Mod-Enter"), label: "Exit code block" },
    ],
  },
  {
    title: "Navigation & tools",
    items: [
      { keys: "/", label: "Open command menu" },
      { keys: prettyShortcut("Mod-F"), label: "Search & replace" },
      { keys: prettyShortcut("Mod-/"), label: "This cheat sheet" },
      { keys: prettyShortcut("Esc"), label: "Dismiss menus / deselect" },
    ],
  },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto rounded-2xl border-border/80 bg-popover/95 backdrop-blur-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Everything is reachable without a mouse — except where a mouse is just faster.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 pb-1 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {group.title}
              </h3>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-3 text-[12.5px]">
                    <span className="text-foreground/85">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.split(" / ").map((k, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <span className="text-[10px] text-muted-foreground">/</span>}
                          <span className="kbd">{k}</span>
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
