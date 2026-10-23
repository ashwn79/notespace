import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { CalloutVariant } from "@/lib/editor/types";
import { CalloutView } from "../nodes/callout-view";

/**
 * Callout block — a tinted container with a clickable emoji.
 * Content is fully editable blocks, so lists/headings work inside callouts.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { emoji?: string; variant?: CalloutVariant }) => ReturnType;
      updateCallout: (attrs: { emoji?: string; variant?: CalloutVariant }) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      emoji: {
        default: "💡",
        parseHTML: (element) => element.getAttribute("data-emoji") ?? "💡",
      },
      variant: {
        default: "info" as CalloutVariant,
        parseHTML: (element) => (element.getAttribute("data-variant") as CalloutVariant) ?? "info",
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-callout": "",
        class: `callout callout-${node.attrs.variant}`,
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) =>
          commands.wrapIn(this.name, { emoji: "💡", variant: "info", ...attrs }),
      updateCallout:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),
    };
  },
});
