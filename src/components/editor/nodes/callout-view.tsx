"use client";

import * as React from "react";
import type { NodeViewProps } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalloutVariant } from "@/lib/editor/types";
import { EMOJI_GROUPS } from "../menus/emoji-picker";

/**
 * Callout node view — emoji button (opens a mini picker) + variant switcher.
 */

const VARIANTS: { value: CalloutVariant; label: string; swatch: string }[] = [
  { value: "info", label: "Info", swatch: "bg-violet-400/70" },
  { value: "success", label: "Success", swatch: "bg-emerald-400/70" },
  { value: "warning", label: "Warning", swatch: "bg-amber-400/70" },
  { value: "danger", label: "Danger", swatch: "bg-red-400/70" },
];

const QUICK_EMOJIS = ["💡", "📌", "⚠️", "🔥", "✅", "🚫", "❓", "📝", "🎯", "🚀", "🐙", "🧠"];

export function CalloutView({ node, updateAttributes }: NodeViewProps) {
  const { emoji, variant } = node.attrs as { emoji: string; variant: CalloutVariant };
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const pickerRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click.
  React.useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [pickerOpen]);

  return (
    <NodeViewWrapper className={cn("callout", `callout-${variant}`)} data-callout>
      <div className="relative" contentEditable={false}>
        <button
          type="button"
          className="callout-emoji"
          aria-label="Change callout emoji"
          onClick={() => setPickerOpen((v) => !v)}
          onMouseDown={(e) => e.preventDefault()}
        >
          {emoji}
        </button>

        {pickerOpen && (
          <div
            ref={pickerRef}
            className="absolute left-0 top-9 z-50 w-64 rounded-xl border border-border bg-popover p-2.5 shadow-2xl shadow-black/40 animate-pop-in"
          >
            <div className="grid grid-cols-6 gap-0.5">
              {QUICK_EMOJIS.map((e) => (
                <button
                  key={`quick-${e}`}
                  type="button"
                  className="flex h-9 items-center justify-center rounded-md text-lg transition-colors hover:bg-muted"
                  onClick={() => {
                    updateAttributes({ emoji: e });
                    setPickerOpen(false);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="mt-1.5 max-h-44 overflow-y-auto pr-1">
              {EMOJI_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="px-1 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </div>
                  <div className="grid grid-cols-6 gap-0.5">
                    {group.emojis.map((e) => (
                      <button
                        key={`${group.label}-${e}`}
                        type="button"
                        className="flex h-8 items-center justify-center rounded-md text-base transition-colors hover:bg-muted"
                        onClick={() => {
                          updateAttributes({ emoji: e });
                          setPickerOpen(false);
                        }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5 border-t border-border/60 pt-2">
              {VARIANTS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  title={v.label}
                  onClick={() => updateAttributes({ variant: v.value })}
                  className={cn(
                    "flex h-7 flex-1 items-center justify-center gap-1 rounded-md text-[11px] text-muted-foreground transition-colors hover:bg-muted",
                    variant === v.value && "bg-muted text-foreground",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", v.swatch)} />
                  {variant === v.value && <Check size={11} />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <NodeViewContent className="min-w-0 flex-1" />
    </NodeViewWrapper>
  );
}

// Re-export for the slash menu "callout" description icon usage elsewhere.
export const CalloutVariantIcon = ChevronRight;
