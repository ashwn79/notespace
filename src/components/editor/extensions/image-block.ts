import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { MediaAlign } from "@/lib/editor/types";
import { ImageView } from "../nodes/image-view";

/**
 * Notion-style image block: block-level figure with caption, resize
 * percentage, alignment and lazy loading.
 *
 * The `upload*` attributes drive the optimistic upload state — the node
 * appears instantly with a local Blob URL while the real upload runs.
 */

export const uploadStateAttrs = {
  uploadId: {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute("data-upload-id"),
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes.uploadId ? { "data-upload-id": String(attributes.uploadId) } : {},
  },
  uploading: {
    default: false,
    parseHTML: (element: HTMLElement) => element.getAttribute("data-uploading") === "true",
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes.uploading ? { "data-uploading": "true" } : {},
  },
  progress: {
    default: 0,
    parseHTML: (element: HTMLElement) => Number(element.getAttribute("data-progress") ?? 0),
    renderHTML: () => ({}), // transient — progress lives in the overlay only
  },
  uploadError: {
    default: false,
    parseHTML: (element: HTMLElement) => element.getAttribute("data-upload-error") === "true",
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes.uploadError ? { "data-upload-error": "true" } : {},
  },
};

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
      ...uploadStateAttrs,
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
