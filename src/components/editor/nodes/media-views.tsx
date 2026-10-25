"use client";

import * as React from "react";
import type { NodeViewProps } from "@tiptap/core";
import { NodeViewWrapper } from "@tiptap/react";
import {
  Archive,
  Download,
  ExternalLink,
  File as FileIcon,
  FileCode,
  FileJson,
  FileText,
  RotateCw,
  Trash2,
} from "lucide-react";
import { formatBytes } from "@/lib/editor/utils";
import { retryUploadForNode, abortUpload } from "@/lib/editor/upload-manager";
import type { Editor } from "@tiptap/core";

/**
 * Video, audio, file attachment and embed node views.
 * Each carries a compact hover toolbar and — while an optimistic upload
 * is in flight — a non-blocking progress overlay (plus retry on failure).
 * The local Blob preview stays fully interactive during upload.
 */

interface UploadAttrs {
  uploadId?: string | null;
  uploading?: boolean;
  progress?: number;
  uploadError?: boolean;
  name?: string;
}

export function UploadOverlay({ editor, attrs, label }: { editor: Editor; attrs: UploadAttrs; label?: string }) {
  if (!attrs.uploading && !attrs.uploadError) return null;
  return <UploadOverlayInner editor={editor} attrs={attrs} label={label} />;
}

