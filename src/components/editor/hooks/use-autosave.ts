"use client";

import * as React from "react";
import type { Editor } from "@tiptap/core";
import type { SaveStatus } from "@/lib/editor/types";
import { saveDocument } from "@/lib/editor/api";
import { whenUploadsSettle } from "@/lib/editor/upload-manager";
import { deriveTitleFromDoc } from "@/lib/editor/doc-title";

/**
 * Debounced autosave with dirty/saving/saved lifecycle.
 * The document title is derived from the page title block on every save,
 * and in-flight media uploads are awaited so no blob: URL is persisted.
 */
export function useAutosave({
  editor,
  ready,
}: {
  editor: Editor | null;
  ready: boolean;
}) {
  const [status, setStatus] = React.useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);

  const latest = React.useRef({ title: "", content: null as unknown });
  const timer = React.useRef<number | undefined>(undefined);
  const statusRef = React.useRef<SaveStatus>("idle");

  const save = React.useCallback(async () => {
    if (!latest.current.content) return;
    setStatus("saving");
    statusRef.current = "saving";
    try {
      // Never persist a blob: preview — wait for pending uploads, then
      // snapshot the freshest content (uploads mutate the doc).
      await whenUploadsSettle(8000);
      if (editor) {
        latest.current.content = editor.getJSON();
        latest.current.title = deriveTitleFromDoc(latest.current.content);
      }
      const res = await saveDocument({
        title: latest.current.title,
        content: latest.current.content,
      });
      setSavedAt(new Date(res.savedAt));
      setStatus("saved");
      statusRef.current = "saved";
    } catch {
      setStatus("error");
      statusRef.current = "error";
    }
  }, [editor]);

  const schedule = React.useCallback(() => {
    window.clearTimeout(timer.current);
    setStatus("dirty");
    statusRef.current = "dirty";
    timer.current = window.setTimeout(() => void save(), 900);
  }, [save]);

  // Track editor updates.
  React.useEffect(() => {
    if (!editor || !ready) return;
    const onUpdate = () => {
      latest.current.content = editor.getJSON();
      schedule();
    };
    latest.current.content = editor.getJSON();
    latest.current.title = deriveTitleFromDoc(latest.current.content);
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
      window.clearTimeout(timer.current);
    };
  }, [editor, ready, schedule]);

  // Flush when the tab is hidden / unloaded.
  React.useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && statusRef.current !== "saved") {
        void save();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onVisibility);
    };
  }, [save]);

  return { status, savedAt, saveNow: save };
}
