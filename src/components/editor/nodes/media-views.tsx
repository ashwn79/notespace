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
  Trash2,
} from "lucide-react";
import { formatBytes } from "@/lib/editor/utils";

/**
 * Video, file attachment and embed node views.
 * Each has a compact hover toolbar (delete / open) outside the editable flow.
 */

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

export function VideoView({ node, deleteNode }: NodeViewProps) {
  const { src, name } = node.attrs as { src: string; name: string };
  return (
    <NodeViewWrapper className="video-block group">
      <video src={src} controls preload="metadata" />
      <HoverActions>
        <ActionButton title={name || "Video"} href={src} download={name}>
          <Download size={14} />
        </ActionButton>
        <ActionButton title="Delete video" onClick={deleteNode} danger>
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

export function FileView({ node, deleteNode }: NodeViewProps) {
  const { src, name, size, type } = node.attrs as {
    src: string;
    name: string;
    size: number;
    type: string;
  };
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
          <ActionButton title="Delete attachment" onClick={deleteNode} danger>
            <Trash2 size={14} />
          </ActionButton>
        </div>
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
