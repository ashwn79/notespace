"use client";

import type { NodeViewProps } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { ChevronRight } from "lucide-react";

/**
 * Toggle block node view. Collapse/expand is driven purely by the `open`
 * attribute + CSS (sibling selector hides everything after the header),
 * so ProseMirror never loses track of hidden content.
 */
export function ToggleView({ node, updateAttributes }: NodeViewProps) {
  const open = node.attrs.open !== false;
  return (
    <NodeViewWrapper className="toggle-block" data-open={String(open)}>
      <button
        type="button"
        className="toggle-chevron-btn"
        contentEditable={false}
        aria-label={open ? "Collapse toggle" : "Expand toggle"}
        aria-expanded={open}
        onClick={() => updateAttributes({ open: !open })}
        onMouseDown={(e) => e.preventDefault()}
      >
        <ChevronRight size={15} strokeWidth={2.2} />
      </button>
      <NodeViewContent className="toggle-content" />
    </NodeViewWrapper>
  );
}
