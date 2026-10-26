import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { MediaPlaceholderView } from "../nodes/media-placeholder-view";

/**
 * Notion-style media placeholder — what /image, /video and /file insert.
 * An empty shell block with upload / drag&drop / URL / clipboard options
 * that commits itself into a real media block once content is provided.
 */

export type MediaKind = "image" | "video" | "audio" | "file";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mediaPlaceholder: {
      insertMediaPlaceholder: (kind: MediaKind) => ReturnType;
    };
  }
}

export function isMediaKind(value: unknown): value is MediaKind {
  return value === "image" || value === "video" || value === "audio" || value === "file";
}

interface MediaPayload {
  url: string;
  name: string;
  size: number;
  type: string;
}

/** Guess a mime type from a URL's extension (used for URL-based files). */
export function guessTypeFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const ext = pathname.slice(pathname.lastIndexOf(".") + 1);
    const map: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
      webp: "image/webp", svg: "image/svg+xml", avif: "image/avif",
      mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", avi: "video/x-msvideo",
      mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
      pdf: "application/pdf", zip: "application/zip",
      json: "application/json", txt: "text/plain", csv: "text/csv",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    return map[ext] ?? "application/octet-stream";
  } catch {
    return "application/octet-stream";
  }
}

/** Build the real media node JSON for a committed payload. */
export function mediaNodeFor(kind: MediaKind, payload: MediaPayload): JSONContent {
  if (kind === "image") {
    return {
      type: "imageBlock",
      attrs: { src: payload.url, alt: payload.name, width: 100, align: "center" },
    };
  }
  if (kind === "video") {
    return { type: "videoBlock", attrs: { src: payload.url, name: payload.name } };
  }
  if (kind === "audio") {
    return { type: "audioBlock", attrs: { src: payload.url, name: payload.name } };
  }
  return {
    type: "fileBlock",
    attrs: { src: payload.url, name: payload.name, size: payload.size, type: payload.type },
  };
}

export const MediaPlaceholder = Node.create({
  name: "mediaPlaceholder",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      kind: { default: "image" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-media-placeholder]",
        getAttrs: (element) => {
          const kind = (element as HTMLElement).getAttribute("data-media-placeholder");
          return { kind: isMediaKind(kind) ? kind : "image" };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      "div",
      mergeAttributes({ "data-media-placeholder": node.attrs.kind }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MediaPlaceholderView);
  },

  addCommands() {
    return {
      insertMediaPlaceholder:
        (kind) =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs: { kind } }).run(),
    };
  },
});
