"use client";

import * as React from "react";
import type { Editor } from "@tiptap/core";
import { ExternalLink, Link2, Trash2 } from "lucide-react";

/**
 * Inline link editor panel — add, edit, open or remove links on the selection.
 * Rendered inline by the floating toolbar.
 */
export function LinkPanel({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const existing = (editor.getAttributes("link").href as string | undefined) ?? "";
  const [value, setValue] = React.useState(existing);

  const apply = () => {
    let url = value.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onClose();
      return;
    }
    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
      url = `https://${url}`;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url, target: "_blank" }).run();
    onClose();
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onClose();
  };

  return (
    <div
      className="w-80 rounded-xl border border-border/80 bg-popover/95 p-2.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
      data-link-input
    >
      <div className="flex items-center gap-2">
        <Link2 size={14} className="shrink-0 text-muted-foreground" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
            e.stopPropagation();
          }}
          placeholder="Paste or type a link…"
          autoFocus
          className="h-8 w-full rounded-md border border-border bg-muted/40 px-2.5 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
        />
      </div>
      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          onClick={apply}
          className="h-7 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Apply
        </button>
        {existing ? (
          <>
            <a
              href={existing}
              target="_blank"
              rel="noreferrer"
              className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ExternalLink size={11} /> Open
            </a>
            <button
              type="button"
              onClick={remove}
              className="ml-auto flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 size={11} /> Remove
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