function UploadOverlayInner({
  editor,
  attrs,
  label,
}: {
  editor: Editor;
  attrs: UploadAttrs;
  label?: string;
}) {
  if (attrs.uploading) {
    return (
      <div contentEditable={false} className="upload-overlay" aria-live="polite">
        <div className="upload-overlay-card">
          <div className="flex items-center justify-between gap-3 text-[11.5px] font-medium">
            <span className="truncate">{label ?? "Uploading…"}</span>
            <span className="tabular-nums text-muted-foreground">{attrs.progress ?? 0}%</span>
          </div>
          <div className="upload-progress-track">
            <div className="upload-progress-fill" style={{ width: `${attrs.progress ?? 0}%` }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div contentEditable={false} className="upload-overlay" role="alert">
      <div className="upload-overlay-card">
        <div className="text-[11.5px] font-medium text-red-300">Upload failed</div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => attrs.uploadId && retryUploadForNode(editor, attrs.uploadId)}
            className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/20"
          >
            <RotateCw size={11} /> Retry
          </button>
          <button
            type="button"
            onClick={() => deleteUploadNode(editor, attrs.uploadId)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-white/10"
          >
            <Trash2 size={11} /> Remove
          </button>
        </div>
      </div>
    </div>
  );
}

/** Remove a media node by its upload id (used by the error overlay). */
function deleteUploadNode(editor: Editor, uploadId?: string | null) {
  if (!uploadId) return;
  abortUpload(uploadId);
  const { state } = editor;
  let target: { pos: number; size: number } | null = null;
  state.doc.descendants((node, pos) => {
    if (!target && node.attrs.uploadId === uploadId) {
      target = { pos, size: node.nodeSize };
      return false;
    }
    return true;
  });
  if (target) {
    const { pos, size } = target;
    editor.view.dispatch(state.tr.delete(pos, pos + size));
  }
}

/** Delete a media node while its upload may still be running. */
export function deleteMediaNode(deleteNode: () => void, attrs: UploadAttrs) {
  if (attrs.uploadId) abortUpload(attrs.uploadId);
  deleteNode();
}

function HoverActions({ children }: { children: React.ReactNode }) {
  return (
    <div
      contentEditable={false}
      className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-lg border border-white/10 bg-black/55 p-1 opacity-0 shadow-lg backdrop-blur-md transition-opacity duration-150 group-hover:opacity-100"
    >
      {children}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  title,
  href,
  download,
  danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title: string;
  href?: string;
  download?: string;
  danger?: boolean;
}) {
  const className = `flex h-7 w-7 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/15 hover:text-white ${
    danger ? "hover:bg-red-500/20 hover:text-red-300" : ""
  }`;
  if (href) {
    return (
      <a className={className} title={title} href={href} download={download} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={className} title={title} onClick={onClick}>
      {children}
    </button>
  );
}

export function VideoView({ node, deleteNode, editor }: NodeViewProps) {
  const { src, name } = node.attrs as { src: string; name: string };
  const attrs = node.attrs as UploadAttrs;
  return (
    <NodeViewWrapper className="video-block group">
      <video src={src} controls preload="metadata" />
      <UploadOverlay editor={editor} attrs={attrs} label={name || "Uploading video…"} />
      <HoverActions>
        <ActionButton title={name || "Video"} href={src} download={name}>
          <Download size={14} />
        </ActionButton>
        <ActionButton title="Delete video" onClick={() => deleteMediaNode(deleteNode, attrs)} danger>
          <Trash2 size={14} />
        </ActionButton>
      </HoverActions>
    </NodeViewWrapper>
  );
}

export function AudioView({ node, deleteNode, editor }: NodeViewProps) {
  const { src, name } = node.attrs as { src: string; name: string };
  const attrs = node.attrs as UploadAttrs;
  return (
    <NodeViewWrapper className="audio-block group">
      <div className="audio-block-inner">
        <audio src={src} controls preload="metadata" className="min-w-0 flex-1" />
      </div>
      <UploadOverlay editor={editor} attrs={attrs} label={name || "Uploading audio…"} />
      <HoverActions>
        <ActionButton title={name || "Audio"} href={src} download={name}>
          <Download size={14} />
        </ActionButton>
        <ActionButton title="Delete audio" onClick={() => deleteMediaNode(deleteNode, attrs)} danger>
          <Trash2 size={14} />
        </ActionButton>
      </HoverActions>
    </NodeViewWrapper>
  );
}

/** Returns pre-rendered icon JSX so no component identity is created per render. */
function renderFileIcon(type: string) {
  if (type.includes("pdf")) return <FileText size={19} strokeWidth={1.7} />;
  if (type.includes("zip") || type.includes("compressed")) return <Archive size={19} strokeWidth={1.7} />;
  if (type.includes("json")) return <FileJson size={19} strokeWidth={1.7} />;
  if (type.startsWith("text/") || type.includes("javascript")) return <FileCode size={19} strokeWidth={1.7} />;
  return <FileIcon size={19} strokeWidth={1.7} />;
}

export function FileView({ node, deleteNode, editor }: NodeViewProps) {
  const { src, name, size, type } = node.attrs as {
    src: string;
    name: string;
    size: number;
    type: string;
  };
  const attrs = node.attrs as UploadAttrs;
  return (
    <NodeViewWrapper className="group w-fit">
      <div className="file-block">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
          {renderFileIcon(type ?? "")}
        </span>
        <a href={src} download={name} className="flex min-w-0 flex-1 flex-col gap-0.5" draggable={false}>
          <span className="truncate text-[13.5px] font-medium">{name}</span>
          <span className="text-xs text-muted-foreground">{size ? formatBytes(size) : type}</span>
        </a>
        <div
          contentEditable={false}
          className="ml-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <ActionButton title="Download" href={src} download={name}>
            <Download size={14} />
          </ActionButton>
          <ActionButton title="Delete attachment" onClick={() => deleteMediaNode(deleteNode, attrs)} danger>
            <Trash2 size={14} />
          </ActionButton>
        </div>
        <UploadOverlay editor={editor} attrs={attrs} label={name} />
      </div>
    </NodeViewWrapper>
  );
}

export function EmbedView({ node, deleteNode }: NodeViewProps) {
  const { src } = node.attrs as { src: string };
  return (
    <NodeViewWrapper className="embed-block group">
      <iframe src={src} title="Embedded content" loading="lazy" />
      <HoverActions>
        <ActionButton title="Open original" href={src}>
          <ExternalLink size={14} />
        </ActionButton>
        <ActionButton title="Delete embed" onClick={deleteNode} danger>
          <Trash2 size={14} />
        </ActionButton>
      </HoverActions>
    </NodeViewWrapper>
  );
}
