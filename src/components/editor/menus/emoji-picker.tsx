"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Lightweight emoji palette (no external dataset — instant load).
 * Used by the slash menu and callout blocks.
 */

export interface EmojiGroup {
  label: string;
  emojis: string[];
}

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    label: "Smileys",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😉", "😊", "😍", "🤩", "😘", "😗", "😎", "🤓", "🧐", "🤔", "🤗", "😴", "🥱", "😭", "😱", "😤", "🤯", "🥳", "😇", "🤠", "🤡", "👻", "🤖"],
  },
  {
    label: "Gestures & people",
    emojis: ["👋", "🤚", "✋", "👌", "🤌", "✌️", "🤞", "🤟", "🤘", "👈", "👉", "👆", "👇", "👍", "👎", "✊", "👏", "🙌", "🤝", "🙏", "💪", "🧠", "👀", "🫶"],
  },
  {
    label: "Objects",
    emojis: ["💡", "📌", "📎", "📝", "✏️", "📚", "🔖", "🎯", "🚀", "🔥", "⭐", "✨", "💎", "🏆", "🎁", "🔔", "🔑", "🛠️", "⚙️", "🧩", "💬", "📊", "🗂️", "📅"],
  },
  {
    label: "Nature",
    emojis: ["🌱", "🌳", "🌸", "🍀", "🌈", "☀️", "🌙", "⛅", "❄️", "🌊", "🐙", "🦋", "🐝", "🐞", "🐢", "🦊", "🐧", "🦉"],
  },
  {
    label: "Symbols",
    emojis: ["✅", "☑️", "❌", "⚠️", "🚫", "❓", "❗", "➕", "➖", "♻️", "🔒", "🔗", "💯", "🆗", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣"],
  },
];

export function EmojiPicker({
  anchorRect,
  onPick,
  onClose,
}: {
  anchorRect: DOMRect | null;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const width = 312;
  const height = 348;
  let style: React.CSSProperties;
  if (!anchorRect) {
    style = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  } else {
    const left = Math.min(Math.max(12, anchorRect.left), window.innerWidth - width - 12);
    const flip = anchorRect.bottom + height + 12 > window.innerHeight;
    style = flip
      ? { left, bottom: window.innerHeight - anchorRect.top + 10 }
      : { left, top: anchorRect.bottom + 10 };
  }

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.16, ease: [0.2, 0.8, 0.3, 1] }}
      style={{ width, ...style }}
      className="fixed z-[100] rounded-xl border border-border bg-popover p-3 shadow-2xl shadow-black/50"
      role="dialog"
      aria-label="Emoji picker"
    >
      <div className="max-h-[300px] overflow-y-auto pr-1">
        {EMOJI_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-1 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </div>
            <div className={cn("grid grid-cols-8 gap-0.5")}>
              {group.emojis.map((emoji) => (
                <button
                  key={`${group.label}-${emoji}`}
                  type="button"
                  className="flex h-9 items-center justify-center rounded-md text-lg transition-transform duration-100 hover:scale-110 hover:bg-muted"
                  onClick={() => onPick(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>,
    document.body,
  );
}
