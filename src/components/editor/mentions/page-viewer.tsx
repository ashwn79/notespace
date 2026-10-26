"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Check, ChevronRight, Clock3, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { relativeTime, renamePage, type WorkspacePage } from "@/lib/editor/mentions/workspace";
import { useWorkspace } from "@/lib/editor/mentions/use-workspace";

/**
 * Page viewer — the overlay destination for page mentions. Clicking a page
 * pill opens it; ⌘/Ctrl+Click opens the same viewer in a new tab via the
 * `?page=` deep link (still the single editor route).
 */

export function openPageInNewTab(pageId: string) {
  const url = `${window.location.pathname}?page=${encodeURIComponent(pageId)}`;
  window.open(url, "_blank", "noopener");
}

export function PageViewer({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const workspace = useWorkspace();
  const page: WorkspacePage | null = workspace.pages.find((p) => p.id === pageId) ?? null;
  const [renaming, setRenaming] = React.useState(false);
  const [draftTitle, setDraftTitle] = React.useState("");

  const startRename = () => {
    setDraftTitle(page?.title ?? "");
    setRenaming(true);
  };

  const commitRename = () => {
    if (page && draftTitle.trim() && draftTitle.trim() !== page.title) {
      renamePage(page.id, draftTitle);
      toast.success("Page renamed — every mention updated");
    }
    setRenaming(false);
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px] animate-pop-in sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-label={page ? `Page — ${page.title}` : "Missing page"}
    >
      <div
        className="group/page flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-popover/95 shadow-2xl shadow-black/50 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {page ? (
          <>
            {/* Breadcrumb header */}
            <div className="flex items-center gap-1.5 border-b border-border/60 px-5 py-3 text-[12px] text-muted-foreground">
              {page.path.map((seg, i) => (
                <React.Fragment key={`${seg}-${i}`}>
                  {i > 0 ? <ChevronRight size={12} className="opacity-60" /> : null}
                  <span className="truncate">{seg}</span>
                </React.Fragment>
              ))}
              <ChevronRight size={12} className="opacity-60" />
              <span className="truncate font-medium text-foreground">{page.title}</span>
              <button
                type="button"
                aria-label="Close page"
                onClick={onClose}
                className="editor-icon-btn ml-auto h-8 w-8 shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-10">
              <div className="mb-1 flex items-center gap-2 text-4xl">
                {page.icon}
                <button
                  type="button"
                  aria-label="Rename page"
                  onClick={startRename}
                  className="editor-icon-btn h-8 w-8 text-[15px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/page:opacity-100"
                >
                  <Pencil size={14} />
                </button>
              </div>
              {renaming ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitRename();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    autoFocus
                    aria-label="Page title"
                    className="w-full rounded-lg border border-primary/40 bg-muted/40 px-3 py-1.5 text-[26px] font-bold tracking-tight outline-none"
                  />
                  <button
                    type="submit"
                    aria-label="Save title"
                    className="editor-icon-btn h-9 w-9 shrink-0 text-primary"
                  >
                    <Check size={16} />
                  </button>
                </form>
              ) : (
                <h1 className="text-[28px] font-bold leading-tight tracking-tight">{page.title}</h1>
              )}
              <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Clock3 size={12} />
                Edited {relativeTime(page.editedAt)}
                {page.favorite ? " · ⭐ Favorite" : ""}
                {page.pinned ? " · 📌 Pinned" : ""}
              </p>

              {page.excerpt ? (
                <p className="mt-5 text-[14.5px] leading-7 text-foreground/90">{page.excerpt}</p>
              ) : null}

              <div className="mt-4 space-y-3.5 text-[14px] leading-7 text-foreground/70">
                <p>
                  This workspace page lives outside the current document. The editor renders it here
                  so links never dead-end — full multi-page authoring arrives with the workspace beta.
                </p>
                <p>
                  Mentions keep a live binding to this page: rename it in the workspace and every
                  pill that references it updates instantly, everywhere in every document.
                </p>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-[13px]">
                  <p className="mb-1 font-semibold text-foreground/85">Why a preview?</p>
                  <p className="leading-6 text-muted-foreground">
                    Deep links, backlinks and sub-pages are on the roadmap. The mention framework
                    already carries the page id, so no content will need migrating when it ships.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-border/60 bg-muted/20 px-5 py-3">
              <span className="text-[11.5px] text-muted-foreground">
                Press <span className="kbd">esc</span> to return to the document
              </span>
              <button
                type="button"
                onClick={() => toast("Editing this page — coming soon", { description: "Multi-doc workspace is next on the roadmap." })}
                className="ml-auto flex items-center gap-1.5 rounded-lg bg-primary/15 px-3 py-1.5 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/25"
              >
                Open in editor <ArrowUpRight size={13} />
              </button>
            </div>
          </>
        ) : (
          <div className="p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-border text-xl text-muted-foreground">
              ⚠
            </div>
            <p className="text-[15px] font-semibold">Missing page</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              This mention points to a page that no longer exists.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-lg bg-primary/15 px-3.5 py-1.5 text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary/25"
            >
              Back to document
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
