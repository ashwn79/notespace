"use client";

import * as React from "react";
import { CalendarDays, UserRoundPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Host dialogs for the "@" menu — custom date picker and person input.
 * They resolve through the AtActionHelpers callbacks.
 */

function toIso(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export function DatePickDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (iso: string) => void;
}) {
  const [value, setValue] = React.useState(() => toIso(new Date()));

  const submit = (iso: string) => {
    if (!iso) return;
    onPick(iso);
    onOpenChange(false);
  };

  const quick: { label: string; offset: number }[] = [
    { label: "Today", offset: 0 },
    { label: "Tomorrow", offset: 1 },
    { label: "Yesterday", offset: -1 },
    { label: "Next week", offset: 7 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-border/80 bg-popover/95 backdrop-blur-xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarDays size={16} className="text-primary" /> Pick a date
          </DialogTitle>
          <DialogDescription className="text-xs">
            A date mention will be inserted at the caret.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(value);
          }}
          className="space-y-3"
        >
          <input
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            aria-label="Date"
            className="h-10 w-full rounded-lg border border-border bg-muted/40 px-3 text-[13.5px] outline-none transition-colors focus:border-primary/50"
          />
          <div className="flex flex-wrap gap-1.5">
            {quick.map((q) => {
              const d = new Date();
              d.setDate(d.getDate() + q.offset);
              return (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setValue(toIso(d))}
                  className={cn(
                    "rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
                    value === toIso(d) && "border-primary/50 bg-primary/10 text-primary",
                  )}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-8 rounded-lg px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8 rounded-lg bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Insert date
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PersonDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = React.useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setName("");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setName("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="rounded-2xl border-border/80 bg-popover/95 backdrop-blur-xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserRoundPlus size={16} className="text-primary" /> Mention a person
          </DialogTitle>
          <DialogDescription className="text-xs">
            People you mention appear in the @ menu next time.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-3"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Person's name…"
            autoFocus
            aria-label="Person name"
            className="h-10 w-full rounded-lg border border-border bg-muted/40 px-3 text-[13.5px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-8 rounded-lg px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="h-8 rounded-lg bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Insert mention
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
