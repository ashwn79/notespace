import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { MediaAlign } from "@/lib/editor/types";
import { ImageView } from "../nodes/image-view";

/**
 * Notion-style image block: block-level figure with caption, resize
 * percentage, alignment and lazy loading.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageBlock: {
      setImageBlock: (attrs: { src: string; alt?: string; width?: number; align?: MediaAlign }) => ReturnType;
    };
  }
}

export const ImageBlock = Node.create({
  name: "imageBlock",
  group: "block",
  draggable: true,
  selectable: true,
  content: "inline*",

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      width: { default: 100 },
      align: { default: "center" as MediaAlign },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-image-block]" }, { tag: "img[src]" }];
  },

  renderHTML({ node }) {
    return [
      "figure",
      mergeAttributes({ "data-image-block": "", "data-align": node.attrs.align }),
      ["img", { src: node.attrs.src, alt: node.attrs.alt ?? "", draggable: false }],
      ["figcaption", 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },

  addCommands() {
    return {
      setImageBlock:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { width: 100, align: "center", alt: "", ...attrs },
            })
            .run(),
    };
  },
});
