"use client";

import * as React from "react";
import type { Editor } from "@tiptap/core";
import { JSONContent } from "@tiptap/core";
import { useEditor, useEditorState, EditorContent } from "@tiptap/react";
import {
  Keyboard,
  Moon,
  Plus,
  Redo2,
  Search,
  Sun,
  Undo2,
  Presentation,
  Globe,
} from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { NotespaceWordmark } from "@/components/brand/notespace-logo";
import { fetchDocument } from "@/lib/editor/api";
import type { SaveStatus } from "@/lib/editor/types";
import { DEMO_CONTENT } from "@/lib/editor/demo-content";
import { insertOptimisticMedia } from "@/lib/editor/upload-manager";

import { buildExtensions } from "./core/extensions";
import { SlashMenu } from "./menus/slash-menu";
import { MentionMenu } from "./menus/mention-menu";
import type { SlashActionHelpers } from "./extensions/slash-command";
import { FloatingToolbar } from "./menus/floating-toolbar";
import { ContextMenu, type ContextMenuState } from "./menus/context-menu";
import { BlockHandle } from "./menus/block-handle";
import { TableMenu } from "./menus/table-menu";
import { SearchPanel } from "./panels/search-panel";
import { ShortcutsDialog } from "./panels/shortcuts-dialog";
import { EmojiPicker } from "./menus/emoji-picker";
import { normalizeEmbedUrl } from "./extensions/media";
import { useAutosave } from "./hooks/use-autosave";
import { MobileLayer } from "./mobile/mobile-toolbar";

/**
 * EditorPage — the full application shell:
 * header (tools) · scrollable document surface (page title first) · status footer.
 */

type UploadKind = "image" | "video" | "audio" | "file";

/** The JSON shape a fresh document starts with (page title first). */
function emptyDocumentJSON(): JSONContent {
  return { type: "doc", content: [{ type: "pageTitle", content: [] }] };
}

