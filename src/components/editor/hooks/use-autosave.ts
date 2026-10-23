"use client";

import * as React from "react";
import type { Editor } from "@tiptap/core";
import type { SaveStatus } from "@/lib/editor/types";
import { saveDocument } from "@/lib/editor/api";

/**
 * Debounced autosave with dirty/saving/saved lifecycle, title tracking,
 * and a flush on tab-hide so nothing is ever lost.
 */
export function useAutosave({
  editor,
  title,
  ready,
}: {
  editor: Editor | null;
  title: string;
  ready: boolean;
}) {
  const [status, setStatus] = React.useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);

  const latest = React.useRef({ title: "", content: null as unknown });
  const timer = React.useRef<number | undefined>(undefined);
  const statusRef = React.useRef<SaveStatus>("idle");
  const skipFirstTitle = React.useRef(true);

  const save = React.useCallback(async () => {
    if (!latest.current.content) return;
    setStatus("saving");
    statusRef.current = "saving";
    try {
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
  }, []);

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
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
      window.clearTimeout(timer.current);
    };
  }, [editor, ready, schedule]);

  // Track title edits.
  React.useEffect(() => {
    if (!ready) return;
    latest.current.title = title;
    if (skipFirstTitle.current) {
      skipFirstTitle.current = false;
      return;
    }
    schedule();
  }, [title, ready, schedule]);

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
