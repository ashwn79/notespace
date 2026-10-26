import type { Editor } from "@tiptap/core";
import { JSONContent } from "@tiptap/core";
import {
  cancelUpload,
  forgetUpload,
  newUploadId,
  registerUpload,
  setUploadError,
  setUploadProgress,
  setUploadSuccess,
  uploadFileWithProgress,
} from "@/lib/editor/upload-manager";

/**
 * Optimistic media insertion (Figma-style):
 *
 *  1. The media block renders IMMEDIATELY from a local Blob URL.
 *  2. The upload streams in the background with progress.
 *  3. On success the permanent URL is preloaded and swapped in without
 *     flicker; the Blob URL is revoked afterwards.
 *  4. Failures surface retry / cancel affordances on the block itself and
 *     never destroy user edits (the node is only touched on success).
 */

export type OptimisticKind = "image" | "video" | "audio" | "file";

export function kindForMime(type: string, fileName = ""): OptimisticKind {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  const ext = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
  if (["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext)) return "audio";
  if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return "video";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"].includes(ext)) return "image";
  return "file";
}

const files = new Map<string, File>();

function nodeJSONFor(kind: OptimisticKind, uploadId: string, blobUrl: string, file: File): JSONContent {
  const base = {
    src: blobUrl,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    uploadId,
  };
  if (kind === "image") {
    return { type: "imageBlock", attrs: { ...base, alt: file.name, width: 100, align: "center" } };
  }
  if (kind === "video") return { type: "videoBlock", attrs: base };
  if (kind === "audio") return { type: "audioBlock", attrs: base };
  return { type: "fileBlock", attrs: base };
}

/**
 * Insert a media file optimistically and start the background upload.
 * `replacePos` swaps an existing node (e.g. a media placeholder card);
 * `insertAt` places the block at a specific doc position (drops);
 * otherwise the block lands at the current selection.
 */
export function insertOptimisticMedia(
  editor: Editor,
  file: File,
  options?: { replacePos?: number; insertAt?: number },
): string | null {
  const kind = kindForMime(file.type, file.name);
  const uploadId = newUploadId();
  const blobUrl = URL.createObjectURL(file);
  const json = nodeJSONFor(kind, uploadId, blobUrl, file);

  try {
    if (typeof options?.replacePos === "number") {
      const target = editor.state.doc.nodeAt(options.replacePos);
      const to = target ? options.replacePos + target.nodeSize : options.replacePos + 1;
      editor.chain().focus().insertContentAt({ from: options.replacePos, to }, json).run();
    } else {
      editor
        .chain()
        .focus()
        .insertContentAt(options?.insertAt ?? editor.state.selection.to, json)
        .run();
    }
  } catch {
    URL.revokeObjectURL(blobUrl);
    return null;
  }

  files.set(uploadId, file);
  void startUpload(editor, uploadId, file);
  return uploadId;
}

function startUpload(editor: Editor, uploadId: string, file: File) {
  registerUpload(uploadId, file.name);

  uploadFileWithProgress(uploadId, file, (fraction) => setUploadProgress(uploadId, fraction))
    .then((result) => {
      swapToPermanentUrl(editor, uploadId, result);
    })
    .catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return; // cancelled elsewhere
      setUploadError(uploadId, error instanceof Error ? error.message : "Upload failed");
    });
}

/** Re-run the upload for a failed / cancelled task. */
export function retryMediaUpload(editor: Editor, uploadId: string): void {
  const file = files.get(uploadId);
  if (!file) {
    setUploadError(uploadId, "The original file is no longer available");
    return;
  }
  void startUpload(editor, uploadId, file);
}

export function cancelMediaUpload(uploadId: string): void {
  cancelUpload(uploadId);
}

export function forgetMediaUpload(uploadId: string): void {
  files.delete(uploadId);
  forgetUpload(uploadId);
}

interface FoundNode {
  pos: number;
  node: { attrs: Record<string, unknown> & { uploadId?: string | null } };
}

function findNodeByUploadId(editor: Editor, uploadId: string): FoundNode | null {
  let found: FoundNode | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.attrs?.uploadId === uploadId) {
      found = { pos, node: node as unknown as FoundNode["node"] };
      return false;
    }
    return true;
  });
  return found;
}

function swapToPermanentUrl(
  editor: Editor,
  uploadId: string,
  result: { url: string; name: string; size: number; type: string },
) {
  const found = findNodeByUploadId(editor, uploadId);
  if (!found || editor.isDestroyed) return;

  const finish = () => {
    if (editor.isDestroyed) return;
    const current = findNodeByUploadId(editor, uploadId);
    if (!current) return; // user deleted the block meanwhile
    const tr = editor.state.tr.setNodeMarkup(current.pos, undefined, {
      ...(current.node.attrs as Record<string, unknown>),
      src: result.url,
      size: result.size || (current.node.attrs as { size?: number }).size,
      uploadId: null,
    });
    editor.view.dispatch(tr);
    setUploadSuccess(uploadId);
    window.setTimeout(() => forgetMediaUpload(uploadId), 400);
  };

  // Preload the permanent asset so the swap never flickers.
  if (result.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(result.url)) {
    const img = new Image();
    img.onload = finish;
    img.onerror = finish; // swap anyway; the browser will retry loading
    img.src = result.url;
    // Safety net — never keep the progress bar hanging on a slow preload.
    window.setTimeout(() => finish(), 4000);
  } else {
    finish();
  }
}

/** Delete the media node bound to an upload (Remove action on failure). */
export function removeOptimisticNode(editor: Editor, uploadId: string): void {
  const found = findNodeByUploadId(editor, uploadId);
  if (!found) return;
  const tr = editor.state.tr.delete(found.pos, found.pos + 1);
  editor.view.dispatch(tr);
  forgetMediaUpload(uploadId);
}
