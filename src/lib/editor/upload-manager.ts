import type { Editor } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { toast } from "sonner";
import { formatBytes } from "./utils";

/**
 * Optimistic media pipeline (Figma-style):
 *
 * 1. The file is rendered immediately from a local Blob URL — no waiting.
 * 2. An XHR upload runs in the background with non-blocking progress.
 * 3. On success the permanent URL is preloaded and swapped in seamlessly.
 * 4. On failure the block keeps the local preview plus retry / remove.
 *
 * All three entry points (paste, drag & drop, file picker) funnel through
 * `insertOptimisticMedia`, so they share identical behavior.
 */

export type UploadKind = "image" | "video" | "audio" | "file";

export function kindForMime(type: string, name = ""): UploadKind {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  // Some systems report empty types — fall back to extension sniffing.
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "bmp"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "mkv"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext)) return "audio";
  return "file";
}

interface UploadResult {
  url: string;
  name: string;
  size: number;
  type: string;
}

interface ManagedUpload {
  id: string;
  file: File;
  xhr: XMLHttpRequest | null;
  promise: Promise<UploadResult>;
  status: "uploading" | "done" | "error" | "aborted";
  resolve: (value: UploadResult) => void;
  reject: (reason: Error) => void;
}

const uploads = new Map<string, ManagedUpload>();
/** Keeps the File alive for retry, keyed by upload id. */
const filesById = new Map<string, File>();
let seq = 0;

function nextId(): string {
  seq += 1;
  return `up-${Date.now().toString(36)}-${seq}`;
}

/** Start an XHR upload with progress reporting. `existingId` ties the upload to a node's uploadId attr. */
export function startManagedUpload(
  file: File,
  onProgress?: (percent: number) => void,
  existingId?: string,
): { id: string; promise: ManagedUpload["promise"]; abort: () => void } {
  const id = existingId ?? nextId();
  filesById.set(id, file);

  // Settle functions are captured so the entry object (which holds the
  // promise itself) can be assembled after the executor runs — referencing
  // `promise` inside the executor would be a TDZ violation and the upload
  // would die silently.
  let resolveUpload: (value: UploadResult) => void = () => {};
  let rejectUpload: (reason: Error) => void = () => {};
  const promise = new Promise<UploadResult>((resolve, reject) => {
    resolveUpload = resolve;
    rejectUpload = reject;
  });

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/upload");
  xhr.responseType = "json";
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable && onProgress) {
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    }
  };

  const entry: ManagedUpload = {
    id,
    file,
    xhr,
    promise,
    status: "uploading",
    resolve: (value) => {
      entry.status = "done";
      resolveUpload(value);
    },
    reject: (reason) => {
      if (entry.status === "uploading") entry.status = "error";
      rejectUpload(reason);
    },
  };
  uploads.set(id, entry);

  xhr.onerror = () => entry.reject(new Error("Network error during upload"));
  xhr.onabort = () => {
    entry.status = "aborted";
    rejectUpload(new Error("Upload cancelled"));
  };
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      const body = (xhr.response ?? {}) as { url?: string; name?: string; size?: number; type?: string };
      if (!body.url) {
        entry.reject(new Error("Upload endpoint returned no URL"));
        return;
      }
      entry.resolve({
        url: body.url,
        name: body.name ?? file.name,
        size: body.size ?? file.size,
        type: body.type ?? file.type,
      });
    } else {
      const message = (xhr.response as { error?: string } | null)?.error ?? `Upload failed (${xhr.status})`;
      entry.reject(new Error(message));
    }
  };

  const body = new FormData();
  body.append("file", file);
  xhr.send(body);

  void promise.catch(() => {
    /* rejection handled by callers / error state on the node */
  });

  return {
    id,
    promise,
    abort: () => {
      const current = uploads.get(id);
      if (current && current.status === "uploading") current.xhr?.abort();
    },
  };
}

export function abortUpload(id: string) {
  const entry = uploads.get(id);
  if (entry && entry.status === "uploading") entry.xhr?.abort();
}

export function getFileForUpload(id: string): File | null {
  return filesById.get(id) ?? null;
}

