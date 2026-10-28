"use client";

import * as React from "react";
import type { NodeViewProps } from "@tiptap/core";
import { NodeViewWrapper } from "@tiptap/react";
import {
  FileText,
  ImagePlus,
  Link2,
  MonitorPlay,
  Music4,
  Upload,
  X,
} from "lucide-react";
import { insertOptimisticMedia } from "../core/optimistic-media";
import { guessTypeFromUrl, isMediaKind, mediaNodeFor, type MediaKind } from "../extensions/media-placeholder";

/**
 * Media placeholder node view — Notion-style shell with:
 *  · Upload from computer (per-block file input)
 *  · Drag & drop onto the card
 *  · Paste a URL (inline form)
 *  · Paste from clipboard (handled by the global paste handler which
 *    replaces the selected placeholder — see editor-page)
 */

const META: Record<
  MediaKind,
  { title: string; hint: string; accept: string; Icon: React.ComponentType<{ size?: number }> }
> = {
  image: {
    title: "Add an image",
    hint: "Upload, drop a file, or paste an image link.",
    accept: "image/*",
    Icon: ImagePlus,
  },
  video: {
    title: "Add a video",
    hint: "Upload, drop a file, or paste a video link.",
    accept: "video/*",
    Icon: MonitorPlay,
  },
  audio: {
    title: "Add audio",
    hint: "Upload, drop a file, or paste an audio link.",
    accept: "audio/*",
    Icon: Music4,
  },
  file: {
    title: "Attach a file",
    hint: "Upload or drop any file — it stays downloadable.",
    accept: "*/*",
    Icon: FileText,
  },
};

export function MediaPlaceholderView({ node, editor, getPos }: NodeViewProps) {
  const rawKind = node.attrs.kind;
  const kind: MediaKind = isMediaKind(rawKind) ? rawKind : "image";
  const meta = META[kind];

  const [mode, setMode] = React.useState<"idle" | "url">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const urlInputRef = React.useRef<HTMLInputElement>(null);

  /** Replace this placeholder node with the real media block. */
  const commit = React.useCallback(
    (payload: { url: string; name: string; size: number; type: string }) => {
      const pos = typeof getPos === "function" ? getPos() : undefined;
      if (typeof pos !== "number" || editor.isDestroyed) return;
      editor
        .chain()
        .focus()
        .insertContentAt({ from: pos, to: pos + node.nodeSize }, mediaNodeFor(kind, payload))
        .run();
    },
    [editor, getPos, kind, node.nodeSize],
  );

  /**
   * Upload from the placeholder card is optimistic too: the real media block
   * renders instantly from a Blob URL (with progress + retry handled by the
   * upload manager) and this placeholder is replaced in the same transaction.
   */
  const upload = React.useCallback(
    (file: File) => {
      const pos = typeof getPos === "function" ? getPos() : undefined;
      const id = insertOptimisticMedia(editor, file, {
        replacePos: typeof pos === "number" ? pos : undefined,
      });
      if (id === null) {
        setError("Couldn't insert the file");
      }
    },
    [editor, getPos],
  );

  const submitUrl = React.useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(normalized);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad protocol");
      const name = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() ?? "")
        || parsed.hostname;
      commit({
        url: parsed.toString(),
        name,
        size: 0,
        type:
          kind === "image"
            ? "image/remote"
            : kind === "video"
              ? "video/remote"
              : kind === "audio"
                ? "audio/remote"
                : guessTypeFromUrl(normalized),
      });
    } catch {
      setError("That doesn't look like a valid URL");
    }
  }, [url, kind, commit]);

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (!files.length) return;
    upload(files[0]);
  };

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.types?.includes("Files")) {
      setDragOver(true);
    }
  };

  const onDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  };

  const Icon = meta.Icon;

  return (
    <NodeViewWrapper className="media-placeholder" data-selected={undefined}>
      <div
        contentEditable={false}
        className={`media-placeholder-card${dragOver ? " is-dragover" : ""}${error ? " is-error" : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        data-media-placeholder-ui
      >
        <div className="media-placeholder-title">
          <span className="mp-icon">
            <Icon size={17} />
          </span>
          <span>{meta.title}</span>
          {mode === "url" && (
            <button
              type="button"
              title="Cancel"
              aria-label="Cancel link input"
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => {
                setMode("idle");
                setUrl("");
                setError(null);
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {mode === "idle" && (
          <>
            <div className="media-placeholder-sub">{meta.hint}</div>
            <div className="media-placeholder-actions">
              <button
                type="button"
                className="mp-btn"
                onClick={() => inputRef.current?.click()}
              >
                <Upload size={13} /> Upload from computer
              </button>
              <button
                type="button"
                className="mp-btn"
                onClick={() => {
                  setMode("url");
                  setError(null);
                  requestAnimationFrame(() => urlInputRef.current?.focus());
                }}
              >
                <Link2 size={13} /> Paste a URL
              </button>
              <span className="hidden items-center text-[11.5px] text-muted-foreground sm:flex">
                Drag &amp; drop or paste from clipboard works too
              </span>
            </div>
          </>
        )}

        {mode === "url" && (
          <form
            className="mp-url-row"
            onSubmit={(e) => {
              e.preventDefault();
              submitUrl();
            }}
          >
            <input
              ref={urlInputRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={
                kind === "image"
                  ? "https://example.com/photo.png"
                  : kind === "video"
                    ? "https://example.com/video.mp4"
                    : "https://example.com/report.pdf"
              }
              aria-label="Media URL"
            />
            <button type="submit" className="mp-btn">
              Embed {kind === "file" ? "file" : kind}
            </button>
          </form>
        )}

        {error && <div className="mp-error">{error}</div>}

        <input
          ref={inputRef}
          type="file"
          accept={meta.accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
      </div>
    </NodeViewWrapper>
  );
}
