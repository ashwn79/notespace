import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { EmbedView, FileView, VideoView } from "../nodes/media-views";

/**
 * Media blocks — uploaded videos, file attachments and URL embeds.
 * All are draggable atoms so the block handle can move them around.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    media: {
      insertVideo: (attrs: { src: string; name?: string }) => ReturnType;
      insertFile: (attrs: { src: string; name: string; size: number; type: string }) => ReturnType;
      insertEmbed: (src: string) => ReturnType;
    };
  }
}

export const VideoBlock = Node.create({
  name: "videoBlock",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      name: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "video[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["video", mergeAttributes(HTMLAttributes, { controls: "", preload: "metadata" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoView);
  },

  addCommands() {
    return {
      insertVideo:
        (attrs) =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs }).run(),
    };
  },
});

export const FileBlock = Node.create({
  name: "fileBlock",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      name: { default: "file" },
      size: { default: 0 },
      type: { default: "application/octet-stream" },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-file-block]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-file-block": "",
        href: node.attrs.src,
        download: node.attrs.name,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileView);
  },

  addCommands() {
    return {
      insertFile:
        (attrs) =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs }).run(),
    };
  },
});

export const Embed = Node.create({
  name: "embed",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "iframe[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "iframe",
      mergeAttributes(HTMLAttributes, {
        allowfullscreen: "",
        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
        sandbox: "allow-scripts allow-same-origin allow-presentation",
        referrerpolicy: "no-referrer",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedView);
  },

  addCommands() {
    return {
      insertEmbed:
        (src) =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs: { src } }).run(),
    };
  },
});

/** Normalize common share URLs (YouTube, Vimeo, Loom) into clean embed URLs. */
export function normalizeEmbedUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (!/^https?:$/.test(url.protocol)) return null;

    // YouTube
    if (url.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${url.pathname}`;
    }
    if (url.hostname.includes("youtube.com") && url.pathname.startsWith("/watch")) {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (url.hostname.includes("youtube.com") && url.pathname.startsWith("/shorts/")) {
      return `https://www.youtube.com/embed${url.pathname.replace("/shorts", "")}`;
    }
    // Vimeo
    if (url.hostname.includes("vimeo.com")) {
      return `https://player.vimeo.com/video${url.pathname}`;
    }
    // Loom
    if (url.hostname.includes("loom.com") && url.pathname.includes("/share/")) {
      return raw.replace("/share/", "/embed/");
    }
    // Only allow http(s) iframes for anything else
    return url.toString();
  } catch {
    return null;
  }
}