/** Resolves when every in-flight upload has settled (success or failure). */
export function whenUploadsSettle(timeoutMs = 8000): Promise<void> {
  const pending = [...uploads.values()].filter((u) => u.status === "uploading").map((u) => u.promise);
  if (!pending.length) return Promise.resolve();
  return Promise.race([
    Promise.allSettled(pending).then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
}

function mediaNodeJSON(file: File, kind: UploadKind, id: string, objectUrl: string): JSONContent {
  const base = {
    uploadId: id,
    uploading: true,
    progress: 0,
    uploadError: false,
  };
  switch (kind) {
    case "image":
      return { type: "imageBlock", attrs: { src: objectUrl, alt: file.name, width: 100, align: "center", ...base } };
    case "video":
      return { type: "videoBlock", attrs: { src: objectUrl, name: file.name, ...base } };
    case "audio":
      return { type: "audioBlock", attrs: { src: objectUrl, name: file.name, ...base } };
    default:
      return {
        type: "fileBlock",
        attrs: { src: objectUrl, name: file.name, size: file.size, type: file.type || "application/octet-stream", ...base },
      };
  }
}

/** Find the doc position of the node carrying `uploadId`, plus the node. */
function findUploadNode(editor: Editor, uploadId: string): { pos: number; node: { attrs: Record<string, unknown> } } | null {
  let found: { pos: number; node: { attrs: Record<string, unknown> } } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.attrs.uploadId === uploadId) {
      found = { pos, node: node as unknown as { attrs: Record<string, unknown> } };
      return false;
    }
    return true;
  });
  return found;
}

function patchUploadAttrs(editor: Editor, uploadId: string, attrs: Record<string, unknown>): boolean {
  const hit = findUploadNode(editor, uploadId);
  if (!hit) return false;
  const tr = editor.state.tr.setNodeMarkup(hit.pos, undefined, { ...editor.state.doc.nodeAt(hit.pos)?.attrs, ...attrs });
  tr.setMeta("addToHistory", false);
  editor.view.dispatch(tr);
  return true;
}

/** Preload a URL so the swap happens without a visible flash. */
function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // swap anyway; the URL is permanent
    img.src = url;
  });
}

/**
 * Insert media files optimistically and upload them in the background.
 * Returns immediately — the editor already shows the local preview.
 */
export function insertOptimisticMedia(editor: Editor, files: File[], insertPos?: number): void {
  const nodes: JSONContent[] = [];
  const jobs: { id: string; file: File; kind: UploadKind }[] = [];

  for (const file of files) {
    const kind = kindForMime(file.type, file.name);
    const id = nextId();
    const objectUrl = URL.createObjectURL(file);
    nodes.push(mediaNodeJSON(file, kind, id, objectUrl));
    jobs.push({ id, file, kind });
  }
  if (!nodes.length) return;

  const pos = insertPos ?? editor.state.selection.to;
  editor
    .chain()
    .focus()
    .insertContentAt(pos, nodes, { updateSelection: false })
    .run();

  for (const job of jobs) {
    let lastPct = 0;
    const { promise } = startManagedUpload(job.file, (pct) => {
      if (pct - lastPct >= 3 || (pct === 99 && lastPct !== 99)) {
        lastPct = pct;
        if (!patchUploadAttrs(editor, job.id, { progress: pct })) {
          // Node was deleted while uploading — stop the network work.
          abortUpload(job.id);
        }
      }
    }, job.id);

    void promise
      .then(async (result) => {
        if (job.kind === "image") await preloadImage(result.url);
        const ok = patchUploadAttrs(editor, job.id, {
          src: result.url,
          uploading: false,
          progress: 100,
          uploadError: false,
        });
        if (!ok) return;
        toast.success(`${job.file.name} uploaded`);
      })
      .catch((error: Error) => {
        if (error.message === "Upload cancelled") {
          // Node removal already handled the cleanup.
          return;
        }
        patchUploadAttrs(editor, job.id, { uploading: false, uploadError: true, progress: 0 });
        toast.error(`Upload failed: ${job.file.name}`, { description: error.message });
      });
  }
}

/** Retry a failed upload for an existing media node. */
export function retryUploadForNode(editor: Editor, uploadId: string): void {
  const file = filesById.get(uploadId);
  if (!file) {
    toast.error("The original file is no longer available — re-upload it.");
    return;
  }
  patchUploadAttrs(editor, uploadId, { uploading: true, uploadError: false, progress: 0 });
  let lastPct = 0;
  const { promise } = startManagedUpload(file, (pct) => {
    if (pct - lastPct >= 3) {
      lastPct = pct;
      if (!patchUploadAttrs(editor, uploadId, { progress: pct })) abortUpload(uploadId);
    }
  }, uploadId);
  void promise
    .then(async (result) => {
      if (kindForMime(result.type, result.name) === "image") await preloadImage(result.url);
      patchUploadAttrs(editor, uploadId, { src: result.url, uploading: false, progress: 100, uploadError: false });
      toast.success(`${file.name} uploaded`);
    })
    .catch((error: Error) => {
      if (error.message === "Upload cancelled") return;
      patchUploadAttrs(editor, uploadId, { uploading: false, uploadError: true, progress: 0 });
      toast.error(`Upload failed: ${file.name}`, { description: error.message });
    });
}

export function describeFile(file: File): string {
  return `${file.name} · ${formatBytes(file.size)}`;
}
