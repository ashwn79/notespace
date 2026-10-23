"use client";

import * as React from "react";
import type { Editor } from "@tiptap/core";
import { Check, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Text color & highlight swatches.
 * Rendered inline by the floating toolbar (no popover positioning layer),
 * and reusable anywhere a compact picker is needed.
 */

export const TEXT_COLORS = [
  { label: "Default", value: null },
  { label: "Gray", value: "#a1a1aa" },
  { label: "Red", value: "#f87171" },
  { label: "Orange", value: "#fb923c" },
  { label: "Yellow", value: "#facc15" },
  { label: "Green", value: "#4ade80" },
  { label: "Teal", value: "#2dd4bf" },
  { label: "Blue", value: "#60a5fa" },
  { label: "Purple", value: "#c084fc" },
  { label: "Pink", value: "#f472b6" },
];

export const HIGHLIGHT_COLORS = [
  { label: "None", value: null },
  { label: "Yellow", value: "rgba(250, 204, 21, 0.38)" },
  { label: "Green", value: "rgba(74, 222, 128, 0.35)" },
  { label: "Blue", value: "rgba(96, 165, 250, 0.35)" },
  { label: "Pink", value: "rgba(244, 114, 182, 0.35)" },
  { label: "Purple", value: "rgba(167, 139, 250, 0.38)" },
  { label: "Orange", value: "rgba(251, 146, 60, 0.35)" },
];

export function ColorPanel({
  editor,
  mode,
  onClose,
}: {
  editor: Editor;
  mode: "text" | "background";
  onClose: () => void;
}) {
  const [, force] = React.useState(0);
  React.useEffect(() => {
    const handler = () => force((t) => t + 1);
    editor.on("transaction", handler);
    return () => editor.off("transaction", handler);
  }, [editor]);

  const activeColor =
    mode === "text"
      ? ((editor.getAttributes("textStyle").color as string | undefined) ?? null)
      : ((editor.getAttributes("highlight").color as string | undefined) ?? null);

  const apply = (value: string | null) => {
    if (mode === "text") {
      if (value) editor.chain().focus().setColor(value).run();
      else editor.chain().focus().unsetColor().run();
    } else if (value) {
      editor.chain().focus().setHighlight({ color: value }).run();
    } else {
      editor.chain().focus().unsetHighlight().run();
    }
  };

  const colors = mode === "text" ? TEXT_COLORS : HIGHLIGHT_COLORS;
  const title = mode === "text" ? "Text color" : "Highlight";

  return (
    <div className="w-60 rounded-xl border border-border/80 bg-popover/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{title}</span>
        <button
          type="button"
          className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => {
            if (mode === "text") editor.chain().focus().unsetColor().run();
            else editor.chain().focus().unsetHighlight().run();
          }}
        >
          <Eraser size={11} /> Reset
        </button>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {colors.map((color) => {
          const active = color.value === activeColor || (color.value === null && !activeColor);
          return (
            <button
              key={color.label}
              type="button"
              title={color.label}
              aria-label={`${title}: ${color.label}`}
              aria-pressed={active}
              onClick={() => apply(color.value)}
              onMouseDown={(e) => e.preventDefault()}
              className={cn(
                "relative flex h-8 w-8 items-center justify-center rounded-lg border border-transparent transition-transform duration-100 hover:scale-105",
                active ? "border-primary/60 bg-primary/10" : "hover:bg-muted",
              )}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-md border border-border/70 text-[10px] font-bold"
                style={
                  color.value
                    ? { background: color.value, color: "#111827" }
                    : { background: "var(--muted)", color: "var(--foreground)" }
                }
              >
                A
              </span>
              {active && (
                <span className="absolute -right-0.5 -top-0.5">
                  <Check size={10} className="text-primary" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 w-full rounded-md py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        Done
      </button>
    </div>
  );
}