export default function EditorPage() {
  const [ready, setReady] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [emojiAnchor, setEmojiAnchor] = React.useState<DOMRect | null>(null);
  const [embedOpen, setEmbedOpen] = React.useState(false);
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null);

  const contentRef = React.useRef<HTMLDivElement>(null);
  const mainRef = React.useRef<HTMLElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const uploadKindRef = React.useRef<UploadKind>("image");

  /* ------------------------------------------------ helpers (slash actions) */
  const requestUpload = React.useCallback((kind: UploadKind) => {
    uploadKindRef.current = kind;
    const input = fileInputRef.current;
    if (input) {
      input.accept =
        kind === "image"
          ? "image/*"
          : kind === "video"
            ? "video/*"
            : kind === "audio"
              ? "audio/*"
              : "*/*";
      input.click();
    }
  }, []);

  /* ------------------------------------------------ slash action helpers */
  const requestEmoji = React.useCallback((editorInstance: Editor) => {
    const coords = editorInstance.view.coordsAtPos(editorInstance.state.selection.to);
    setEmojiAnchor(new DOMRect(coords.left, coords.top, 0, 0));
  }, []);

  const requestEmbed = React.useCallback(() => setEmbedOpen(true), []);

  const requestMath = React.useCallback((editorInstance: Editor, inline: boolean) => {
    if (inline) editorInstance.chain().focus().insertMathInline("").run();
    else editorInstance.chain().focus().insertMathBlock("").run();
  }, []);

  // Stable across renders — safe to capture once inside useEditor options.
  const slashHelpers = React.useMemo<SlashActionHelpers>(
    () => ({ requestUpload, requestEmoji, requestEmbed, requestMath }),
    [requestUpload, requestEmoji, requestEmbed, requestMath],
  );

  // The editor instance lands in a ref *after* creation so paste/drop
  // handlers (created before the editor exists) can reach it safely.
  const editorRef = React.useRef<Editor | null>(null);

  /* ------------------------------------------------ editor instance */
  const editor = useEditor(
    {
      extensions: buildExtensions({ getActionContext: () => slashHelpers }),
      content: emptyDocumentJSON(),
      immediatelyRender: false,
      autofocus: false,
      editorProps: {
        attributes: {
          class: "tiptap",
          "aria-label": "Document editor",
          role: "textbox",
        },
        handlePaste: (_view, event) => {
          const files = Array.from(event.clipboardData?.files ?? []);
          const editorInstance = editorRef.current;
          if (!files.length || !editorInstance) return false;
          // Screenshots & copied files — optimistic insert, upload behind it.
          insertOptimisticMedia(editorInstance, files);
          return true;
        },
        handleDrop: (view, event, _slice, moved) => {
          const editorInstance = editorRef.current;
          if (moved || !editorInstance) return false;
          const files = Array.from(event.dataTransfer?.files ?? []);
          if (!files.length) return false;
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
          insertOptimisticMedia(editorInstance, files, coords?.pos);
          return true;
        },
      },
    },
    [],
  );

  /* ------------------------------------------------ keep editorRef fresh */
  React.useEffect(() => {
    editorRef.current = editor ?? null;
    // Debug handle for browser console testing (dev only).
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __editor?: Editor }).__editor = editor ?? undefined;
    }
  }, [editor]);

  /* ------------------------------------------------ load document */
  React.useEffect(() => {
    if (!editor) return;
    let cancelled = false;
    fetchDocument()
      .then((doc) => {
        if (cancelled) return;
        if (doc.content && typeof doc.content === "object" && "type" in (doc.content as object)) {
          editor.commands.setContent(doc.content as JSONContent, { emitUpdate: false });
        } else {
          editor.commands.setContent(emptyDocumentJSON(), { emitUpdate: false });
        }
        // Every page starts with its title block — normalize older content.
        editor.commands.ensurePageTitle();
        setReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[editor] failed to load document", error);
        toast.error("Couldn't load your document", {
          description: "You can keep writing — changes will retry on save.",
        });
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [editor]);

  /* ------------------------------------------------ autosave */
  const { status, savedAt } = useAutosave({ editor, ready });

  /* ------------------------------------------------ global shortcuts */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (mod && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ------------------------------------------------ demo & misc actions */
  const loadDemo = React.useCallback(() => {
    if (!editor) return;
    if (isDocEmpty(editor)) {
      editor.commands.setContent(DEMO_CONTENT, { emitUpdate: true });
    } else {
      editor
        .chain()
        .focus("end")
        .insertContentAt(editor.state.doc.content.size, DEMO_CONTENT.content ?? [])
        .run();
    }
    toast.success("Demo document loaded", {
      description: "Hover blocks, press / or @ anywhere — explore!",
    });
  }, [editor]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header
        editor={editor}
        status={status}
        onUndo={() => editor?.chain().focus().undo().run()}
        onRedo={() => editor?.chain().focus().redo().run()}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onLoadDemo={loadDemo}
      />

      <main ref={mainRef} className="relative flex-1 overflow-y-auto" aria-label="Document">
        {/* Loading skeleton */}
        {!ready && (
          <div className="pointer-events-none absolute inset-x-0 top-10 z-10 mx-auto max-w-[720px] px-6">
            <EditorSkeleton />
          </div>
        )}

        <div ref={contentRef} className="relative mx-auto w-full max-w-[880px] px-5 pb-24 pt-12 md:px-20 lg:px-24">
          <div
            data-editor-column
            className="rich-editor mx-auto max-w-[720px]"
            onContextMenu={(e) => {
              if (!editor) return;
              const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
              if (!coords) return;
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, pos: coords.pos });
            }}
          >
            {editor && (
              <>
                <EditorContent editor={editor} />
                <FloatingToolbar editor={editor} />
                <TableMenu editor={editor} />
              </>
            )}
          </div>

          {editor && ready && <BlockHandle editor={editor} contentRef={contentRef} />}
          {editor && ready && <EmptyStateHint editor={editor} onLoadDemo={loadDemo} />}
        </div>
      </main>

      <StatusBar editor={editor} status={status} savedAt={savedAt} />

      {/* ------------------------------ overlays ------------------------------ */}
      {editor && (
        <MobileLayer
          editor={editor}
          helpers={slashHelpers}
          contentRef={contentRef}
          scrollRef={mainRef}
        />
      )}
      {editor && <SlashMenu />}
      {editor && <MentionMenu />}
      {editor && <SearchPanel editor={editor} open={searchOpen} onClose={() => setSearchOpen(false)} />}
      {editor && (
        <ContextMenu
          editor={editor}
          state={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}
      {editor && <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />}

      {editor && emojiAnchor && (
        <EmojiPicker
          anchorRect={emojiAnchor}
          onPick={(emoji) => {
            editor.chain().focus().insertContent(emoji).run();
            setEmojiAnchor(null);
          }}
          onClose={() => setEmojiAnchor(null)}
        />
      )}

      <EmbedDialog
        open={embedOpen}
        onOpenChange={setEmbedOpen}
        onSubmit={(url) => {
          const normalized = normalizeEmbedUrl(url);
          if (!normalized) {
            toast.error("That doesn't look like a valid embed URL");
            return;
          }
          editor?.chain().focus().insertEmbed(normalized).run();
          setEmbedOpen(false);
          toast.success("Embed added");
        }}
      />

      {/* Hidden file input for uploads — files go through the optimistic pipeline */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length && editor) insertOptimisticMedia(editor, files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** True when the document has no meaningful content yet. */
function isDocEmpty(editor: Editor): boolean {
  const doc = editor.state.doc;
  if (doc.childCount === 0) return true;
  if (doc.childCount === 1) {
    const first = doc.firstChild!;
    if (first.type.name === "pageTitle") return first.content.size === 0;
    if (first.type.name === "paragraph") return first.content.size === 0;
  }
  return false;
}

/* ================================================================ Header */

function Header({
  editor,
  status,
  onUndo,
  onRedo,
  onOpenSearch,
  onOpenShortcuts,
  onLoadDemo,
}: {
  editor: Editor | null;
  status: SaveStatus;
  onUndo: () => void;
  onRedo: () => void;
  onOpenSearch: () => void;
  onOpenShortcuts: () => void;
  onLoadDemo: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const history = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e ? { canUndo: e.can().undo(), canRedo: e.can().redo() } : { canUndo: false, canRedo: false },
  });

  return (
    <TooltipProvider delayDuration={300}>
      <header className="sticky top-0 z-50 shrink-0 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[52px] w-full max-w-5xl items-center gap-2 px-3 md:px-5">
          <a
            href="/"
            aria-label="Notespace — home"
            className="flex shrink-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Image
              src="/notespace-icon.png"
              alt=""
              width={32}
              height={32}
              priority
              className="h-8 w-8 rounded-[9px] shadow-md shadow-sky-500/25"
            />
            <NotespaceWordmark className="h-[15px] w-auto text-foreground" />
          </a>

          <span className="sr-only">Document editor</span>

          <SaveChip status={status} />

          <div className="ml-auto flex items-center gap-0.5">
            <HeaderBtn title="Undo — ⌘Z" onClick={onUndo} disabled={!history?.canUndo}>
              <Undo2 size={15} />
            </HeaderBtn>
            <HeaderBtn title="Redo — ⌘⇧Z" onClick={onRedo} disabled={!history?.canRedo}>
              <Redo2 size={15} />
            </HeaderBtn>

            <span className="mx-1 h-5 w-px bg-border/70" aria-hidden />

            <HeaderBtn title="Insert demo document" onClick={onLoadDemo}>
              <Presentation size={15} />
            </HeaderBtn>
            <HeaderBtn title="Search & replace — ⌘F" onClick={onOpenSearch}>
              <Search size={15} />
            </HeaderBtn>
            <HeaderBtn title="Keyboard shortcuts — ⌘/" onClick={onOpenShortcuts}>
              <Keyboard size={15} />
            </HeaderBtn>
            <HeaderBtn
              title={mounted && theme === "dark" ? "Switch to light" : "Switch to dark"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {mounted && theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </HeaderBtn>
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}

function HeaderBtn({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={title}
          disabled={disabled}
          onClick={onClick}
          className="editor-icon-btn h-8 w-8 rounded-lg disabled:cursor-not-allowed disabled:opacity-35"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {title}
      </TooltipContent>
    </Tooltip>
  );
}

function SaveChip({ status }: { status: SaveStatus }) {
  const map: Record<SaveStatus, { label: string; className: string }> = {
    idle: { label: "Synced", className: "text-muted-foreground" },
    saved: { label: "Saved", className: "text-emerald-500" },
    dirty: { label: "Unsaved", className: "text-amber-500" },
    saving: { label: "Saving", className: "text-violet-400 animate-pulse" },
    error: { label: "Retrying…", className: "text-red-400" },
  };
  const { label, className } = map[status];
  return (
    <span
      className={cn(
        "hidden items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] font-medium sm:flex",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", status === "saving" && "animate-ping")} />
      {label}
    </span>
  );
}

/* ============================================================== StatusBar */

function StatusBar({
  editor,
  status,
  savedAt,
}: {
  editor: Editor | null;
  status: SaveStatus;
  savedAt: Date | null;
}) {
  const stats = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            words: e.storage.characterCount.words(),
            chars: e.storage.characterCount.characters(),
            blocks: e.state.doc.childCount,
          }
        : { words: 0, chars: 0, blocks: 0 },
  });

  const timeLabel = savedAt
    ? `· ${relativeTime(savedAt)}`
    : "";

  return (
    <footer className="mt-auto shrink-0 border-t border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-9 w-full max-w-5xl items-center justify-between px-4 pb-[env(safe-area-inset-bottom)] text-[11.5px] text-muted-foreground">
        <div className="flex items-center gap-3 tabular-nums">
          <span>
            <span className="font-medium text-foreground/70">{stats?.blocks ?? 0}</span> blocks
          </span>
          <span aria-hidden>·</span>
          <span>
            <span className="font-medium text-foreground/70">{stats?.words ?? 0}</span> words
          </span>
          <span aria-hidden className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">
            <span className="font-medium text-foreground/70">{stats?.chars ?? 0}</span> characters
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden md:inline">Press / for blocks · @ to mention · ⌘/ shortcuts</span>
          <span aria-hidden className="hidden md:inline">·</span>
          <span className="flex items-center gap-1.5" role="status" aria-live="polite">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                status === "saved" && "bg-emerald-500",
                status === "saving" && "animate-pulse bg-violet-400",
                status === "dirty" && "bg-amber-500",
                status === "error" && "bg-red-400",
                (status === "idle") && "bg-muted-foreground/50",
              )}
            />
            {status === "saved" ? `Saved ${timeLabel}` : status === "idle" ? "All changes captured" : status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
      </div>
    </footer>
  );
}

function relativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

/* ============================================================ Sub-pieces */

function EmptyStateHint({
  editor,
  onLoadDemo,
}: {
  editor: Editor;
  onLoadDemo: () => void;
}) {
  const isEmpty = useEditorState({
    editor,
    selector: ({ editor: e }) => isDocEmpty(e),
  });
  if (!isEmpty) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[150px] z-10 flex justify-center animate-fade-slide-up">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-border/70 bg-card/80 py-1.5 pl-4 pr-1.5 text-xs text-muted-foreground shadow-lg shadow-black/10 backdrop-blur-md">
        <span>
          Start typing, press <span className="kbd mx-0.5">/</span> for blocks
        </span>
        <span className="h-3.5 w-px bg-border" aria-hidden />
        <button
          type="button"
          onClick={onLoadDemo}
          className="flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 font-medium text-primary transition-colors hover:bg-primary/25"
        >
          <Plus size={11} /> Load demo
        </button>
      </div>
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-muted/70" />
      <div className="h-4 w-full animate-pulse rounded bg-muted/50" />
      <div className="h-4 w-11/12 animate-pulse rounded bg-muted/50" />
      <div className="h-4 w-4/5 animate-pulse rounded bg-muted/40" />
      <div className="h-24 w-full animate-pulse rounded-xl bg-muted/40" />
      <div className="h-4 w-3/4 animate-pulse rounded bg-muted/40" />
    </div>
  );
}

function EmbedDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (url: string) => void;
}) {
  const [url, setUrl] = React.useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-border/80 bg-popover/95 backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Globe size={16} className="text-primary" /> Embed content
          </DialogTitle>
          <DialogDescription className="text-xs">
            Paste a YouTube, Vimeo or Loom link — any https URL works too.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) onSubmit(url);
          }}
          className="space-y-3"
        >
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=…"
            autoFocus
            className="h-10 w-full rounded-lg border border-border bg-muted/40 px-3 text-[13.5px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-8 rounded-lg px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8 rounded-lg bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Insert embed
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
