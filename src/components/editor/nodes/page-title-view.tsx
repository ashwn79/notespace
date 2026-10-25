"use client";

import * as React from "react";
import type { NodeViewProps } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "../menus/emoji-picker";

/**
 * Page title node view — a Notion-style emoji/icon picker floats above
 * the title. When no icon is set, the "Add icon" affordance appears on
 * hover; once set, the emoji button is always visible.
 */
export function PageTitleView({ node, updateAttributes }: NodeViewProps) {
  const icon = (node.attrs.icon as string | null) ?? "";
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const empty = node.content.size === 0;

  const openPicker = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setAnchorRect(new DOMRect(rect.left, rect.bottom, rect.width, 0));
    }
    setPickerOpen((v) => !v);
  };

  return (
    <NodeViewWrapper className="page-title-block" data-has-icon={icon ? "true" : undefined}>
      <div className="page-icon-row" contentEditable={false}>
        <button
          ref={buttonRef}
          type="button"
          aria-label={icon ? "Change page icon" : "Add page icon"}
          onClick={openPicker}
          className={cn("page-icon-btn", !icon && "page-icon-btn-empty")}
        >
          {icon ? <span className="text-[44px] leading-none">{icon}</span> : <ImagePlus size={22} strokeWidth={1.7} />}
        </button>
      </div>

      <NodeViewContent
        className={cn("page-title-content", empty && "is-empty")}
        data-placeholder="Untitled"
        data-page-title-content=""
      />

      {pickerOpen && anchorRect && (
        <EmojiPicker
          anchorRect={anchorRect}
          onPick={(emoji) => {
            updateAttributes({ icon: emoji });
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </NodeViewWrapper>
  );
}
